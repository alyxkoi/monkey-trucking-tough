begin;

-- The worker runs once per minute. This target is used to make the first
-- response eligible early enough to land within the selected minute target.
-- Ongoing conversation replies retain the existing fast cadence.
alter table public.control_center_settings
  add column if not exists initial_response_target_seconds integer not null default 60
    check (initial_response_target_seconds between 60 and 600);

comment on column public.control_center_settings.initial_response_target_seconds is
  'Target maximum wait for the first automated response. The minute worker may send sooner.';

create or replace function public.record_inbound_sms(
  p_provider_message_id text,p_phone text,p_body text,p_keyword text default null,p_received_at timestamptz default now()
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v jsonb; c public.customers%rowtype; l public.leads%rowtype; m public.lead_messages%rowtype;
  keyword text:=nullif(upper(trim(p_keyword)),''); confirmed boolean:=false;
  first_reply boolean:=false; target_seconds integer:=60; due_delay integer:=5;
begin
  if nullif(trim(p_provider_message_id),'') is null or nullif(trim(p_body),'') is null then raise exception 'Inbound message id and body required'; end if;
  if keyword is not null and keyword not in ('STOP','START','HELP') then raise exception 'Unsupported compliance keyword'; end if;
  if p_received_at is null or p_received_at>now()+interval '5 minutes' then raise exception 'Invalid inbound timestamp'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sms-provider:'||p_provider_message_id,0));
  select * into m from public.lead_messages where provider='SENT_DM' and provider_message_id=p_provider_message_id;
  if found then return jsonb_build_object('message_id',m.id,'customer_id',m.customer_id,'lead_id',m.lead_id,'inserted',false); end if;
  v:=public.resolve_inbound_sms_conversation(p_phone);
  select * into c from public.customers where id=(v->>'customer_id')::uuid for update;
  select * into l from public.leads where id=(v->>'lead_id')::uuid for update;

  -- YES is consent only when it answers an actual, accepted opt-in request.
  if keyword is null and upper(trim(p_body)) in ('YES','SI','SÍ') and c.sms_consent_at is not null
    and c.sms_opted_out_at is null and c.sms_opt_in_requested_at<=p_received_at
    and c.sms_opt_in_requested_at>=p_received_at-interval '7 days'
    and exists(select 1 from public.lead_messages where id=c.sms_opt_in_request_message_id
      and provider_message_id is not null and delivery_status in ('QUEUED','ROUTED','SCHEDULED','SENT','DELIVERED','READ')) then
    keyword:='YES';
  end if;
  if keyword='STOP' and (c.sms_consent_updated_at is null or p_received_at>=c.sms_consent_updated_at) then
    update public.customers set sms_opted_out_at=p_received_at,sms_opt_out_source='SENT_DM_STOP',
      sms_consent_updated_at=p_received_at,sms_opt_in_requested_at=null,sms_opt_in_request_message_id=null,updated_at=now() where id=c.id;
  elsif keyword in ('START','YES') and (c.sms_consent_updated_at is null or p_received_at>c.sms_consent_updated_at) then
    update public.customers set sms_consent_at=coalesce(sms_consent_at,p_received_at),
      sms_consent_source=coalesce(sms_consent_source,'SENT_DM_'||keyword),sms_double_opt_in_at=p_received_at,
      sms_opted_out_at=null,sms_opt_out_source=null,sms_consent_updated_at=p_received_at,
      sms_opt_in_requested_at=null,sms_opt_in_request_message_id=null,updated_at=now() where id=c.id;
    confirmed:=true;
  end if;

  insert into public.lead_messages(lead_id,customer_id,sender_type,body,delivery_status,provider,provider_status,provider_message_id,message_kind,created_at,updated_at)
    values(l.id,c.id,'CUSTOMER',left(trim(p_body),1600),'RECEIVED','SENT_DM','RECEIVED',p_provider_message_id,
      case when keyword is null then 'INBOUND' else 'COMPLIANCE' end,p_received_at,now()) returning * into m;
  update public.leads set conversation_revision=conversation_revision+1,last_contact_at=greatest(last_contact_at,p_received_at),updated_at=now()
    where id=l.id returning * into l;
  update public.communication_jobs set state='CANCELLED',last_error='New inbound message',updated_at=now()
    where lead_id=l.id and state in ('QUEUED','WORKING');
  update public.sms_outbox o set state='CANCELLED',last_error='New inbound message or consent change',updated_at=now()
    from public.lead_messages lm where o.message_id=lm.id and lm.customer_id=c.id
      and (o.origin in ('AI','AUTOMATION') or keyword='STOP') and o.state in ('QUEUED','RETRY','LEASED');

  if keyword is not null then
    insert into public.sms_consent_events(customer_id,provider_message_id,event_type,keyword,occurred_at)
      values(c.id,p_provider_message_id,case when keyword='STOP' then 'OPT_OUT' when keyword='HELP' then 'HELP' else 'OPT_IN' end,keyword,p_received_at);
  end if;
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
    values(c.id,'LEAD',l.id,case when keyword is null then 'SMS_RECEIVED' else 'SMS_'||keyword end,
      case when keyword is null then 'Customer SMS received' else 'Customer sent '||keyword end,'sent.DM webhook',
      jsonb_build_object('provider_message_id',p_provider_message_id,'consent_confirmed',confirmed));

  -- A normal customer message can continue an established conversation. A
  -- confirmed website YES can start the first conversational reply from the
  -- form context. START/STOP/HELP remain provider-only compliance events.
  select * into c from public.customers where id=c.id;
  if (keyword is null or (keyword='YES' and confirmed)) and not l.human_takeover
    and c.sms_consent_at is not null and c.sms_double_opt_in_at is not null
    and c.sms_opted_out_at is null and p_received_at>=now()-interval '1 hour'
    and exists(select 1 from public.communication_runtime where id=1 and ai_sending_enabled) then
    select not exists(
      select 1 from public.lead_messages prior
      where prior.lead_id=l.id and prior.sender_type in ('AI','HUMAN') and prior.message_kind='FREEFORM'
    ) into first_reply;
    select initial_response_target_seconds into target_seconds from public.control_center_settings where id=1;
    due_delay:=case when first_reply then greatest(coalesce(target_seconds,60)-60,0) else 5 end;
    insert into public.communication_jobs(operation_key,kind,lead_id,trigger_message_id,context,due_at,expires_at)
      values('reply:'||m.id,'AI_REPLY',l.id,m.id,
        jsonb_build_object('conversation_revision',l.conversation_revision,'initial_response',first_reply),
        now()+make_interval(secs=>due_delay),now()+interval '1 hour')
      on conflict(operation_key) do nothing;
  end if;
  return jsonb_build_object('message_id',m.id,'customer_id',c.id,'lead_id',l.id,'inserted',true,'consent_confirmed',confirmed);
end $$;

-- Turn every website request into visible conversation context. If consent is
-- complete, queue the first AI reply. Otherwise, reserve the approved double
-- opt-in template without pretending it was a staff reply.
create function public.schedule_website_contact_response(p_submission_id uuid,p_template_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.contact_submissions%rowtype; l public.leads%rowtype; c public.customers%rowtype;
  r public.communication_runtime%rowtype; cs public.control_center_settings%rowtype;
  inbound_message public.lead_messages%rowtype; optin_message public.lead_messages%rowtype;
  digits text; dest text; body text; operation text:='website-request:'||p_submission_id::text;
  optin_operation text:='website-opt-in:'||p_submission_id::text; due_delay integer;
  optin_body text:='Please reply YES to confirm you want texts about your request and service. Message frequency varies. Message and data rates may apply. Reply HELP for help.';
begin
  if p_submission_id is null then raise exception 'Contact submission is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(operation,0));
  select * into s from public.contact_submissions where id=p_submission_id for update;
  if not found or s.customer_id is null or s.lead_id is null then raise exception 'Contact submission context not found'; end if;
  select * into c from public.customers where id=s.customer_id for update;
  select * into l from public.leads where id=s.lead_id for update;
  select * into cs from public.control_center_settings where id=1;
  select * into r from public.communication_runtime where id=1;
  body:=left(coalesce(nullif(trim(concat_ws(': ',nullif(trim(s.project_type),''),nullif(trim(s.message),''))),''),'Website contact request'),1600);

  select * into inbound_message from public.lead_messages where idempotency_key=operation;
  if not found then
    insert into public.lead_messages(lead_id,customer_id,sender_type,body,delivery_status,provider,provider_status,message_kind,idempotency_key,created_at,updated_at)
      values(l.id,c.id,'CUSTOMER',body,'RECEIVED',null,'RECEIVED','INBOUND',operation,s.submitted_at,now()) returning * into inbound_message;
    update public.leads set conversation_revision=conversation_revision+1,last_contact_at=greatest(last_contact_at,s.submitted_at),updated_at=now()
      where id=l.id returning * into l;
  end if;

  if not s.sms_consent or c.sms_consent_at is null then
    return jsonb_build_object('message_id',inbound_message.id,'scheduled',false,'reason','SMS consent not provided');
  end if;
  if c.sms_opted_out_at is not null then
    return jsonb_build_object('message_id',inbound_message.id,'scheduled',false,'reason','Customer opted out');
  end if;
  if cs.id is null or r.id is null or cs.sms_status not in ('READY','TESTING') or not r.ai_sending_enabled then
    return jsonb_build_object('message_id',inbound_message.id,'scheduled',false,'reason','Automated replies are disabled');
  end if;
  digits:=regexp_replace(coalesce(c.phone,''),'[^0-9]','','g');
  dest:=case when length(digits)=10 then '+1'||digits when length(digits)=11 and left(digits,1)='1' then '+'||digits else null end;
  if dest is null then return jsonb_build_object('message_id',inbound_message.id,'scheduled',false,'reason','Valid phone missing'); end if;
  if cs.sms_status='TESTING' and not dest=any(r.test_numbers) then
    return jsonb_build_object('message_id',inbound_message.id,'scheduled',false,'reason','Number is outside SMS test allowlist');
  end if;
  due_delay:=greatest(coalesce(cs.initial_response_target_seconds,60)-60,0);

  if c.sms_double_opt_in_at is not null then
    insert into public.communication_jobs(operation_key,kind,lead_id,trigger_message_id,context,due_at,expires_at)
      values('reply:'||inbound_message.id,'AI_REPLY',l.id,inbound_message.id,
        jsonb_build_object('conversation_revision',l.conversation_revision,'initial_response',true,'source','WEBSITE_CONTACT'),
        now()+make_interval(secs=>due_delay),now()+interval '1 hour')
      on conflict(operation_key) do nothing;
    return jsonb_build_object('message_id',inbound_message.id,'scheduled',true,'kind','AI_REPLY');
  end if;

  if nullif(trim(p_template_id),'') is null then raise exception 'Approved first contact template is missing'; end if;
  select lm.* into optin_message from public.lead_messages lm where lm.idempotency_key=optin_operation;
  if found then return jsonb_build_object('message_id',inbound_message.id,'scheduled',true,'kind','OPT_IN','opt_in_message_id',optin_message.id); end if;
  if exists(select 1 from public.sms_outbox o join public.lead_messages lm on lm.id=o.message_id
    where lm.customer_id=c.id and o.origin='OPT_IN' and o.state not in ('FAILED','CANCELLED')
      and lm.delivery_status not in ('FAILED','FILTERED','BLOCKED') and o.created_at>now()-interval '7 days') then
    return jsonb_build_object('message_id',inbound_message.id,'scheduled',false,'reason','Opt-in request already pending');
  end if;

  insert into public.lead_messages(lead_id,customer_id,sender_type,body,delivery_status,provider,provider_status,message_kind,provider_template_id,idempotency_key)
    values(l.id,c.id,'SYSTEM',optin_body,'PENDING','SENT_DM','PENDING','TEMPLATE',trim(p_template_id),optin_operation)
    returning * into optin_message;
  insert into public.sms_outbox(message_id,operation_key,origin,payload,conversation_revision,next_attempt_at)
    values(optin_message.id,optin_operation,'OPT_IN',
      jsonb_build_object('to',jsonb_build_array(dest),'channel',jsonb_build_array('sms'),'template',
        jsonb_build_object('id',trim(p_template_id),'parameters',jsonb_build_object('message',optin_body))),
      l.conversation_revision,now()+make_interval(secs=>due_delay));
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
    values(c.id,'LEAD',l.id,'SMS_RESERVED','Website SMS confirmation reserved','Website contact flow',
      jsonb_build_object('message_id',optin_message.id,'origin','OPT_IN'));
  return jsonb_build_object('message_id',inbound_message.id,'scheduled',true,'kind','OPT_IN','opt_in_message_id',optin_message.id);
end $$;

revoke all on function public.schedule_website_contact_response(uuid,text) from public,anon,authenticated;
grant execute on function public.schedule_website_contact_response(uuid,text) to service_role;

commit;
