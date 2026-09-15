begin;

alter table public.automation_rules add column setup_reason text, add column enabled_at timestamptz;
alter table public.automation_rules add column verification_subject_id uuid references public.invoices(id), add column verification_until timestamptz;
-- A time-limited, exact-invoice test on the existing test-number allowlist.
-- This does not display ON or enable sending to the customer population.
create function public.automation_rule_enabled(p_rule text,p_lead uuid,p_guard jsonb) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select a.status='ON' or (a.status='SETUP_REQUIRED' and p_rule='invoice-follow-up'
    and a.verification_until>now() and a.verification_until<=now()+interval '30 minutes'
    and a.verification_subject_id::text=p_guard->>'subject_id'
    and exists(select 1 from public.leads l join public.customers c on c.id=l.customer_id
      join public.invoices i on i.id=a.verification_subject_id and i.customer_id=c.id
      cross join public.communication_runtime r where l.id=p_lead and r.id=1
        and exists(select 1 from unnest(r.test_numbers) n where right(regexp_replace(c.phone,'[^0-9]','','g'),10)=right(n,10))))
    from public.automation_rules a where a.id=p_rule),false);
$$;
revoke all on function public.automation_rule_enabled(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.automation_rule_enabled(text,uuid,jsonb) to service_role;
do $$ declare definition text; begin
  select pg_get_functiondef('public.sms_automation_guard(text,uuid,jsonb,timestamptz)'::regprocedure) into definition;
  if position('exists(select 1 from public.automation_rules where id=p_rule and status=''ON'')' in definition)=0 then raise exception 'Automation guard requires review'; end if;
  execute replace(definition,'exists(select 1 from public.automation_rules where id=p_rule and status=''ON'')','public.automation_rule_enabled(p_rule,p_lead_id,p_guard)');
  select pg_get_functiondef('public.enqueue_sms(uuid,text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure) into definition;
  if position('exists(select 1 from public.automation_rules where id=p_rule_id and status=''ON'')' in definition)=0 then raise exception 'Reservation gate requires review'; end if;
  execute replace(definition,'exists(select 1 from public.automation_rules where id=p_rule_id and status=''ON'')','public.automation_rule_enabled(p_rule_id,p_lead_id,p_guard)');
  select pg_get_functiondef('public.authorize_sms_dispatch(uuid,uuid)'::regprocedure) into definition;
  if position('exists(select 1 from public.automation_rules where id=m.automation_rule_id and status=''ON'')' in definition)=0 then raise exception 'Dispatch gate requires review'; end if;
  execute replace(definition,'exists(select 1 from public.automation_rules where id=m.automation_rule_id and status=''ON'')','public.automation_rule_enabled(m.automation_rule_id,l.id,o.guard)');
end $$;
update public.automation_rules set setup_reason=case id
  when 'invoice-follow-up' then 'Implementation installed; deployed end-to-end verification required before enabling.'
  when 'review-request' then 'Verified review URL and messaging campaign coverage are missing; marketing gate remains closed.'
  when 'reactivation' then 'Promotional reactivation is not covered by verified marketing approval. Explicit marketing consent is also required.'
  when 'missed-call' then 'No verified inbound voice or missed-call event integration for the sent.DM number. Calling capability and signed event contract must be verified.' end
where id in ('invoice-follow-up','review-request','reactivation','missed-call') and status='SETUP_REQUIRED';

-- Keep the existing rules and guards intact; additional requirements apply
-- only to the unfinished follow-ups. No status/marketing gate is opened here.
alter function public.sms_automation_guard(text,uuid,jsonb,timestamptz) rename to sms_automation_guard_baseline;
create function public.sms_automation_guard(p_rule text,p_lead_id uuid,p_guard jsonb,p_now timestamptz default now()) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare i public.invoices%rowtype; j public.jobs%rowtype; due timestamptz; step integer; activated timestamptz;
begin
  if not coalesce(public.sms_automation_guard_baseline(p_rule,p_lead_id,p_guard,p_now),false) then return false; end if;
  if p_rule not in ('invoice-follow-up','review-request','reactivation') then return true; end if;
  select * into i from public.invoices where id=(p_guard->>'subject_id')::uuid;
  select enabled_at into activated from public.automation_rules where id=p_rule;
  step:=(p_guard->>'step')::integer;
  if i.id is null or step is null then return false; end if;
  if p_rule='invoice-follow-up' then
    if step not between 0 and 2 or i.due_at is null or i.amount<=0 then return false; end if;
    due:=public.sms_business_time(i.due_at+make_interval(days=>case step when 0 then 0 when 1 then 1 else 3 end));
    -- Weekend adjustments may collapse two reminders onto Monday. Send only
    -- the latest due step, never a burst of overdue reminders.
    if exists(select 1 from generate_series(step+1,2) s where
      public.sms_business_time(i.due_at+make_interval(days=>case s when 1 then 1 else 3 end))<=p_now) then return false; end if;
    if exists(select 1 from public.lead_messages where customer_id=i.customer_id and sender_type in ('CUSTOMER','HUMAN')
      and message_kind is distinct from 'COMPLIANCE' and created_at>i.issued_at) then return false; end if;
  else
    select * into j from public.jobs where id=i.job_id and customer_id=i.customer_id;
    if step<>0 or j.id is null or j.completed_at is null or i.paid_at is null
      or (select coalesce(sum(amount),0) from public.payments where invoice_id=i.id and customer_id=i.customer_id
        and voided_at is null and confirmed_by in ('HUMAN','PROCESSOR'))<i.amount then return false; end if;
    due:=public.sms_business_time(greatest(i.paid_at,j.completed_at)+case p_rule when 'review-request' then interval '24 hours' else interval '60 days' end);
    if p_rule='reactivation' and (exists(select 1 from public.invoices where customer_id=i.customer_id and paid_at>i.paid_at and status='PAID')
      or exists(select 1 from public.lead_messages where customer_id=i.customer_id and sender_type in ('CUSTOMER','HUMAN')
        and message_kind is distinct from 'COMPLIANCE' and created_at>greatest(i.paid_at,j.completed_at))) then return false; end if;
  end if;
  return due<=p_now and due>p_now-interval '30 minutes' and (activated is null or due>=activated);
end $$;

alter function public.communication_candidates(timestamptz) rename to communication_candidates_baseline;
create function public.communication_candidates(p_now timestamptz default now())
returns table(rule_id text,lead_id uuid,subject_type text,subject_id uuid,step integer,due_at timestamptz,guard jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
  with paid as (
    select x.rule_id,coalesce(q.lead_id,l.id) lead_id,'INVOICE'::text subject_type,i.id subject_id,0 step,
      public.sms_business_time(greatest(i.paid_at,j.completed_at)+make_interval(days=>x.days)) due_at,
      jsonb_build_object('subject_type','INVOICE','subject_id',i.id,'anchor',i.paid_at,'version',i.updated_at,'step',0) guard
    from public.invoices i join public.jobs j on j.id=i.job_id and j.customer_id=i.customer_id
    cross join public.communication_runtime r left join public.quotes q on q.id=j.quote_id
    left join lateral(select id from public.leads where customer_id=i.customer_id order by created_at desc,id desc limit 1) l on true
    cross join (values('review-request',1),('reactivation',60)) x(rule_id,days)
    where r.id=1 and r.scheduled_sending_enabled and r.marketing_approved and i.status='PAID'
      and i.paid_at>=r.activated_at and j.status='COMPLETED' and j.completed_at is not null
  ), candidates as (
    select * from public.communication_candidates_baseline(p_now) where rule_id not in ('review-request','reactivation')
    union all
    select p.* from paid p where public.sms_automation_guard(p.rule_id,p.lead_id,p.guard,p_now)
      and not exists(select 1 from public.communication_jobs cj where cj.operation_key=p.rule_id||':'||p.subject_id||':'||md5(p.guard->>'anchor')||':0')
  ) select * from candidates order by due_at limit 25;
$$;

-- Immediate local cancellation on authoritative payment/invoice changes.
-- Already submitted provider messages cannot be recalled; final dispatch also
-- rechecks the invoice guard before initiating any provider request.
create function public.cancel_invoice_communications() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare invoice_id uuid;
begin
  if tg_table_name='payments' then invoice_id:=new.invoice_id;
  else
    invoice_id:=new.id;
    if new.status='SENT' and not new.disputed and new.payment_claimed_at is null
      and new.due_at is not distinct from old.due_at and new.amount is not distinct from old.amount then return new; end if;
  end if;
  update public.communication_jobs set state='CANCELLED',last_error='Invoice or payment changed',updated_at=now()
    where rule_id='invoice-follow-up' and context->>'subject_id'=invoice_id::text and state in ('QUEUED','WORKING');
  update public.sms_outbox o set state='CANCELLED',last_error='Invoice or payment changed',updated_at=now()
    from public.lead_messages m where m.id=o.message_id and m.automation_rule_id='invoice-follow-up'
      and o.guard->>'subject_id'=invoice_id::text and o.state in ('QUEUED','LEASED') and o.first_attempt_at is null;
  return new;
end $$;
create trigger cancel_invoice_followups after update on public.invoices for each row execute function public.cancel_invoice_communications();
create trigger cancel_paid_followups after insert or update on public.payments for each row execute function public.cancel_invoice_communications();

create function public.audit_scheduled_communication() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare customer uuid;
begin
  if new.kind<>'AUTOMATION' or new.state is not distinct from old.state then return new; end if;
  select customer_id into customer from public.leads where id=new.lead_id;
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
    values(customer,coalesce(new.context->>'subject_type','LEAD'),(new.context->>'subject_id')::uuid,
      'AUTOMATION_'||new.state,new.rule_id||': '||lower(new.state),'Communications worker',
      jsonb_build_object('job_id',new.id,'rule_id',new.rule_id,'step',new.context->'step','reason',new.last_error,'due_at',new.due_at));
  return new;
end $$;
create trigger audit_scheduled_communication after update on public.communication_jobs for each row execute function public.audit_scheduled_communication();

create unique index invoice_followup_message_audit on public.activity_history((metadata->>'message_id'))
  where event_type='INVOICE_FOLLOW_UP_SENT';
create function public.audit_invoice_followup_delivery() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.sms_outbox%rowtype;
begin
  if new.automation_rule_id<>'invoice-follow-up' or new.delivery_status not in ('SENT','DELIVERED')
    or new.delivery_status is not distinct from old.delivery_status then return new; end if;
  select * into o from public.sms_outbox where message_id=new.id;
  if o.message_id is null then return new; end if;
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
    values(new.customer_id,'INVOICE',(o.guard->>'subject_id')::uuid,'INVOICE_FOLLOW_UP_SENT',
      case when o.guard->>'step'='2' then 'Final invoice reminder sent; unpaid balance needs staff follow up' else 'Invoice reminder sent' end,
      'Communications worker',jsonb_build_object('message_id',new.id,'step',o.guard->'step','final',o.guard->>'step'='2'))
    on conflict do nothing;
  return new;
end $$;
create trigger audit_invoice_followup_delivery after update on public.lead_messages for each row execute function public.audit_invoice_followup_delivery();
revoke all on function public.audit_invoice_followup_delivery() from public,anon,authenticated;

revoke all on function public.sms_automation_guard(text,uuid,jsonb,timestamptz),public.communication_candidates(timestamptz),public.cancel_invoice_communications(),public.audit_scheduled_communication() from public,anon,authenticated;
grant execute on function public.sms_automation_guard(text,uuid,jsonb,timestamptz),public.communication_candidates(timestamptz) to service_role;
commit;