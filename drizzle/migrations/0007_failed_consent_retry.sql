create or replace function public.enqueue_sms(
  p_lead_id uuid, p_body text, p_operation_key text, p_origin text,
  p_actor_id uuid default null, p_template_id text default null,
  p_trigger_message_id uuid default null, p_rule_id text default null, p_guard jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.leads%rowtype; c public.customers%rowtype; m public.lead_messages%rowtype;
  r public.communication_runtime%rowtype; s public.control_center_settings%rowtype;
  digits text; dest text; payload jsonb; inbound boolean; kind text;
begin
  if p_origin not in ('HUMAN','AI','AUTOMATION','OPT_IN') or nullif(trim(p_body),'') is null or length(trim(p_body))>1600
    or nullif(p_operation_key,'') is null or length(p_operation_key)>240 then raise exception 'Invalid SMS reservation'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sms-operation:' || p_operation_key,0));
  select * into m from public.lead_messages where idempotency_key=p_operation_key;
  if found then
    if m.lead_id<>p_lead_id or m.body<>trim(p_body) then raise exception 'Operation already reserved with different content'; end if;
    return to_jsonb(m);
  end if;
  select * into l from public.leads where id=p_lead_id;
  if not found then raise exception 'Lead not found'; end if;
  select * into c from public.customers where id=l.customer_id for update;
  select * into l from public.leads where id=p_lead_id for update;
  select * into s from public.control_center_settings where id=1;
  select * into r from public.communication_runtime where id=1;
  digits:=regexp_replace(coalesce(c.phone,''),'[^0-9]','','g');
  dest:=case when length(digits)=10 then '+1'||digits when length(digits)=11 and left(digits,1)='1' then '+'||digits else null end;
  if dest is null then raise exception 'A valid US customer phone is required'; end if;
  if s.id is null or s.sms_status not in ('READY','TESTING') or s.business_number is distinct from '+19453750877' or r.id is null then raise exception 'SMS is not ready'; end if;
  if s.sms_status='TESTING' and not dest=any(r.test_numbers) then raise exception 'SMS testing is restricted to approved test numbers'; end if;
  if c.sms_opted_out_at is not null then raise exception 'Customer has opted out of SMS'; end if;
  select exists(select 1 from public.lead_messages where customer_id=c.id and sender_type='CUSTOMER' and message_kind='INBOUND') into inbound;
  if c.sms_consent_at is null and not inbound then raise exception 'Customer SMS consent is not recorded'; end if;
  if p_origin in ('HUMAN','OPT_IN') and not exists(select 1 from public.user_roles where user_id=p_actor_id and role in ('admin','staff')) then raise exception 'Staff actor required'; end if;
  if p_origin in ('AI','AUTOMATION') then
    if c.sms_consent_at is null or c.sms_double_opt_in_at is null then raise exception 'Customer has not completed SMS double opt in'; end if;
    if l.human_takeover then raise exception 'Human takeover is active'; end if;
    if p_origin='AI' and (not r.ai_sending_enabled or p_trigger_message_id is null) then raise exception 'AI sending is disabled'; end if;
    if p_origin='AUTOMATION' and (not r.scheduled_sending_enabled or not exists(select 1 from public.automation_rules where id=p_rule_id and status='ON')) then raise exception 'Scheduled sending is disabled'; end if;
    if p_rule_id in ('review-request','reactivation') and (not r.marketing_approved or c.sms_marketing_consent_at is null) then raise exception 'Campaign coverage or marketing consent is not verified'; end if;
    if p_trigger_message_id is not null and p_trigger_message_id is distinct from
      (select id from public.lead_messages where lead_id=l.id and sender_type='CUSTOMER' order by created_at desc,id desc limit 1) then raise exception 'Conversation changed'; end if;
  end if;
  if p_origin='OPT_IN' and (c.sms_consent_at is null or c.sms_double_opt_in_at is not null) then raise exception 'Opt in request is not eligible'; end if;
  if p_origin='OPT_IN' and exists(select 1 from public.sms_outbox o join public.lead_messages lm on lm.id=o.message_id
    where lm.customer_id=c.id and o.origin='OPT_IN' and o.state not in ('FAILED','CANCELLED')
      and lm.delivery_status not in ('FAILED','FILTERED','BLOCKED') and o.created_at>now()-interval '7 days') then raise exception 'An SMS confirmation request is already pending'; end if;
  kind:=case when inbound and p_origin<>'OPT_IN' then 'FREEFORM' else 'TEMPLATE' end;
  if kind='TEMPLATE' and nullif(p_template_id,'') is null then raise exception 'Approved first contact template is missing'; end if;
  payload:=jsonb_build_object('to',jsonb_build_array(dest),'channel',jsonb_build_array('sms')) ||
    case when kind='FREEFORM' then jsonb_build_object('text',trim(p_body)) else
    jsonb_build_object('template',jsonb_build_object('id',p_template_id,'parameters',jsonb_build_object('message',trim(p_body)))) end;
  if p_origin in ('HUMAN','OPT_IN') then
    update public.leads set human_takeover=true,conversation_revision=conversation_revision+1,updated_at=now() where id=l.id returning * into l;
    update public.communication_jobs set state='CANCELLED',last_error='Human takeover',updated_at=now() where lead_id=l.id and state in ('QUEUED','WORKING');
    update public.sms_outbox o set state='CANCELLED',last_error='Human takeover',updated_at=now()
      from public.lead_messages lm where o.message_id=lm.id and lm.lead_id=l.id and o.origin in ('AI','AUTOMATION') and o.state in ('QUEUED','RETRY','LEASED');
  end if;
  insert into public.lead_messages(lead_id,customer_id,sender_type,body,delivery_status,provider,provider_status,message_kind,provider_template_id,idempotency_key,automation_rule_id,created_by)
    values(l.id,c.id,case when p_origin in ('AI','AUTOMATION') then 'AI' else 'HUMAN' end,trim(p_body),'PENDING','SENT_DM','PENDING',kind,case when kind='TEMPLATE' then p_template_id end,p_operation_key,p_rule_id,p_actor_id) returning * into m;
  insert into public.sms_outbox(message_id,operation_key,origin,payload,conversation_revision,trigger_message_id,guard)
    values(m.id,p_operation_key,p_origin,payload,l.conversation_revision,p_trigger_message_id,p_guard);
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_id,actor_label,metadata)
    values(c.id,'LEAD',l.id,'SMS_RESERVED','SMS reserved for sent.DM delivery',p_actor_id,p_origin,jsonb_build_object('message_id',m.id,'origin',p_origin));
  return to_jsonb(m);
end $$;