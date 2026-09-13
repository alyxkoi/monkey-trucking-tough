begin;

-- Conservative local-business window; can be configured after release testing.
alter table public.communication_runtime
  add business_start_hour integer not null default 9 check (business_start_hour between 0 and 22),
  add business_end_hour integer not null default 17 check (business_end_hour between 1 and 23),
  add business_days integer[] not null default array[1,2,3,4,5],
  add constraint communication_business_hours check (business_end_hour>business_start_hour and cardinality(business_days)>0 and business_days<@array[1,2,3,4,5,6,7]);

create function public.sms_business_time(p_at timestamptz,p_hours integer default 0) returns timestamptz
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r public.communication_runtime%rowtype; local_at timestamp; end_at timestamp; remaining interval:=make_interval(hours=>p_hours);
begin
  select * into r from public.communication_runtime where id=1;
  if not found or p_hours<0 or p_hours>72 then return null; end if;
  local_at:=p_at at time zone r.timezone;
  loop
    if not extract(isodow from local_at)::integer=any(r.business_days) or local_at::time>=make_time(r.business_end_hour,0,0) then
      local_at:=date_trunc('day',local_at)+interval '1 day'+make_interval(hours=>r.business_start_hour);
      continue;
    end if;
    if local_at::time<make_time(r.business_start_hour,0,0) then local_at:=date_trunc('day',local_at)+make_interval(hours=>r.business_start_hour); end if;
    end_at:=date_trunc('day',local_at)+make_interval(hours=>r.business_end_hour);
    if remaining<end_at-local_at then return (local_at+remaining) at time zone r.timezone; end if;
    remaining:=remaining-(end_at-local_at);
    local_at:=end_at;
  end loop;
end $$;

create function public.sms_automation_guard(p_rule text,p_lead_id uuid,p_guard jsonb,p_now timestamptz default now()) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare l public.leads%rowtype; c public.customers%rowtype; q public.quotes%rowtype; j public.jobs%rowtype; i public.invoices%rowtype;
  anchor timestamptz; subject_id uuid; scheduled_at timestamptz; r public.communication_runtime%rowtype;
begin
  select * into l from public.leads where id=p_lead_id;
  select * into c from public.customers where id=l.customer_id;
  select * into r from public.communication_runtime where id=1;
  if l.id is null or c.id is null or r.id is null or l.human_takeover or c.sms_opted_out_at is not null
    or c.sms_consent_at is null or c.sms_double_opt_in_at is null or not r.scheduled_sending_enabled then return false; end if;
  if not exists(select 1 from public.automation_rules where id=p_rule and status='ON') then return false; end if;
  if exists(select 1 from public.leads where customer_id=c.id and human_takeover)
    or exists(select 1 from public.jobs where customer_id=c.id and (blocked_reason is not null or change_requested))
    or exists(select 1 from public.invoices where customer_id=c.id and (disputed or payment_claimed_at is not null)) then return false; end if;
  anchor:=(p_guard->>'anchor')::timestamptz;
  subject_id:=(p_guard->>'subject_id')::uuid;
  if anchor is null or subject_id is null or r.activated_at is null or anchor<r.activated_at then return false; end if;
  if p_rule='new-lead' then
    return l.id=subject_id and l.status='NEW' and l.created_at=anchor
      and not exists(select 1 from public.lead_messages where lead_id=l.id and sender_type='CUSTOMER' and message_kind='INBOUND')
      and not exists(select 1 from public.quotes where lead_id=l.id and status not in ('DRAFT','VOID'));
  elsif p_rule='quote-follow-up' then
    select * into q from public.quotes where id=subject_id and customer_id=c.id;
    return q.status='SENT' and q.sent_at=anchor and q.updated_at=(p_guard->>'version')::timestamptz and l.status not in ('WON','LOST')
      and not exists(select 1 from public.lead_messages where customer_id=c.id and sender_type in ('CUSTOMER','HUMAN') and created_at>anchor and message_kind is distinct from 'COMPLIANCE');
  elsif p_rule='job-reminder' then
    select * into j from public.jobs where id=subject_id and customer_id=c.id;
    scheduled_at:=(j.scheduled_date+j.scheduled_time) at time zone r.timezone;
    return j.status='SCHEDULED' and not j.all_day and j.updated_at=(p_guard->>'version')::timestamptz and scheduled_at=anchor and scheduled_at>p_now
      and j.created_at<scheduled_at-interval '24 hours'
      and not exists(select 1 from public.activity_history where entity_type='JOB' and entity_id=j.id and event_type='RESCHEDULED' and created_at>=scheduled_at-interval '24 hours');
  elsif p_rule='invoice-follow-up' then
    select * into i from public.invoices where id=subject_id and customer_id=c.id;
    return i.status='SENT' and i.due_at=anchor and i.updated_at=(p_guard->>'version')::timestamptz and not i.disputed and i.payment_claimed_at is null
      and not exists(select 1 from public.payments where invoice_id=i.id and voided_at is null);
  elsif p_rule in ('review-request','reactivation') then
    if not r.marketing_approved or c.sms_marketing_consent_at is null then return false; end if;
    select * into i from public.invoices where id=subject_id and customer_id=c.id;
    select * into j from public.jobs where id=i.job_id;
    if i.id is null or i.status<>'PAID' or i.paid_at<>anchor or j.status<>'COMPLETED' or i.disputed then return false; end if;
    if p_rule='review-request' then
      return exists(select 1 from public.control_center_settings where id=1 and review_url like 'https://%')
        and not exists(select 1 from public.sms_outbox o join public.lead_messages m on m.id=o.message_id
          join public.invoices prior on prior.id=(o.guard->>'subject_id')::uuid
          where m.automation_rule_id='review-request' and prior.job_id=j.id
          and o.operation_key<>'job:'||p_rule||':'||subject_id||':'||md5(p_guard->>'anchor')||':'||(p_guard->>'step'));
    end if;
    return not exists(select 1 from public.leads where customer_id=c.id and (status in ('NEW','ACTIVE','QUOTED') or created_at>anchor))
      and not exists(select 1 from public.quotes where customer_id=c.id and status in ('DRAFT','SENT','ACCEPTED'))
      and not exists(select 1 from public.jobs where customer_id=c.id and status in ('SCHEDULED','IN_PROGRESS'))
      and not exists(select 1 from public.invoices where customer_id=c.id and status='SENT')
      and not exists(select 1 from public.sms_outbox o join public.lead_messages m on m.id=o.message_id where m.customer_id=c.id and m.automation_rule_id='reactivation'
        and o.operation_key<>'job:'||p_rule||':'||subject_id||':'||md5(p_guard->>'anchor')||':'||(p_guard->>'step'));
  end if;
  -- Missed calls are intentionally not fabricated without a verified voice API.
  return false;
end $$;

create function public.communication_candidates(p_now timestamptz default now())
returns table(rule_id text,lead_id uuid,subject_type text,subject_id uuid,step integer,due_at timestamptz,guard jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
  with r as (select * from public.communication_runtime where id=1 and scheduled_sending_enabled and activated_at is not null),
  candidates as (
    select 'new-lead'::text rule_id,l.id lead_id,'LEAD'::text subject_type,l.id subject_id,x.step,
      case x.step when 0 then public.sms_business_time(l.created_at) when 1 then public.sms_business_time(l.created_at,4)
        when 2 then public.sms_business_time(((public.sms_business_time(l.created_at,4) at time zone r.timezone)::date+1+make_time(r.business_start_hour,0,0)) at time zone r.timezone)
        else greatest(public.sms_business_time(l.created_at+interval '3 days'),public.sms_business_time(((public.sms_business_time(l.created_at,4) at time zone r.timezone)::date+2+make_time(r.business_start_hour,0,0)) at time zone r.timezone)) end due_at,
      l.created_at anchor,l.updated_at version
    from public.leads l cross join r cross join generate_series(0,3) as x(step) where l.status='NEW' and l.created_at>=r.activated_at
    union all
    select 'quote-follow-up',q.lead_id,'QUOTE',q.id,x.step,
      case x.step when 0 then public.sms_business_time(((q.sent_at at time zone r.timezone)::date+1+make_time(r.business_start_hour,0,0)) at time zone r.timezone)
        when 1 then public.sms_business_time(q.sent_at+interval '3 days') else public.sms_business_time(q.sent_at+interval '7 days') end,q.sent_at,q.updated_at
    from public.quotes q cross join r cross join generate_series(0,2) as x(step) where q.status='SENT' and q.sent_at>=r.activated_at
    union all
    select 'job-reminder',coalesce(q.lead_id,l.id),'JOB',j.id,0,public.sms_business_time(((j.scheduled_date+j.scheduled_time) at time zone r.timezone)-interval '24 hours'),
      (j.scheduled_date+j.scheduled_time) at time zone r.timezone,j.updated_at
    from public.jobs j cross join r left join public.quotes q on q.id=j.quote_id
    left join lateral(select id from public.leads where customer_id=j.customer_id order by created_at desc limit 1) l on true
    where j.status='SCHEDULED' and j.created_at>=r.activated_at and j.scheduled_time is not null and not j.all_day
    union all
    select 'invoice-follow-up',coalesce(jq.lead_id,q.lead_id,l.id),'INVOICE',i.id,x.step,
      public.sms_business_time(i.due_at+make_interval(days=>case x.step when 0 then 0 when 1 then 1 else 3 end)),i.due_at,i.updated_at
    from public.invoices i cross join r left join public.jobs j on j.id=i.job_id left join public.quotes q on q.id=i.quote_id
    left join public.quotes jq on jq.id=j.quote_id
    left join lateral(select id from public.leads where customer_id=i.customer_id order by created_at desc limit 1) l on true
    cross join generate_series(0,2) as x(step) where i.status='SENT' and i.issued_at>=r.activated_at
    union all
    select x.rule_id,coalesce(jq.lead_id,l.id),'INVOICE',i.id,0,
      public.sms_business_time(i.paid_at+make_interval(days=>x.days)),i.paid_at,i.updated_at
    from public.invoices i cross join r join public.jobs j on j.id=i.job_id
    left join public.quotes jq on jq.id=j.quote_id
    left join lateral(select id from public.leads where customer_id=i.customer_id order by created_at desc limit 1) l on true
    cross join (values('review-request',1),('reactivation',60)) as x(rule_id,days)
    where i.status='PAID' and i.paid_at>=r.activated_at and r.marketing_approved
  ), guarded as (
    select c.*,jsonb_build_object('subject_type',c.subject_type,'subject_id',c.subject_id,'anchor',c.anchor,'version',c.version,'step',c.step) guard
    from candidates c where c.lead_id is not null and c.due_at<=p_now and c.due_at>p_now-interval '30 minutes'
  )
  select g.rule_id,g.lead_id,g.subject_type,g.subject_id,g.step,g.due_at,g.guard from guarded g
    where public.sms_automation_guard(g.rule_id,g.lead_id,g.guard,p_now)
      and not exists(select 1 from public.communication_jobs j where j.operation_key=g.rule_id||':'||g.subject_id||':'||md5(g.guard->>'anchor')||':'||g.step)
    order by g.due_at limit 25;
$$;

create function public.plan_communication_jobs() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
  insert into public.communication_jobs(operation_key,kind,lead_id,rule_id,context,due_at,expires_at)
    select rule_id||':'||subject_id||':'||md5(guard->>'anchor')||':'||step,'AUTOMATION',lead_id,rule_id,guard,due_at,due_at+interval '30 minutes'
    from public.communication_candidates() on conflict(operation_key) do nothing;
  get diagnostics n=row_count;
  return n;
end $$;

create function public.claim_communication_job() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.communication_jobs%rowtype;
begin
  update public.communication_jobs set state='FAILED',last_error='Job expired or retry limit reached',updated_at=now()
    where state in ('QUEUED','WORKING') and (lease_until is null or lease_until<now()) and (expires_at<now() or attempts>=2);
  select * into j from public.communication_jobs where due_at<=now() and expires_at>now() and attempts<2
    and (state='QUEUED' or (state='WORKING' and lease_until<now())) order by due_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.communication_jobs set state='WORKING',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
    where id=j.id returning * into j;
  return to_jsonb(j);
end $$;

create function public.communication_job_eligible(p_job_id uuid,p_lease_token uuid) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare j public.communication_jobs%rowtype; l public.leads%rowtype; c public.customers%rowtype; r public.communication_runtime%rowtype; s public.control_center_settings%rowtype;
begin
  select * into j from public.communication_jobs where id=p_job_id;
  select * into l from public.leads where id=j.lead_id;
  select * into c from public.customers where id=l.customer_id;
  select * into r from public.communication_runtime where id=1;
  select * into s from public.control_center_settings where id=1;
  if j.id is null or r.id is null or c.id is null or s.id is null or j.state<>'WORKING' or j.lease_token is distinct from p_lease_token
    or j.lease_until<now() or j.expires_at<=now() or l.human_takeover or c.sms_opted_out_at is not null
    or c.sms_consent_at is null or c.sms_double_opt_in_at is null or s.sms_status not in ('READY','TESTING') then return false; end if;
  if s.sms_status='TESTING' and not exists(select 1 from unnest(r.test_numbers) number where right(number,10)=right(regexp_replace(c.phone,'[^0-9]','','g'),10)) then return false; end if;
  if (select coalesce(sum(cj.attempts),0) from public.communication_jobs cj join public.leads cl on cl.id=cj.lead_id where cl.customer_id=c.id and cj.created_at>now()-interval '1 hour')>12 then return false; end if;
  if j.kind='AI_REPLY' then
    return coalesce(r.ai_sending_enabled and l.conversation_revision=(j.context->>'conversation_revision')::bigint
      and j.trigger_message_id=(select id from public.lead_messages where lead_id=l.id and sender_type='CUSTOMER' order by created_at desc,id desc limit 1),false);
  end if;
  return coalesce(public.sms_automation_guard(j.rule_id,l.id,j.context),false);
end $$;

create function public.finish_communication_job(p_job_id uuid,p_lease_token uuid,p_body text default null,p_template_id text default null,p_error text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.communication_jobs%rowtype; l public.leads%rowtype; c public.customers%rowtype; result jsonb;
begin
  select * into j from public.communication_jobs where id=p_job_id;
  select * into l from public.leads where id=j.lead_id;
  select * into c from public.customers where id=l.customer_id for update;
  select * into l from public.leads where id=j.lead_id for update;
  select * into j from public.communication_jobs where id=p_job_id for update;
  if j.state<>'WORKING' or j.lease_token is distinct from p_lease_token or j.lease_until<now() then return null; end if;
  if p_error is not null or nullif(trim(p_body),'') is null then
    update public.communication_jobs set state='FAILED',last_error=left(coalesce(p_error,'No safe reply'),500),updated_at=now() where id=j.id;
    insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
      values(c.id,'LEAD',l.id,'AI_REQUIRES_HUMAN','Automated communication needs staff review','Communications worker',jsonb_build_object('job_id',j.id,'reason',left(p_error,500)));
    return null;
  end if;
  if j.expires_at<=now() or l.human_takeover or c.sms_opted_out_at is not null or c.sms_double_opt_in_at is null
    or (j.kind='AI_REPLY' and l.conversation_revision<>(j.context->>'conversation_revision')::bigint)
    or not public.communication_job_eligible(j.id,p_lease_token)
    or (j.kind='AUTOMATION' and not coalesce(public.sms_automation_guard(j.rule_id,l.id,j.context),false)) then
    update public.communication_jobs set state='CANCELLED',last_error='Eligibility changed before sending',updated_at=now() where id=j.id;
    return null;
  end if;
  result:=public.enqueue_sms(l.id,p_body,'job:'||j.operation_key,case when j.kind='AI_REPLY' then 'AI' else 'AUTOMATION' end,
    null,p_template_id,j.trigger_message_id,j.rule_id,j.context);
  update public.sms_outbox set expires_at=least(expires_at,j.expires_at) where message_id=(result->>'id')::uuid;
  update public.communication_jobs set state='DONE',lease_until=null,updated_at=now() where id=j.id;
  return result;
end $$;

-- Keep cancelled and ambiguous queue state visible on the existing message UI.
create function public.sync_sms_outbox_status() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.state in ('CANCELLED','REVIEW') and new.state is distinct from old.state then
    update public.lead_messages set provider_status=case when new.state='REVIEW' then 'NEEDS_RECONCILIATION' else 'CANCELLED' end,
      delivery_status=case when new.state='CANCELLED' then 'BLOCKED' else delivery_status end,send_error=new.last_error,updated_at=now() where id=new.message_id;
  end if;
  return new;
end $$;
create trigger sync_sms_outbox_status after update on public.sms_outbox for each row execute function public.sync_sms_outbox_status();

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('sms_business_time','sms_automation_guard','communication_candidates','plan_communication_jobs','claim_communication_job','communication_job_eligible','finish_communication_job','sync_sms_outbox_status') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
