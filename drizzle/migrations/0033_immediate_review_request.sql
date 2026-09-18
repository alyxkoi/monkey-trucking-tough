begin;

-- Review requests become due as soon as both the job is complete and the
-- invoice is fully paid. sms_business_time still preserves the configured
-- messaging window, and the existing guard continues to enforce consent,
-- payment confirmation, takeover, dispute, and one-send protections.
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
  if anchor is null or subject_id is null or r.activated_at is null or anchor<r.activated_at then return false; end if;
  select * into i from public.invoices where id=subject_id and customer_id=c.id;
  select * into j from public.jobs where id=i.job_id and customer_id=c.id;
  if i.id is null or i.status<>'PAID' or i.paid_at<>anchor or i.disputed or i.payment_claimed_at is not null
    or j.id is null or j.status<>'COMPLETED' or j.completed_at is null or (p_guard->>'step')::integer<>0 then return false; end if;
  if (select coalesce(sum(amount),0) from public.payments where invoice_id=i.id and customer_id=i.customer_id
    and voided_at is null and confirmed_by in ('HUMAN','PROCESSOR'))<i.amount then return false; end if;
  if not exists(select 1 from public.control_center_settings where id=1
    and trim(review_url)~'^https://[^[:space:]]+$') then return false; end if;
  due:=public.sms_business_time(greatest(i.paid_at,j.completed_at));
  if due is null or due>p_now or due<=p_now-interval '30 minutes' or (enabled is not null and due<enabled) then return false; end if;
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
      public.sms_business_time(greatest(i.paid_at,j.completed_at)) due_at,
      jsonb_build_object('subject_type','INVOICE','subject_id',i.id,'anchor',i.paid_at,'version',i.updated_at,'step',0) guard
    from public.invoices i
    join public.jobs j on j.id=i.job_id and j.customer_id=i.customer_id
    cross join public.communication_runtime r
    left join public.quotes q on q.id=j.quote_id
    left join lateral(select id from public.leads where customer_id=i.customer_id order by created_at desc,id desc limit 1) l on true
    where r.id=1 and r.scheduled_sending_enabled and i.status='PAID' and i.paid_at is not null
      and i.paid_at>=r.activated_at and j.status='COMPLETED' and j.completed_at is not null
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

commit;
