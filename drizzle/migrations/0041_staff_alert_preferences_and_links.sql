begin;
alter table public.staff_sms_settings add column preferences jsonb not null default
 '{"QUOTE_READY":true,"CUSTOM_WORK":true,"SCHEDULE_CHANGE":true,"ORDER_CHANGE":true,"ADDRESS_CHANGE":true,"PAYMENT_ISSUE":true,"COMMUNICATION_FAILURE":true,"PAYMENT_RECEIVED":false,"JOB_SCHEDULED":false}';
alter table public.staff_sms_outbox drop constraint staff_sms_outbox_event_type_check;
alter table public.staff_sms_outbox add constraint staff_sms_outbox_event_type_check check(event_type in
 ('NEW_LEAD','QUOTE_ACCEPTED','SALVADOR_NEEDED','TEST','QUOTE_READY','CUSTOM_WORK','SCHEDULE_CHANGE','ORDER_CHANGE','ADDRESS_CHANGE','PAYMENT_ISSUE','COMMUNICATION_FAILURE','PAYMENT_RECEIVED','JOB_SCHEDULED'));

-- Opaque locators are not access tokens. Resolving one requires existing staff
-- authentication, and the destination still uses the normal dashboard gate/RLS.
create table public.staff_alert_links(code text primary key, destination text not null unique
 check(destination ~ '^/admin/(leads|quotes|jobs|money/invoices)/[0-9a-f-]{36}$'),created_at timestamptz not null default now());
alter table public.staff_alert_links enable row level security;
revoke all on public.staff_alert_links from public,anon,authenticated;
grant all on public.staff_alert_links to service_role;
create function public.staff_alert_link(p_destination text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare code_value text;
begin
 perform pg_advisory_xact_lock(hashtextextended('staff-link:'||p_destination,0));
 select code into code_value from public.staff_alert_links where destination=p_destination;
 if code_value is null then
  loop
   code_value:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
   begin insert into public.staff_alert_links(code,destination) values(code_value,p_destination); exit;
   exception when unique_violation then null; end;
  end loop;
 end if;
 return 'monkeytrucking.llc/a/'||code_value;
end $$;
create function public.resolve_staff_alert_link(p_code text) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin_or_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 return (select destination from public.staff_alert_links where code=upper(p_code));
end $$;
revoke all on function public.staff_alert_link(text),public.resolve_staff_alert_link(text) from public,anon,authenticated;
grant execute on function public.staff_alert_link(text) to service_role;
grant execute on function public.resolve_staff_alert_link(text) to authenticated,service_role;

create or replace function public.staff_sms_enabled(p_type text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select enabled and opted_out_at is null and case p_type when 'TEST' then true when 'NEW_LEAD' then new_lead when 'QUOTE_ACCEPTED' then quote_accepted when 'SALVADOR_NEEDED' then salvador_needed else coalesce((preferences->>p_type)::boolean,false) end from public.staff_sms_settings where id=1),false);
$$;
create function public.save_staff_sms_preferences(p_enabled boolean,p_preferences jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin_or_staff() then raise exception 'Staff access required'; end if;
 if p_enabled is null or jsonb_typeof(p_preferences) is distinct from 'object' or exists(select 1 from jsonb_each(p_preferences) e
 where e.key not in ('NEW_LEAD','QUOTE_ACCEPTED','SALVADOR_NEEDED','QUOTE_READY','CUSTOM_WORK','SCHEDULE_CHANGE','ORDER_CHANGE','ADDRESS_CHANGE','PAYMENT_ISSUE','COMMUNICATION_FAILURE','PAYMENT_RECEIVED','JOB_SCHEDULED') or jsonb_typeof(e.value)<>'boolean') then raise exception 'Invalid alert preferences'; end if;
 update public.staff_sms_settings set enabled=p_enabled,
 new_lead=coalesce((p_preferences->>'NEW_LEAD')::boolean,new_lead),quote_accepted=coalesce((p_preferences->>'QUOTE_ACCEPTED')::boolean,quote_accepted),
 salvador_needed=coalesce((p_preferences->>'SALVADOR_NEEDED')::boolean,salvador_needed),
 preferences=preferences||(p_preferences-'NEW_LEAD'-'QUOTE_ACCEPTED'-'SALVADOR_NEEDED'),updated_at=now() where id=1;
 insert into public.activity_history(entity_type,event_type,summary,actor_id,actor_label,metadata)
 values('SYSTEM','STAFF_SMS_SETTINGS_CHANGED','Staff SMS alert preferences updated',auth.uid(),'Staff',jsonb_build_object('enabled',p_enabled,'preferences',p_preferences));
end $$;
revoke all on function public.save_staff_sms_preferences(boolean,jsonb) from public,anon;
grant execute on function public.save_staff_sms_preferences(boolean,jsonb) to authenticated,service_role;

create or replace function public.staff_notification_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.customers%rowtype; q public.quotes%rowtype; j public.jobs%rowtype; label text; detail text; kind text; alert_type text; destination text; event_key text; amount numeric; materials text;
begin
 select * into c from public.customers where id=new.customer_id;
 if c.id is null or public.is_internal_sms_phone(c.phone) then return new; end if;
 label:=case when c.name ~* '^(unknown|sms customer)' then coalesce(c.phone,'New customer') else c.name||coalesce(' · '||c.phone,'') end;
 label:=left(regexp_replace(label,'[\n\r]+',' ','g'),90);
 if tg_table_name='leads' then
  alert_type:='NEW_LEAD';event_key:='lead:'||new.id;destination:='/admin/leads/'||new.id;detail:=new.need;
 elsif tg_table_name='quotes' then
  if new.status<>'ACCEPTED' then return new; end if;
  if tg_op='UPDATE' then if old.status=new.status then return new; end if; end if;
  alert_type:='QUOTE_ACCEPTED';event_key:='quote-accepted:'||new.id;destination:='/admin/quotes/'||new.id;
  detail:=new.quote_number||' · $'||to_char(new.grand_total,'FM999999990.00');
 elsif tg_table_name='invoices' then
  if new.status<>'PAID' or new.paid_at is null then return new; end if;
  if tg_op='UPDATE' then if old.status=new.status then return new; end if; end if;
  select coalesce(sum(p.amount),0) into amount from public.payments p where p.invoice_id=new.id and p.voided_at is null and p.confirmed_by in ('HUMAN','PROCESSOR');
  if amount<new.amount then return new; end if;
  alert_type:='PAYMENT_RECEIVED';event_key:='payment-received:'||new.id;destination:='/admin/money/invoices/'||new.id;
  detail:='Invoice '||new.invoice_number||' · $'||to_char(new.amount,'FM999999990.00')||' paid';
 elsif tg_table_name='jobs' then
  if new.status<>'SCHEDULED' then return new; end if;
  if tg_op='UPDATE' then if old.status=new.status then return new; end if; end if;
  alert_type:='JOB_SCHEDULED';event_key:='job-scheduled:'||new.id;destination:='/admin/jobs/'||new.id;
  detail:=to_char(new.scheduled_date,'Mon DD')||coalesce(' at '||to_char(new.scheduled_time,'FMHH12:MI AM'),'');
 elsif tg_table_name='activity_history' then
  if new.event_type<>'AI_ACTION_OPEN' then return new; end if;
  kind:=new.metadata->>'kind';
  alert_type:=case when kind in ('QUOTE_READY','CUSTOM_WORK','SCHEDULE_CHANGE','ORDER_CHANGE','ADDRESS_CHANGE') then kind when kind='PAYMENT_CLAIM' then 'PAYMENT_ISSUE' when kind='COMMUNICATION_FAILURE' then kind else 'SALVADOR_NEEDED' end;
  detail:=case kind when 'CUSTOM_WORK' then 'Custom work needs pricing' when 'QUOTE_READY' then 'Review and send the prepared quote' when 'HUMAN_REQUEST' then 'Customer requested Salvador' when 'PAYMENT_CLAIM' then 'Customer reports payment. Verify it was received' when 'CONTACT_REVIEW' then 'Contact information needs review' when 'SCHEDULE_CHANGE' then 'Customer requested a new delivery time' when 'ORDER_CHANGE' then 'Customer requested an order change' when 'ADDRESS_CHANGE' then 'New address needs delivery pricing review' when 'COMPLAINT' then 'Customer complaint needs your reply' when 'COMMUNICATION_FAILURE' then 'Customer communication failed. Check the conversation' else 'Customer request needs your review' end;
  if kind='CUSTOM_WORK' and coalesce(new.metadata->>'request','') ~* 'driveway|road' then detail:='Driveway work needs pricing'; end if;
  if kind='QUOTE_READY' then
   select * into q from public.quotes where id::text=new.metadata->>'quote_id' and customer_id=c.id;
   if q.id is not null then
    select string_agg(rtrim(to_char(qi.yards,'FM999990.99'),'.')||' yd '||qi.description,', ' order by qi.created_at,qi.id) into materials from public.quote_items qi where qi.quote_id=q.id and qi.kind='MATERIAL';
    detail:=coalesce(left(materials,90)||E'\n','')||q.quote_number||' · $'||to_char(q.grand_total,'FM999999990.00')
     ||coalesce(' · '||to_char(q.requested_delivery_date,'Mon DD'),'')||coalesce(' at '||to_char(q.requested_delivery_time,'FMHH12:MI AM'),'');
   end if;
  end if;
  if kind in ('SCHEDULE_CHANGE','ORDER_CHANGE','ADDRESS_CHANGE') then detail:=detail||coalesce(E'\n'||left(nullif(new.metadata->>'request',''),120),''); end if;
  if kind='SCHEDULE_CHANGE' then
   select * into j from public.jobs where id::text=new.metadata->>'job_id' and customer_id=c.id;
   if j.scheduled_date is not null then detail:=detail||E'\nCurrent: '||to_char(j.scheduled_date,'Mon DD')||coalesce(' at '||to_char(j.scheduled_time,'FMHH12:MI AM'),''); end if;
  end if;
  destination:=case when kind='QUOTE_READY' and nullif(new.metadata->>'quote_id','') is not null then '/admin/quotes/'||(new.metadata->>'quote_id') when kind='SCHEDULE_CHANGE' and nullif(new.metadata->>'job_id','') is not null then '/admin/jobs/'||(new.metadata->>'job_id') when kind='PAYMENT_CLAIM' and nullif(new.metadata->>'invoice_id','') is not null then '/admin/money/invoices/'||(new.metadata->>'invoice_id') else '/admin/leads/'||new.entity_id end;
  event_key:='staff-action:'||new.id;
 else return new; end if;
 perform public.queue_staff_sms(alert_type,new.id,event_key,replace(alert_type,'_',' ')||E'\n'||label||E'\n'||left(coalesce(detail,'New inquiry'),180)||E'\n\nOpen: '||public.staff_alert_link(destination));
 return new;
end $$;
create trigger staff_sms_payment after insert or update on public.invoices for each row execute function public.staff_notification_event();
create trigger staff_sms_scheduled after insert or update on public.jobs for each row execute function public.staff_notification_event();

-- Preserve the approved provider template and its footer. Do not duplicate an
-- application footer in the test body; STOP/START continue using the same guard.
create or replace function public.queue_staff_sms_test(p_request_id uuid,p_actor_id uuid default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin_or_staff() and not (auth.role()='service_role' and exists(select 1 from public.user_roles where user_id=p_actor_id and role in ('admin','staff'))) then raise exception 'Staff access required'; end if;
 if p_request_id is null or not public.staff_sms_enabled('TEST') then raise exception 'Enable staff SMS notifications before sending a test'; end if;
 return public.queue_staff_sms('TEST',null,'test:'||p_request_id,E'TEST ALERT\nSalvador\nStaff SMS alerts are connected.\n\nOpen: monkeytrucking.llc/admin');
end $$;
do $$ declare d text; begin
 select pg_get_functiondef('public.authorize_staff_sms_dispatch(uuid,uuid,text)'::regprocedure) into d;
 d:=replace(d,'o.event_type=''SALVADOR_NEEDED'' and exists', 'o.operation_key like ''staff-action:%'' and exists');
 d:=replace(d,$old$o.body:='New lead: '||case when c.name ~* '^(unknown|sms customer)' then coalesce(c.phone,'Unknown contact') else c.name||coalesce(', '||c.phone,'') end||'. '||left(coalesce(need,'New inquiry'),220)||' https://www.monkeytrucking.llc/admin/leads/'||l.id;$old$,
 $new$o.body:=E'NEW LEAD\n'||case when c.name ~* '^(unknown|sms customer)' then coalesce(c.phone,'New customer') else c.name||coalesce(' · '||c.phone,'') end||E'\n'||left(coalesce(need,'New inquiry'),160)||E'\n\nOpen: '||public.staff_alert_link('/admin/leads/'||l.id);$new$);
 execute d;
end $$;
commit;