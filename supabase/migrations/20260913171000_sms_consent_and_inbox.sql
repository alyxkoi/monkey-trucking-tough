begin;

update public.customers set sms_consent_updated_at=greatest(sms_opted_out_at,sms_double_opt_in_at)
  where sms_consent_updated_at is null;

create or replace function public.record_inbound_sms(
  p_provider_message_id text,p_phone text,p_body text,p_keyword text default null,p_received_at timestamptz default now()
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v jsonb; c public.customers%rowtype; l public.leads%rowtype; m public.lead_messages%rowtype;
  keyword text:=nullif(upper(trim(p_keyword)),''); confirmed boolean:=false;
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
  -- A generic yes, a failed request, and a yes after STOP never grant consent.
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
  -- Compliance is handled by the provider, never by generative AI. Unknown
  -- senders are retained but require consent/staff handling before automation.
  select * into c from public.customers where id=c.id;
  if keyword is null and not l.human_takeover and c.sms_consent_at is not null and c.sms_double_opt_in_at is not null
    and c.sms_opted_out_at is null and p_received_at>=now()-interval '1 hour'
    and exists(select 1 from public.communication_runtime where id=1 and ai_sending_enabled) then
    insert into public.communication_jobs(operation_key,kind,lead_id,trigger_message_id,context,due_at,expires_at)
      values('reply:'||m.id,'AI_REPLY',l.id,m.id,jsonb_build_object('conversation_revision',l.conversation_revision),now()+interval '5 seconds',now()+interval '1 hour')
      on conflict(operation_key) do nothing;
  end if;
  return jsonb_build_object('message_id',m.id,'customer_id',c.id,'lead_id',l.id,'inserted',true,'consent_confirmed',confirmed);
end $$;

-- Signature verification happens before this service-only atomic transaction.
-- No PROCESSING row survives a crash. Unmatched outbound events are retained
-- without forcing sent.DM to retry its own compliance autoreplies forever.
create function public.ingest_sms_event(
  p_message_id text,p_event_type text,p_status text,p_inbound boolean,p_business_number text,
  p_phone text default null,p_body text default null,p_keyword text default null,
  p_occurred_at timestamptz default now(),p_error text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare event_key_value text:=p_message_id||':'||p_status; e public.sms_webhook_events%rowtype; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('sms-provider:'||p_message_id,0));
  select * into e from public.sms_webhook_events where event_key=event_key_value for update;
  if found and e.processing_status in ('PROCESSED','IGNORED') then return jsonb_build_object('duplicate',true); end if;
  if not exists(select 1 from public.control_center_settings where id=1 and business_number='+19453750877')
    or (p_inbound and p_business_number is distinct from '+19453750877') then return jsonb_build_object('ignored',true); end if;
  insert into public.sms_webhook_events(event_key,provider_message_id,event_type,message_status,processing_status,occurred_at,error_message)
    values(event_key_value,p_message_id,p_event_type,p_status,'PROCESSING',p_occurred_at,left(p_error,500))
    on conflict(event_key) do update set processing_status='PROCESSING',updated_at=now();
  if p_inbound then
    result:=public.record_inbound_sms(p_message_id,p_phone,p_body,p_keyword,p_occurred_at);
  else
    result:=public.apply_sms_delivery_status(p_message_id,p_status,p_error);
  end if;
  update public.sms_webhook_events set processing_status=case when result is null then 'UNMATCHED' else 'PROCESSED' end,
    processed_at=case when result is not null then now() end,updated_at=now() where event_key=event_key_value;
  return jsonb_build_object('received',true,'unmatched',result is null,'result',result);
end $$;

create function public.resume_conversation_ai(p_lead_id uuid,p_actor_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.leads%rowtype;
begin
  if not exists(select 1 from public.user_roles where user_id=p_actor_id and role in ('admin','staff')) then raise exception 'Staff actor required'; end if;
  select * into l from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  update public.leads set human_takeover=false,conversation_revision=conversation_revision+1,updated_at=now() where id=p_lead_id;
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_id,actor_label)
    values(l.customer_id,'LEAD',l.id,'AI_RESUMED','Staff resumed AI for future customer messages',p_actor_id,'Dashboard staff');
  -- Deliberately no backfill: resume applies to the next inbound message.
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('ingest_sms_event','resume_conversation_ai') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

-- Extend existing realtime publication only; leave existing subscriptions alone.
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables) then
    foreach t in array array['lead_messages','leads','customers','communication_jobs','sms_outbox'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
commit;
