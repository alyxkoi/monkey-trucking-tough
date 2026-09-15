-- Align follow-up scheduling with the immediate inbound AI path. This migration
-- changes no production sending gate and creates no historical catch-up work.
do $$
begin
  if to_regclass('public.materials') is not null then
    execute $sql$
      update public.materials
      set tons_conversion_note = 'Loose material operating estimate. Customer conversations and quotes stay in yards; ton requests include the approved one yard reserve.',
          updated_at = now()
      where tons_conversion_basis = 'OPERATIONAL_ESTIMATE'
        and not tons_conversion_verified
    $sql$;
  end if;
end $$;

update public.automation_rules
set delay_description = 'About 4 business hours, next business day, then about 3 days after the immediate AI reply',
    action_description = 'Continue the open intake by asking only for the next missing piece of information',
    updated_at = now()
where id = 'new-lead';

create or replace function public.sms_automation_guard(p_rule text,p_lead_id uuid,p_guard jsonb,p_now timestamptz default now()) returns boolean
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
      -- The website request or first direct text is the initial inbound. A
      -- second customer message stops every remaining lead follow-up.
      and (select count(*) from public.lead_messages where lead_id=l.id and sender_type='CUSTOMER' and message_kind='INBOUND')<=1
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
  return false;
end $$;

create or replace function public.communication_candidates(p_now timestamptz default now())
returns table(rule_id text,lead_id uuid,subject_type text,subject_id uuid,step integer,due_at timestamptz,guard jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
  with r as (select * from public.communication_runtime where id=1 and scheduled_sending_enabled and activated_at is not null),
  candidates as (
    -- Step zero belongs to the immediate inbound AI pipeline. Scheduled lead
    -- follow-up begins at step one so one inquiry can never produce two first replies.
    select 'new-lead'::text rule_id,l.id lead_id,'LEAD'::text subject_type,l.id subject_id,x.step,
      case x.step when 1 then public.sms_business_time(l.created_at,4)
        when 2 then public.sms_business_time(((public.sms_business_time(l.created_at,4) at time zone r.timezone)::date+1+make_time(r.business_start_hour,0,0)) at time zone r.timezone)
        else greatest(public.sms_business_time(l.created_at+interval '3 days'),public.sms_business_time(((public.sms_business_time(l.created_at,4) at time zone r.timezone)::date+2+make_time(r.business_start_hour,0,0)) at time zone r.timezone)) end due_at,
      l.created_at anchor,l.updated_at version
    from public.leads l cross join r cross join generate_series(1,3) as x(step) where l.status='NEW' and l.created_at>=r.activated_at
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