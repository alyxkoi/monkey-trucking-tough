begin;
alter table public.invoices add column if not exists review_eligible_at timestamptz;

-- Durable completion/payment eligibility; no internal business-hours delay.
create or replace function public.sms_automation_guard(p_rule text,p_lead_id uuid,p_guard jsonb,p_now timestamptz default now()) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  l public.leads%rowtype; c public.customers%rowtype; i public.invoices%rowtype; j public.jobs%rowtype;
  r public.communication_runtime%rowtype; due timestamptz; anchor timestamptz; subject_id uuid; enabled timestamptz;
begin
  if p_rule='reactivation' then return false; end if;
  if p_rule<>'review-request' then
    return coalesce(public.sms_automation_guard_before_post_job(p_rule,p_lead_id,p_guard,p_now),false);
  end if;
  select * into l from public.leads where id=p_lead_id;
  select * into c from public.customers where id=l.customer_id;
  select * into r from public.communication_runtime where id=1;
  if l.id is null or c.id is null or r.id is null or l.human_takeover
    or c.sms_opted_out_at is not null or c.sms_consent_at is null or c.sms_double_opt_in_at is null
    or not r.scheduled_sending_enabled or not public.automation_rule_enabled(p_rule,p_lead_id,p_guard) then return false; end if;
  if exists(select 1 from public.leads where customer_id=c.id and human_takeover)
    or exists(select 1 from public.jobs where customer_id=c.id and (blocked_reason is not null or change_requested))
    or exists(select 1 from public.invoices where customer_id=c.id and (disputed or payment_claimed_at is not null)) then return false; end if;
  anchor:=(p_guard->>'anchor')::timestamptz;
  subject_id:=(p_guard->>'subject_id')::uuid;
  select enabled_at into enabled from public.automation_rules where id=p_rule;
  if anchor is null or subject_id is null or r.activated_at is null then return false; end if;
  select * into i from public.invoices where id=subject_id and customer_id=c.id;
  select * into j from public.jobs where id=i.job_id and customer_id=c.id;
  if i.id is null or i.status<>'PAID' or i.paid_at<>anchor or i.disputed or i.payment_claimed_at is not null
    or j.id is null or j.status<>'COMPLETED' or j.completed_at is null or (p_guard->>'step')::integer<>0 then return false; end if;
  if (select coalesce(sum(amount),0) from public.payments where invoice_id=i.id and customer_id=i.customer_id
    and voided_at is null and confirmed_by in ('HUMAN','PROCESSOR'))<i.amount then return false; end if;
  if not exists(select 1 from public.control_center_settings where id=1
    and trim(review_url)~'^https://[^[:space:]]+$') then return false; end if;
  due:=coalesce(i.review_eligible_at,greatest(i.paid_at,j.completed_at));
  if due is null or due<r.activated_at or due>p_now or (enabled is not null and due<enabled) then return false; end if;
  return not exists(
    select 1 from public.sms_outbox o
    join public.lead_messages m on m.id=o.message_id
    join public.invoices prior on prior.id=(o.guard->>'subject_id')::uuid
    where m.automation_rule_id='review-request' and prior.job_id=j.id
      and o.operation_key<>'job:'||p_rule||':'||subject_id||':'||md5(p_guard->>'anchor')||':'||(p_guard->>'step')
  );
end $$;

create or replace function public.communication_candidates(p_now timestamptz default now())
returns table(rule_id text,lead_id uuid,subject_type text,subject_id uuid,step integer,due_at timestamptz,guard jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
  with reviews as (
    select 'review-request'::text rule_id,coalesce(q.lead_id,l.id) lead_id,'INVOICE'::text subject_type,i.id subject_id,0 step,
      coalesce(i.review_eligible_at,greatest(i.paid_at,j.completed_at)) due_at,
      jsonb_build_object('subject_type','INVOICE','subject_id',i.id,'anchor',i.paid_at,'version',i.updated_at,'step',0) guard
    from public.invoices i
    join public.jobs j on j.id=i.job_id and j.customer_id=i.customer_id
    cross join public.communication_runtime r
    left join public.quotes q on q.id=j.quote_id
    left join lateral(select id from public.leads where customer_id=i.customer_id order by created_at desc,id desc limit 1) l on true
    where r.id=1 and r.scheduled_sending_enabled and i.status='PAID' and i.paid_at is not null
      and i.review_eligible_at>=r.activated_at and j.status='COMPLETED' and j.completed_at is not null
  ), candidates as (
    select * from public.communication_candidates_before_post_job(p_now) where rule_id not in ('review-request','reactivation')
    union all
    select review.* from reviews review
    where review.lead_id is not null and public.sms_automation_guard(review.rule_id,review.lead_id,review.guard,p_now)
      and not exists(select 1 from public.communication_jobs cj
        where cj.operation_key=review.rule_id||':'||review.subject_id||':'||md5(review.guard->>'anchor')||':0')
  ) select * from candidates order by due_at limit 25;
$$;

update public.automation_rules set
  trigger_description='A completed job has a fully confirmed paid invoice',
  delay_description='Immediately after full confirmed payment',
  action_description='Send one short thank you with the configured Google review link',
  updated_at=now()
where id='review-request';

revoke all on function public.sms_automation_guard(text,uuid,jsonb,timestamptz),public.communication_candidates(timestamptz) from public,anon,authenticated;
grant execute on function public.sms_automation_guard(text,uuid,jsonb,timestamptz),public.communication_candidates(timestamptz) to service_role;


-- Both transition orders converge on this one persisted eligibility timestamp.
-- No historical paid invoices are backfilled into a surprise review campaign.
create function public.stamp_review_eligibility() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='PAID' and new.job_id is not null and new.review_eligible_at is null
 and exists(select 1 from public.jobs where id=new.job_id and customer_id=new.customer_id and status='COMPLETED' and completed_at is not null)
 and (select coalesce(sum(amount),0) from public.payments where invoice_id=new.id and customer_id=new.customer_id and voided_at is null and confirmed_by in ('HUMAN','PROCESSOR'))>=new.amount
 then new.review_eligible_at:=now(); end if;
 return new;
end $$;
create trigger stamp_review_eligibility before insert or update on public.invoices for each row execute function public.stamp_review_eligibility();

create function public.completed_job_review_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='COMPLETED' and (tg_op='INSERT' or old.status is distinct from new.status or old.completed_at is distinct from new.completed_at) then
   update public.invoices set updated_at=now() where job_id=new.id and status='PAID' and review_eligible_at is null;
 end if;
 return new;
end $$;
create trigger completed_job_review_event after insert or update on public.jobs for each row execute function public.completed_job_review_event();

-- Keep every other dispatch restriction. Only the internal quiet-hours rule
-- excludes review requests. Provider rejection still follows the audited path.
do $$ declare definition text; begin
 select pg_get_functiondef('public.authorize_sms_dispatch(uuid,uuid)'::regprocedure) into definition;
 if position('when o.origin=''AUTOMATION'' and public.sms_business_time(now())>now()' in definition)=0 then raise exception 'Review quiet-hours patch requires audit'; end if;
 execute replace(definition,'when o.origin=''AUTOMATION'' and public.sms_business_time(now())>now()',
 'when o.origin=''AUTOMATION'' and m.automation_rule_id is distinct from ''review-request'' and public.sms_business_time(now())>now()');
 select pg_get_functiondef('public.plan_communication_jobs()'::regprocedure) into definition;
 if position('due_at+interval ''30 minutes''' in definition)=0 then raise exception 'Planner expiry patch requires audit'; end if;
 execute replace(definition,'due_at+interval ''30 minutes''','case when rule_id=''review-request'' then now()+interval ''1 day'' else due_at+interval ''30 minutes'' end');
end $$;

-- Queue in the payment/completion transaction, then existing 10-second worker
-- handles transport. No browser needs to stay open and no model call is needed.
create function public.plan_review_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.review_eligible_at is not null and (tg_op='INSERT' or old.review_eligible_at is distinct from new.review_eligible_at) then
  begin
   perform public.plan_communication_jobs();
  exception when others then
   -- Eligibility remains durable for the existing worker to retry. A scheduler
   -- failure must never undo a confirmed payment or job completion.
   insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,metadata,actor_label)
   values(new.customer_id,'INVOICE',new.id,'REVIEW_QUEUE_RETRY','Review eligible; scheduler will retry',jsonb_build_object('error',sqlerrm,'sqlstate',sqlstate),'System');
  end;
 end if;
 return new;
end $$;
create trigger plan_review_event after insert or update on public.invoices for each row execute function public.plan_review_event();
revoke all on function public.stamp_review_eligibility(),public.completed_job_review_event(),public.plan_review_event() from public,anon,authenticated;
commit;
