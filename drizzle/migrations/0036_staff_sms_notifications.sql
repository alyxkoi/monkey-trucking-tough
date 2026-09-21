begin;
-- Internal destinations never need synthetic customers or leads.
create table public.staff_sms_settings (
 id integer primary key default 1 check(id=1), name text not null default 'Salvador',
 phone text not null default '+12146778466' check(phone ~ '^\+1[0-9]{10}$'),
 enabled boolean not null default true,new_lead boolean not null default true,
 quote_accepted boolean not null default true,salvador_needed boolean not null default true,
 opted_out_at timestamptz,consent_updated_at timestamptz,updated_at timestamptz not null default now()
);
insert into public.staff_sms_settings(id) values(1);
create table public.staff_sms_outbox (
 message_id uuid primary key default gen_random_uuid(),operation_key text not null unique,
 event_type text not null check(event_type in ('NEW_LEAD','QUOTE_ACCEPTED','SALVADOR_NEEDED','TEST')),
 entity_id uuid,phone text not null,body text not null,payload jsonb,
 state text not null default 'QUEUED' check(state in ('QUEUED','LEASED','DISPATCHING','RETRY','ACCEPTED','FAILED','CANCELLED','REVIEW')),
 lease_token uuid,lease_until timestamptz,attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),provider_message_id text unique,
 delivery_status text not null default 'PENDING',last_error text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.staff_sms_settings enable row level security;
alter table public.staff_sms_outbox enable row level security;
create function public.protect_staff_sms_payload() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.payload is not null and (new.payload is distinct from old.payload or new.body is distinct from old.body or new.phone is distinct from old.phone or new.operation_key is distinct from old.operation_key) then
  raise exception 'Dispatched staff SMS identity and payload are immutable';
 end if;
 return new;
end $$;
create trigger protect_staff_sms_payload before update on public.staff_sms_outbox for each row execute function public.protect_staff_sms_payload();
revoke all on function public.protect_staff_sms_payload() from public,anon,authenticated;
revoke all on public.staff_sms_settings,public.staff_sms_outbox from anon,authenticated;
grant select on public.staff_sms_settings,public.staff_sms_outbox to authenticated;
grant all on public.staff_sms_settings,public.staff_sms_outbox to service_role;
create policy staff_sms_settings_read on public.staff_sms_settings for select to authenticated using(public.is_admin_or_staff());
create policy staff_sms_outbox_read on public.staff_sms_outbox for select to authenticated using(public.is_admin_or_staff());

create function public.is_internal_sms_phone(p_phone text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.staff_sms_settings where right(regexp_replace(p_phone,'[^0-9]','','g'),10)=right(phone,10))
 or exists(select 1 from public.staff_sms_outbox where right(regexp_replace(p_phone,'[^0-9]','','g'),10)=right(phone,10));
$$;
create function public.staff_sms_enabled(p_type text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select enabled and opted_out_at is null and case p_type when 'TEST' then true when 'NEW_LEAD' then new_lead when 'QUOTE_ACCEPTED' then quote_accepted when 'SALVADOR_NEEDED' then salvador_needed else false end from public.staff_sms_settings where id=1),false);
$$;
create function public.save_staff_sms_settings(p_enabled boolean,p_new_lead boolean,p_quote_accepted boolean,p_salvador_needed boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin_or_staff() then raise exception 'Staff access required'; end if;
 update public.staff_sms_settings set enabled=p_enabled,new_lead=p_new_lead,quote_accepted=p_quote_accepted,salvador_needed=p_salvador_needed,updated_at=now() where id=1;
 insert into public.activity_history(entity_type,entity_id,event_type,summary,actor_id,actor_label,metadata)
 values('SYSTEM',null,'STAFF_SMS_SETTINGS_CHANGED','Staff SMS notification preferences updated',auth.uid(),'Staff',jsonb_build_object('enabled',p_enabled,'new_lead',p_new_lead,'quote_accepted',p_quote_accepted,'salvador_needed',p_salvador_needed));
end $$;
create function public.queue_staff_sms(p_type text,p_entity uuid,p_key text,p_body text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; s public.staff_sms_settings%rowtype;
begin
 select * into s from public.staff_sms_settings where id=1;
 insert into public.staff_sms_outbox(operation_key,event_type,entity_id,phone,body,state,last_error)
 values(p_key,p_type,p_entity,s.phone,left(p_body,800),case when public.staff_sms_enabled(p_type) then 'QUEUED' else 'CANCELLED' end,
 case when not public.staff_sms_enabled(p_type) then 'Staff notification disabled or opted out at event time' end)
 on conflict(operation_key) do nothing returning message_id into result;
 if result is null then select message_id into result from public.staff_sms_outbox where operation_key=p_key; end if;
 return result;
end $$;
create function public.staff_notification_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.customers%rowtype; label text; reason text; kind text;
begin
 select * into c from public.customers where id=new.customer_id;
 if c.id is null or public.is_internal_sms_phone(c.phone) then return new; end if;
 label:=case when c.name ~* '^(unknown|sms customer)' then coalesce(c.phone,'Unknown contact') else c.name||coalesce(', '||c.phone,'') end;
 if tg_table_name='leads' then
  perform public.queue_staff_sms('NEW_LEAD',new.id,'lead:'||new.id,'New lead: '||label||'. '||left(new.need,220)||' https://www.monkeytrucking.llc/admin/leads/'||new.id);
 elsif tg_table_name='quotes' then
  if new.status<>'ACCEPTED' then return new; end if;
  if tg_op='UPDATE' then if old.status=new.status then return new; end if; end if;
  perform public.queue_staff_sms('QUOTE_ACCEPTED',new.id,'quote-accepted:'||new.id,'Quote accepted: '||label||'. Quote '||new.quote_number||', $'||round(new.grand_total,2)||'. https://www.monkeytrucking.llc/admin/quotes/'||new.id);
 elsif tg_table_name='activity_history' then
  if new.event_type<>'AI_ACTION_OPEN' then return new; end if;
  kind:=new.metadata->>'kind';
  reason:=case kind when 'CUSTOM_WORK' then 'Custom work needs pricing' when 'QUOTE_READY' then 'Quote ready for staff review/send' when 'HUMAN_REQUEST' then 'Customer requested Salvador' when 'PAYMENT_CLAIM' then 'Customer says they paid; verify payment' when 'CONTACT_REVIEW' then 'Contact information needs review' when 'SCHEDULE_CHANGE' then 'Schedule change requested' when 'COMPLAINT' then 'Customer complaint' else replace(coalesce(kind,'Customer request'),'_',' ') end;
  perform public.queue_staff_sms('SALVADOR_NEEDED',new.id,'staff-action:'||new.id,'Salvador needed: '||label||'. '||reason||coalesce('. '||left(nullif(new.metadata->>'request',''),140),'')||' https://www.monkeytrucking.llc/admin/leads/'||new.entity_id);
 end if;
 return new;
end $$;
create trigger staff_sms_new_lead after insert on public.leads for each row execute function public.staff_notification_event();
create trigger staff_sms_accepted after insert or update on public.quotes for each row execute function public.staff_notification_event();
create trigger staff_sms_action after insert on public.activity_history for each row when(new.event_type='AI_ACTION_OPEN') execute function public.staff_notification_event();

create function public.queue_staff_sms_test(p_request_id uuid,p_actor_id uuid default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin_or_staff() and not (auth.role()='service_role' and exists(select 1 from public.user_roles where user_id=p_actor_id and role in ('admin','staff'))) then raise exception 'Staff access required'; end if;
 if p_request_id is null or not public.staff_sms_enabled('TEST') then raise exception 'Enable staff SMS notifications before sending a test'; end if;
 return public.queue_staff_sms('TEST',null,'test:'||p_request_id,'Monkey Trucking staff notification test. Dashboard alerts are connected. This is an internal message, not a customer conversation. Reply STOP to stop staff alerts.');
end $$;

create function public.claim_staff_sms(p_message_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.staff_sms_outbox%rowtype;
begin
 select * into o from public.staff_sms_outbox where (p_message_id is null or message_id=p_message_id) and next_attempt_at<=now() and attempts<3
 and (state in ('QUEUED','RETRY') or state in ('LEASED','DISPATCHING') and lease_until<now()) order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.staff_sms_outbox set state='LEASED',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',updated_at=now() where message_id=o.message_id returning * into o;
 return to_jsonb(o);
end $$;
create function public.authorize_staff_sms_dispatch(p_message_id uuid,p_lease_token uuid,p_template_id text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.staff_sms_outbox%rowtype; s public.staff_sms_settings%rowtype; reason text; l public.leads%rowtype; c public.customers%rowtype; need text;
begin
 select * into s from public.staff_sms_settings where id=1 for update;
 select * into o from public.staff_sms_outbox where message_id=p_message_id for update;
 if o.state<>'LEASED' or o.lease_token is distinct from p_lease_token or o.lease_until<now() then return null; end if;
 reason:=case when not public.staff_sms_enabled(o.event_type) then 'Staff notification disabled or opted out'
 when o.phone<>s.phone then 'Staff destination changed'
 when o.created_at<now()-interval '1 day' then 'Staff alert expired'
 when not exists(select 1 from public.control_center_settings where id=1 and business_number='+19453750877' and sms_status in ('READY','TESTING')) then 'SMS provider is not ready'
 when exists(select 1 from public.control_center_settings s1 cross join public.communication_runtime r where s1.id=1 and r.id=1 and s1.sms_status='TESTING' and not o.phone=any(r.test_numbers)) then 'Not an approved test number'
 when nullif(trim(p_template_id),'') is null then 'Approved sent.DM template missing'
 when o.event_type='SALVADOR_NEEDED' and exists(select 1 from public.activity_history where event_type='AI_ACTION_RESOLVED' and metadata->>'request_id'=o.entity_id::text) then 'Staff action already resolved'
 else null end;
 if reason is not null then update public.staff_sms_outbox set state='CANCELLED',last_error=reason,updated_at=now() where message_id=o.message_id; return null; end if;
 if o.event_type='NEW_LEAD' and o.payload is null then
  select * into l from public.leads where id=o.entity_id;
  select * into c from public.customers where id=l.customer_id;
  need:=case when l.need='Inbound SMS conversation' then (select body from public.lead_messages where lead_id=l.id and sender_type='CUSTOMER' and message_kind='INBOUND' order by created_at limit 1) else l.need end;
  o.body:='New lead: '||case when c.name ~* '^(unknown|sms customer)' then coalesce(c.phone,'Unknown contact') else c.name||coalesce(', '||c.phone,'') end||'. '||left(coalesce(need,'New inquiry'),220)||' https://www.monkeytrucking.llc/admin/leads/'||l.id;
 end if;
 update public.staff_sms_outbox set state='DISPATCHING',attempts=attempts+1,body=o.body,
 payload=coalesce(payload,jsonb_build_object('to',jsonb_build_array(o.phone),'channel',jsonb_build_array('sms'),'template',jsonb_build_object('id',p_template_id,'parameters',jsonb_build_object('message',o.body)))),updated_at=now()
 where message_id=o.message_id returning * into o;
 return to_jsonb(o);
end $$;
create function public.fail_staff_sms_dispatch(p_message_id uuid,p_lease_token uuid,p_retryable boolean,p_error text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.staff_sms_outbox set state=case when not p_retryable then 'FAILED' when attempts>=3 then 'REVIEW' else 'RETRY' end,
 last_error=left(p_error,500),lease_until=null,next_attempt_at=now()+interval '2 minutes',updated_at=now()
 where message_id=p_message_id and lease_token=p_lease_token and state='DISPATCHING';
end $$;

-- Reuse signed webhook ingestion, including unmatched delivery reconciliation.
alter function public.apply_sms_delivery_status(text,text,text) rename to apply_customer_sms_delivery_status;
create function public.apply_sms_delivery_status(p_provider_message_id text,p_provider_status text,p_error_message text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.staff_sms_outbox%rowtype; ranks jsonb:='{"PENDING":0,"QUEUED":10,"ROUTED":20,"SCHEDULED":25,"SENT":30,"FAILED":40,"FILTERED":40,"BLOCKED":40,"DELIVERED":50,"READ":60}'; s text:=upper(trim(p_provider_status));
begin
 select * into o from public.staff_sms_outbox where provider_message_id=p_provider_message_id for update;
 if not found then return public.apply_customer_sms_delivery_status(p_provider_message_id,p_provider_status,p_error_message); end if;
 if not ranks ? s then raise exception 'Unsupported delivery status'; end if;
 if (ranks->>s)::int>=coalesce((ranks->>o.delivery_status)::int,0) then
 update public.staff_sms_outbox set delivery_status=s,last_error=case when s in ('FAILED','FILTERED','BLOCKED') then coalesce(p_error_message,'Provider reported '||s) end,updated_at=now() where message_id=o.message_id;
 end if;
 return jsonb_build_object('message_id',o.message_id,'internal',true,'delivery_status',s);
end $$;
create function public.complete_staff_sms_dispatch(p_message_id uuid,p_lease_token uuid,p_provider_message_id text,p_status text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.staff_sms_outbox%rowtype; e public.sms_webhook_events%rowtype; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('sms-provider:'||p_provider_message_id,0));
 select * into o from public.staff_sms_outbox where message_id=p_message_id for update;
 if o.state<>'DISPATCHING' or o.lease_token is distinct from p_lease_token then raise exception 'Staff dispatch lease lost'; end if;
 if nullif(p_provider_message_id,'') is null then raise exception 'Provider message ID required'; end if;
 update public.staff_sms_outbox set state='ACCEPTED',lease_until=null,provider_message_id=p_provider_message_id,updated_at=now() where message_id=o.message_id;
 result:=public.apply_sms_delivery_status(p_provider_message_id,p_status,null);
 for e in select * from public.sms_webhook_events where provider_message_id=p_provider_message_id and processing_status='UNMATCHED' order by occurred_at,received_at loop
 result:=public.apply_sms_delivery_status(p_provider_message_id,e.message_status,e.error_message);
 update public.sms_webhook_events set processing_status='PROCESSED',processed_at=now() where event_key=e.event_key;
 end loop;
 return result;
end $$;

alter function public.record_inbound_sms(text,text,text,text,timestamptz) rename to record_customer_inbound_sms;
create function public.record_inbound_sms(p_provider_message_id text,p_phone text,p_body text,p_keyword text default null,p_received_at timestamptz default now()) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_internal_sms_phone(p_phone) then return public.record_customer_inbound_sms(p_provider_message_id,p_phone,p_body,p_keyword,p_received_at); end if;
 perform pg_advisory_xact_lock(hashtextextended('sms-provider:'||p_provider_message_id,0));
 if p_keyword='STOP' then update public.staff_sms_settings set opted_out_at=p_received_at,consent_updated_at=p_received_at,updated_at=now() where right(phone,10)=right(regexp_replace(p_phone,'[^0-9]','','g'),10) and (consent_updated_at is null or p_received_at>=consent_updated_at);
 elsif p_keyword='START' then update public.staff_sms_settings set opted_out_at=null,consent_updated_at=p_received_at,updated_at=now() where right(phone,10)=right(regexp_replace(p_phone,'[^0-9]','','g'),10) and (consent_updated_at is null or p_received_at>consent_updated_at); end if;
 insert into public.activity_history(entity_type,event_type,summary,actor_label,metadata)
 select 'SYSTEM','STAFF_SMS_INBOUND','Internal staff reply received; no customer conversation created','sent.DM',jsonb_build_object('provider_message_id',p_provider_message_id,'keyword',p_keyword,'body',left(p_body,1600))
 where not exists(select 1 from public.activity_history where event_type='STAFF_SMS_INBOUND' and metadata->>'provider_message_id'=p_provider_message_id);
 return jsonb_build_object('internal',true,'inserted',false);
end $$;
-- Protect direct ingestion callers and contact forms too, not just webhooks.
alter function public.resolve_inbound_sms_conversation(text) rename to resolve_customer_inbound_sms_conversation;
create function public.resolve_inbound_sms_conversation(p_phone text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.is_internal_sms_phone(p_phone) then return jsonb_build_object('internal',true); end if;
 return public.resolve_customer_inbound_sms_conversation(p_phone);
end $$;
create function public.protect_internal_staff_contact() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.is_internal_sms_phone(new.phone) then raise exception 'This is an internal staff number, not a customer'; end if;
 return new;
end $$;
create trigger protect_internal_staff_contact before insert or update of phone on public.customers for each row execute function public.protect_internal_staff_contact();

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('is_internal_sms_phone','staff_sms_enabled','queue_staff_sms','staff_notification_event','claim_staff_sms','authorize_staff_sms_dispatch','complete_staff_sms_dispatch','fail_staff_sms_dispatch','apply_sms_delivery_status','apply_customer_sms_delivery_status','record_inbound_sms','record_customer_inbound_sms','resolve_inbound_sms_conversation','resolve_customer_inbound_sms_conversation','protect_internal_staff_contact') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature); execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
revoke all on function public.save_staff_sms_settings(boolean,boolean,boolean,boolean),public.queue_staff_sms_test(uuid,uuid) from public,anon;
grant execute on function public.save_staff_sms_settings(boolean,boolean,boolean,boolean),public.queue_staff_sms_test(uuid,uuid) to authenticated,service_role;
commit;
