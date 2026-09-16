begin;

alter table public.leads
  add column if not exists route_evidence_fingerprint text,
  add column if not exists route_evidence_miles numeric,
  add column if not exists route_evidence_place_id text,
  add column if not exists route_evidence_calculated_at timestamptz;

comment on column public.leads.route_evidence_fingerprint is
  'Server-owned origin/destination/delivery-settings fingerprint. A mismatch invalidates cached route evidence.';

-- Reserve the one approved first-contact opt-in without enabling human takeover.
-- The inbound inquiry remains the durable source that resumes after YES.
create or replace function public.reserve_inbound_opt_in(
  p_lead_id uuid,p_source_message_id uuid,p_template_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.leads%rowtype; c public.customers%rowtype; source public.lead_messages%rowtype;
  existing public.lead_messages%rowtype; reserved public.lead_messages%rowtype;
  settings public.control_center_settings%rowtype; runtime public.communication_runtime%rowtype;
  digits text; destination text; operation text:='inbound-opt-in:'||p_source_message_id::text;
  body text:='Please reply YES to confirm you want texts about your request and service. Message frequency varies. Message and data rates may apply. Reply HELP for help.';
begin
  if nullif(trim(p_template_id),'') is null then raise exception 'Approved first contact template is missing'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sms-operation:'||operation,0));
  select * into l from public.leads where id=p_lead_id for update;
  select * into c from public.customers where id=l.customer_id for update;
  select * into source from public.lead_messages where id=p_source_message_id and lead_id=l.id and customer_id=c.id
    and sender_type='CUSTOMER' and message_kind='INBOUND';
  if l.id is null or c.id is null or source.id is null then raise exception 'Inbound opt-in context not found'; end if;
  if c.sms_opted_out_at is not null or c.sms_double_opt_in_at is not null then return null; end if;
  select lm.* into existing from public.sms_outbox o join public.lead_messages lm on lm.id=o.message_id
    where lm.customer_id=c.id and o.origin='OPT_IN' and o.state not in ('FAILED','CANCELLED')
      and lm.delivery_status not in ('FAILED','FILTERED','BLOCKED') and o.created_at>now()-interval '7 days'
    order by o.created_at desc limit 1;
  if found then return to_jsonb(existing); end if;
  select * into settings from public.control_center_settings where id=1;
  select * into runtime from public.communication_runtime where id=1;
  digits:=regexp_replace(coalesce(c.phone,''),'[^0-9]','','g');
  destination:=case when length(digits)=10 then '+1'||digits when length(digits)=11 and left(digits,1)='1' then '+'||digits else null end;
  if destination is null or settings.sms_status not in ('READY','TESTING') or settings.business_number is distinct from '+19453750877'
    or runtime.id is null then raise exception 'SMS is not ready for opt-in'; end if;
  if settings.sms_status='TESTING' and not destination=any(runtime.test_numbers) then raise exception 'Number is outside the SMS test allowlist'; end if;
  insert into public.lead_messages(lead_id,customer_id,sender_type,body,delivery_status,provider,provider_status,message_kind,provider_template_id,idempotency_key)
    values(l.id,c.id,'SYSTEM',body,'PENDING','SENT_DM','PENDING','TEMPLATE',trim(p_template_id),operation)
    returning * into reserved;
  insert into public.sms_outbox(message_id,operation_key,origin,payload,conversation_revision,next_attempt_at,trigger_message_id)
    values(reserved.id,operation,'OPT_IN',jsonb_build_object('to',jsonb_build_array(destination),'channel',jsonb_build_array('sms'),
      'template',jsonb_build_object('id',trim(p_template_id),'parameters',jsonb_build_object('message',body))),l.conversation_revision,now(),source.id);
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
    values(c.id,'LEAD',l.id,'SMS_RESERVED','SMS confirmation reserved','Inbound SMS flow',jsonb_build_object('message_id',reserved.id,'source_message_id',source.id,'origin','OPT_IN'));
  return to_jsonb(reserved);
end $$;

revoke all on function public.reserve_inbound_opt_in(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_inbound_opt_in(uuid,uuid,text) to service_role;

create or replace function public.record_inbound_sms(
  p_provider_message_id text,p_phone text,p_body text,p_keyword text default null,p_received_at timestamptz default now()
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v jsonb; c public.customers%rowtype; l public.leads%rowtype; prior_lead public.leads%rowtype;
  m public.lead_messages%rowtype; resume_message public.lead_messages%rowtype; queued_job public.communication_jobs%rowtype;
  keyword text:=nullif(upper(trim(p_keyword)),''); confirmed boolean:=false; needs_opt_in boolean:=false;
  first_reply boolean:=false; target_seconds integer:=0; due_delay integer:=0; new_inquiry boolean:=false;
begin
  if nullif(trim(p_provider_message_id),'') is null or nullif(trim(p_body),'') is null then raise exception 'Inbound message id and body required'; end if;
  if keyword is not null and keyword not in ('STOP','START','HELP') then raise exception 'Unsupported compliance keyword'; end if;
  if p_received_at is null or p_received_at>now()+interval '5 minutes' then raise exception 'Invalid inbound timestamp'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sms-provider:'||p_provider_message_id,0));
  select * into m from public.lead_messages where provider='SENT_DM' and provider_message_id=p_provider_message_id;
  if found then
    select * into queued_job from public.communication_jobs where trigger_message_id=m.id and kind='AI_REPLY' order by created_at desc limit 1;
    return jsonb_build_object('message_id',m.id,'customer_id',m.customer_id,'lead_id',m.lead_id,'inserted',false,'job_id',queued_job.id);
  end if;
  v:=public.resolve_inbound_sms_conversation(p_phone);
  select * into c from public.customers where id=(v->>'customer_id')::uuid for update;
  select * into l from public.leads where id=(v->>'lead_id')::uuid for update;

  -- A clearly new request after a day of inactivity gets a fresh transaction.
  -- The customer identity and old lead/messages remain intact and visible in history.
  if keyword is null and l.last_contact_at is not null and l.last_contact_at<p_received_at-interval '24 hours'
    and lower(p_body) ~ '(i need|i want|looking for|how much|can i get|necesito|quiero|ocupo)'
    and lower(p_body) ~ '(gravel|rock|limestone|sand|dirt|base|driveway|pond|demolition|yard|ton|grava|arena|tierra|caliche)'
    and exists(select 1 from public.lead_messages prior where prior.lead_id=l.id) then
    prior_lead:=l;
    insert into public.leads(customer_id,source,need,status,last_contact_at)
      values(c.id,'Other',left(trim(p_body),1000),'ACTIVE',p_received_at) returning * into l;
    new_inquiry:=true;
    insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
      values(c.id,'LEAD',l.id,'NEW_INQUIRY_STARTED','New customer inquiry started','Inbound SMS flow',jsonb_build_object('previous_lead_id',prior_lead.id));
  end if;

  select * into resume_message from public.lead_messages prior where prior.customer_id=c.id and prior.lead_id=l.id
    and prior.sender_type='CUSTOMER' and prior.message_kind='INBOUND' order by prior.created_at desc,prior.id desc limit 1;
  if keyword is null and upper(trim(p_body)) in ('YES','SI','SÍ') and c.sms_consent_at is not null
    and c.sms_opted_out_at is null and c.sms_opt_in_requested_at<=p_received_at
    and c.sms_opt_in_requested_at>=p_received_at-interval '7 days'
    and exists(select 1 from public.lead_messages where id=c.sms_opt_in_request_message_id
      and provider_message_id is not null and delivery_status in ('QUEUED','ROUTED','SCHEDULED','SENT','DELIVERED','READ')) then keyword:='YES'; end if;
  if keyword='STOP' and (c.sms_consent_updated_at is null or p_received_at>=c.sms_consent_updated_at) then
    update public.customers set sms_opted_out_at=p_received_at,sms_opt_out_source='SENT_DM_STOP',sms_consent_updated_at=p_received_at,
      sms_opt_in_requested_at=null,sms_opt_in_request_message_id=null,updated_at=now() where id=c.id;
  elsif keyword in ('START','YES') and (c.sms_consent_updated_at is null or p_received_at>=c.sms_consent_updated_at) then
    update public.customers set sms_consent_at=coalesce(sms_consent_at,p_received_at),sms_consent_source=coalesce(sms_consent_source,'SENT_DM_'||keyword),
      sms_double_opt_in_at=p_received_at,sms_opted_out_at=null,sms_opt_out_source=null,sms_consent_updated_at=p_received_at,
      sms_opt_in_requested_at=null,sms_opt_in_request_message_id=null,updated_at=now() where id=c.id; confirmed:=true;
  elsif keyword is null and c.sms_consent_at is null then
    update public.customers set sms_consent_at=p_received_at,sms_consent_source='SENT_DM_INBOUND_REQUEST',sms_consent_updated_at=p_received_at,updated_at=now() where id=c.id;
  end if;

  insert into public.lead_messages(lead_id,customer_id,sender_type,body,delivery_status,provider,provider_status,provider_message_id,message_kind,created_at,updated_at)
    values(l.id,c.id,'CUSTOMER',left(trim(p_body),1600),'RECEIVED','SENT_DM','RECEIVED',p_provider_message_id,
      case when keyword is null then 'INBOUND' else 'COMPLIANCE' end,p_received_at,now()) returning * into m;
  update public.leads set conversation_revision=conversation_revision+1,last_contact_at=greatest(last_contact_at,p_received_at),updated_at=now()
    where id=l.id returning * into l;
  update public.communication_jobs set state='CANCELLED',last_error='New inbound message',updated_at=now() where lead_id=l.id and state in ('QUEUED','WORKING');
  update public.sms_outbox o set state='CANCELLED',last_error='New inbound message or consent change',updated_at=now()
    from public.lead_messages lm where o.message_id=lm.id and lm.customer_id=c.id
      and (o.origin in ('AI','AUTOMATION') or keyword='STOP') and o.state in ('QUEUED','RETRY','LEASED');
  if keyword is not null then
    insert into public.sms_consent_events(customer_id,provider_message_id,event_type,keyword,occurred_at)
      values(c.id,p_provider_message_id,case when keyword='STOP' then 'OPT_OUT' when keyword='HELP' then 'HELP' else 'OPT_IN' end,keyword,p_received_at);
  end if;
  select * into c from public.customers where id=c.id;
  needs_opt_in:=keyword is null and c.sms_opted_out_at is null and c.sms_double_opt_in_at is null;
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
    values(c.id,'LEAD',l.id,case when keyword is null then 'SMS_RECEIVED' else 'SMS_'||keyword end,
      case when keyword is null then 'Customer SMS received' else 'Customer sent '||keyword end,'sent.DM webhook',
      jsonb_build_object('provider_message_id',p_provider_message_id,'provider_occurred_at',p_received_at,'webhook_recorded_at',now(),
        'provider_to_record_ms',greatest(0,extract(epoch from (now()-p_received_at))*1000)::bigint,'consent_confirmed',confirmed,
        'awaiting_opt_in',needs_opt_in,'new_inquiry',new_inquiry));

  if (keyword is null or (keyword='YES' and confirmed)) and not l.human_takeover and c.sms_consent_at is not null
    and c.sms_double_opt_in_at is not null and c.sms_opted_out_at is null and p_received_at>=now()-interval '1 hour'
    and exists(select 1 from public.communication_runtime where id=1 and ai_sending_enabled) then
    select not exists(select 1 from public.lead_messages prior where prior.lead_id=l.id and prior.sender_type in ('AI','HUMAN') and prior.message_kind='FREEFORM') into first_reply;
    select initial_response_target_seconds into target_seconds from public.control_center_settings where id=1;
    due_delay:=case when first_reply then greatest(coalesce(target_seconds,0),0) else 0 end;
    insert into public.communication_jobs(operation_key,kind,lead_id,trigger_message_id,context,due_at,expires_at)
      values('reply:'||m.id,'AI_REPLY',l.id,m.id,jsonb_build_object('conversation_revision',l.conversation_revision,'initial_response',first_reply,
        'resume_message_id',case when keyword='YES' and confirmed then resume_message.id else null end),
        now()+make_interval(secs=>due_delay),now()+interval '1 hour') on conflict(operation_key) do nothing returning * into queued_job;
    if queued_job.id is null then select * into queued_job from public.communication_jobs where operation_key='reply:'||m.id; end if;
  end if;
  return jsonb_build_object('message_id',m.id,'customer_id',c.id,'lead_id',l.id,'inserted',true,'consent_confirmed',confirmed,
    'needs_opt_in',needs_opt_in,'new_inquiry',new_inquiry,'job_id',queued_job.id,'resume_message_id',resume_message.id);
end $$;

revoke all on function public.record_inbound_sms(text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_inbound_sms(text,text,text,text,timestamptz) to service_role;

create or replace function public.open_ai_staff_actions() returns setof public.activity_history
language sql stable security definer set search_path=public,pg_temp as $$
 select h.* from public.activity_history h
 join public.leads l on l.id=h.entity_id
 where public.is_admin_or_staff() and h.event_type='AI_ACTION_OPEN'
 and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=h.id::text)
 and (h.metadata->>'kind'<>'QUOTE_READY' or exists(select 1 from public.quotes q where q.id=(h.metadata->>'quote_id')::uuid and q.status='DRAFT' and q.ai_ready_at is not null and q.confirmed_email is not null))
 and (h.metadata->>'kind'<>'HUMAN_REQUEST' or l.human_takeover)
 and (h.metadata->>'kind'<>'PAYMENT_CLAIM' or exists(select 1 from public.invoices i where i.id=(h.metadata->>'invoice_id')::uuid and i.status='SENT' and i.payment_claimed_at is not null))
 order by h.created_at;
$$;
revoke all on function public.open_ai_staff_actions() from public,anon;
grant execute on function public.open_ai_staff_actions() to authenticated;

commit;
