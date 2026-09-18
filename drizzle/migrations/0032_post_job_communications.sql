begin;

-- The invoice notice belongs to the same staff-initiated transaction as the
-- email. The accepted email log is the source of truth for both the recipient
-- shown in the SMS and its idempotency key.
create or replace function public.queue_invoice_email_notification(
  p_log_id uuid,
  p_actor_id uuid,
  p_template_id text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  email_log public.email_send_log%rowtype;
  invoice_row public.invoices%rowtype;
  lead_id uuid;
  reserved jsonb;
  body text;
  reason text;
begin
  if auth.role()<>'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into email_log from public.email_send_log where id=p_log_id for update;
  if email_log.id is null or email_log.template_type<>'INVOICE_READY'
    or email_log.invoice_id is null or email_log.status<>'accepted_by_provider' then
    return jsonb_build_object('status','SKIPPED','reason','Invoice email has not been accepted by the provider');
  end if;
  select * into invoice_row from public.invoices where id=email_log.invoice_id and customer_id=email_log.customer_id;
  if invoice_row.id is null then
    return jsonb_build_object('status','SKIPPED','reason','Invoice or customer no longer matches the accepted email');
  end if;
  select coalesce(job_quote.lead_id,invoice_quote.lead_id,recent_lead.id) into lead_id
  from public.invoices i
  left join public.jobs j on j.id=i.job_id
  left join public.quotes job_quote on job_quote.id=j.quote_id
  left join public.quotes invoice_quote on invoice_quote.id=i.quote_id
  left join lateral(
    select l.id from public.leads l where l.customer_id=i.customer_id
    order by l.created_at desc,l.id desc limit 1
  ) recent_lead on true
  where i.id=invoice_row.id;
  if lead_id is null then
    reason:='No customer conversation exists for this invoice';
    insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_id,actor_label,metadata)
    values(email_log.customer_id,'INVOICE',email_log.invoice_id,'INVOICE_EMAIL_NOTICE_SKIPPED',reason,p_actor_id,'Invoice email workflow',
      jsonb_build_object('email_log_id',email_log.id,'recipient_email',email_log.recipient_email,'reason',reason))
    on conflict do nothing;
    return jsonb_build_object('status','SKIPPED','reason',reason);
  end if;
  if email_log.recipient_email is null or trim(email_log.recipient_email)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    reason:='Accepted invoice email recipient is invalid';
    return jsonb_build_object('status','SKIPPED','reason',reason);
  end if;
  body:='we just sent your invoice to '||lower(trim(email_log.recipient_email))||'. please check your inbox.';
  begin
    reserved:=public.enqueue_sms(
      lead_id,body,'invoice-email-notice:'||email_log.id::text,'HUMAN',p_actor_id,p_template_id,null,null,
      jsonb_build_object('subject_type','INVOICE','subject_id',invoice_row.id,'email_log_id',email_log.id,'recipient_email',lower(trim(email_log.recipient_email)))
    );
    insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_id,actor_label,metadata)
    values(email_log.customer_id,'INVOICE',email_log.invoice_id,'INVOICE_EMAIL_NOTICE_QUEUED',
      'Invoice email notification queued for SMS',p_actor_id,'Invoice email workflow',
      jsonb_build_object('email_log_id',email_log.id,'recipient_email',lower(trim(email_log.recipient_email)),'message_id',reserved->>'id'))
    on conflict do nothing;
    return jsonb_build_object('status','QUEUED','message_id',reserved->>'id','recipient_email',lower(trim(email_log.recipient_email)));
  exception when others then
    reason:=left(sqlerrm,500);
    insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_id,actor_label,metadata)
    values(email_log.customer_id,'INVOICE',email_log.invoice_id,'INVOICE_EMAIL_NOTICE_SKIPPED',
      'Invoice email succeeded; SMS notice was not eligible',p_actor_id,'Invoice email workflow',
      jsonb_build_object('email_log_id',email_log.id,'recipient_email',lower(trim(email_log.recipient_email)),'reason',reason))
    on conflict do nothing;
    return jsonb_build_object('status','SKIPPED','reason',reason,'recipient_email',lower(trim(email_log.recipient_email)));
  end;
end $$;

create unique index if not exists invoice_email_notice_queued_once
  on public.activity_history((metadata->>'email_log_id')) where event_type='INVOICE_EMAIL_NOTICE_QUEUED';
create unique index if not exists invoice_email_notice_skip_once
  on public.activity_history((metadata->>'email_log_id')) where event_type='INVOICE_EMAIL_NOTICE_SKIPPED';

revoke all on function public.queue_invoice_email_notification(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.queue_invoice_email_notification(uuid,uuid,text) to service_role;

-- Review requests are post-payment service messages in this workflow. Remove
-- only the application's marketing-approval gate; consent, double opt-in,
-- opt-out, human takeover, business hours, provider status and duplicate
-- protections remain enforced by enqueue_sms and authorize_sms_dispatch.
do $$ declare definition text; begin
  select pg_get_functiondef('public.enqueue_sms(uuid,text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure) into definition;
  if position('p_rule_id in (''review-request'',''reactivation'')' in definition)=0 then
    raise exception 'enqueue_sms marketing gate requires review';
  end if;
  execute replace(definition,
    'p_rule_id in (''review-request'',''reactivation'')',
    'p_rule_id=''reactivation''');

  select pg_get_functiondef('public.authorize_sms_dispatch(uuid,uuid)'::regprocedure) into definition;
  if position('m.automation_rule_id in (''reactivation'',''review-request'')' in definition)=0 then
    raise exception 'authorize_sms_dispatch marketing gate requires review';
  end if;
  execute replace(definition,
    'm.automation_rule_id in (''reactivation'',''review-request'')',
    'm.automation_rule_id=''reactivation''');
end $$;

alter function public.sms_automation_guard(text,uuid,jsonb,timestamptz) rename to sms_automation_guard_before_post_job;
create function public.sms_automation_guard(p_rule text,p_lead_id uuid,p_guard jsonb,p_now timestamptz default now()) returns boolean
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
  due:=public.sms_business_time(greatest(i.paid_at,j.completed_at)+interval '24 hours');
  if due is null or due>p_now or due<=p_now-interval '30 minutes' or (enabled is not null and due<enabled) then return false; end if;
  return not exists(
    select 1 from public.sms_outbox o
    join public.lead_messages m on m.id=o.message_id
    join public.invoices prior on prior.id=(o.guard->>'subject_id')::uuid
    where m.automation_rule_id='review-request' and prior.job_id=j.id
      and o.operation_key<>'job:'||p_rule||':'||subject_id||':'||md5(p_guard->>'anchor')||':'||(p_guard->>'step')
  );
end $$;

alter function public.communication_candidates(timestamptz) rename to communication_candidates_before_post_job;
create function public.communication_candidates(p_now timestamptz default now())
returns table(rule_id text,lead_id uuid,subject_type text,subject_id uuid,step integer,due_at timestamptz,guard jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
  with reviews as (
    select 'review-request'::text rule_id,coalesce(q.lead_id,l.id) lead_id,'INVOICE'::text subject_type,i.id subject_id,0 step,
      public.sms_business_time(greatest(i.paid_at,j.completed_at)+interval '24 hours') due_at,
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

create or replace function public.sync_review_request_rule() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare valid boolean:=new.review_url is not null and trim(new.review_url)~'^https://[^[:space:]]+$';
begin
  update public.automation_rules set
    status=case when valid then 'ON' else 'SETUP_REQUIRED' end,
    setup_reason=case when valid then null else 'Add a valid HTTPS Google review link in Communication & AI settings.' end,
    enabled_at=case when valid and status<>'ON' then now() when valid then enabled_at else null end,
    updated_at=now()
  where id='review-request';
  return new;
end $$;

drop trigger if exists sync_review_request_rule on public.control_center_settings;
create trigger sync_review_request_rule after insert or update of review_url on public.control_center_settings
for each row execute function public.sync_review_request_rule();

update public.automation_rules set
  status=case when exists(select 1 from public.control_center_settings where id=1 and trim(review_url)~'^https://[^[:space:]]+$') then 'ON' else 'SETUP_REQUIRED' end,
  setup_reason=case when exists(select 1 from public.control_center_settings where id=1 and trim(review_url)~'^https://[^[:space:]]+$') then null else 'Add a valid HTTPS Google review link in Communication & AI settings.' end,
  enabled_at=case when exists(select 1 from public.control_center_settings where id=1 and trim(review_url)~'^https://[^[:space:]]+$') and status<>'ON' then now()
    when exists(select 1 from public.control_center_settings where id=1 and trim(review_url)~'^https://[^[:space:]]+$') then enabled_at else null end,
  updated_at=now()
where id='review-request';

-- Keep the historical definition and audit rows, but remove reactivation from
-- every active execution path and cancel only work that has not reached a provider.
update public.automation_rules set status='OFF',setup_reason=null,enabled_at=null,updated_at=now() where id='reactivation';
update public.communication_jobs set state='CANCELLED',last_error='60 day SMS reactivation was retired',updated_at=now()
where rule_id='reactivation' and state in ('QUEUED','WORKING');
update public.sms_outbox o set state='CANCELLED',last_error='60 day SMS reactivation was retired',updated_at=now()
from public.lead_messages m where m.id=o.message_id and m.automation_rule_id='reactivation'
  and o.state in ('QUEUED','RETRY','LEASED') and o.first_attempt_at is null;

update public.automation_rules set
  trigger_description='A completed job has a fully confirmed paid invoice',
  delay_description='About 24 hours after confirmed payment',
  action_description='Send one short thank you with the configured Google review link',
  setup_reason=case when status='SETUP_REQUIRED' then 'Add a valid HTTPS Google review link in Communication & AI settings.' else null end,
  updated_at=now()
where id='review-request';

create unique index if not exists review_request_delivery_audit_once
  on public.activity_history((metadata->>'message_id')) where event_type='REVIEW_REQUEST_SENT';
create or replace function public.audit_review_request_delivery() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare outbox public.sms_outbox%rowtype; invoice_row public.invoices%rowtype;
begin
  if new.automation_rule_id<>'review-request' or new.delivery_status not in ('SENT','DELIVERED')
    or new.delivery_status is not distinct from old.delivery_status then return new; end if;
  select * into outbox from public.sms_outbox where message_id=new.id;
  if outbox.message_id is null then return new; end if;
  select * into invoice_row from public.invoices where id=(outbox.guard->>'subject_id')::uuid;
  if invoice_row.id is null or invoice_row.job_id is null then return new; end if;
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
  values(new.customer_id,'JOB',invoice_row.job_id,'REVIEW_REQUEST_SENT','Google review request sent','Communications worker',
    jsonb_build_object('message_id',new.id,'invoice_id',invoice_row.id,'delivery_status',new.delivery_status))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists audit_review_request_delivery on public.lead_messages;
create trigger audit_review_request_delivery after update on public.lead_messages
for each row execute function public.audit_review_request_delivery();

revoke all on function public.sms_automation_guard(text,uuid,jsonb,timestamptz),public.communication_candidates(timestamptz),
  public.sync_review_request_rule(),public.audit_review_request_delivery() from public,anon,authenticated;
grant execute on function public.sms_automation_guard(text,uuid,jsonb,timestamptz),public.communication_candidates(timestamptz) to service_role;

commit;