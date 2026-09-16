alter table public.leads
  add column delivery_address text,
  add column requested_delivery_date date,
  add column requested_delivery_time time,
  add column requested_delivery_text text,
  add column quote_requested_at timestamptz,
  add column quote_confirmed_email text,
  add column handoff_ack_message_id uuid references public.lead_messages(id);
alter table public.quotes
  add column ai_ready_at timestamptz,
  add column requested_delivery_date date,
  add column requested_delivery_time time,
  add column confirmed_email text;

create unique index ai_lifecycle_source_once on public.activity_history(entity_id,event_type,(metadata->>'source_message_id'))
  where event_type='AI_LIFECYCLE_APPLIED';
create unique index ai_action_resolution_once on public.activity_history((metadata->>'request_id'))
  where event_type='AI_ACTION_RESOLVED';

create function public.open_ai_staff_action(p_lead_id uuid,p_source uuid,p_kind text,p_details jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.leads%rowtype; existing uuid; result uuid;
begin
 if p_kind not in ('QUOTE_READY','CUSTOM_WORK','HUMAN_REQUEST','SCHEDULE_CHANGE','ORDER_CHANGE','ADDRESS_CHANGE','PAYMENT_CLAIM','COMPLAINT','NEW_WORK','CONTACT_REVIEW') then raise exception 'Unsupported staff action'; end if;
 select * into l from public.leads where id=p_lead_id for update;
 if not found then raise exception 'Lead not found'; end if;
 select h.id into existing from public.activity_history h where h.entity_id=l.id and h.event_type='AI_ACTION_OPEN'
 and h.metadata->>'kind'=p_kind and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=h.id::text)
 order by h.created_at desc limit 1;
 if existing is not null then
   if p_kind in ('CUSTOM_WORK','HUMAN_REQUEST') or exists(select 1 from public.activity_history where id=existing and (metadata->>'source_message_id'=p_source::text or p_kind='QUOTE_READY' and metadata-'source_message_id'-'kind'=p_details)) then return existing; end if;
   insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
   values(l.customer_id,'LEAD',l.id,'AI_ACTION_RESOLVED','Superseded by a newer customer request','AI',jsonb_build_object('request_id',existing)) on conflict do nothing;
 end if;
 insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
 values(l.customer_id,'LEAD',l.id,'AI_ACTION_OPEN',replace(p_kind,'_',' '),'AI',
 coalesce(p_details,'{}')||jsonb_build_object('kind',p_kind,'source_message_id',p_source)) returning id into result;
 return result;
end $$;

create function public.resolve_ai_staff_action(p_request_id uuid,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare h public.activity_history%rowtype;
begin
 if not public.is_admin_or_staff() then raise exception 'Staff access required'; end if;
 if length(trim(coalesce(p_note,'')))<3 then raise exception 'A resolution note is required'; end if;
 select * into h from public.activity_history where id=p_request_id and event_type='AI_ACTION_OPEN' for update;
 if not found then raise exception 'Action not found'; end if;
 insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_id,actor_label,metadata)
 values(h.customer_id,h.entity_type,h.entity_id,'AI_ACTION_RESOLVED',left(trim(p_note),500),auth.uid(),'Staff',jsonb_build_object('request_id',h.id)) on conflict do nothing;
end $$;
revoke all on function public.resolve_ai_staff_action(uuid,text) from public,anon;
grant execute on function public.resolve_ai_staff_action(uuid,text) to authenticated;

create function public.open_ai_staff_actions() returns setof public.activity_history
language sql stable security definer set search_path=public,pg_temp as $$
 select h.* from public.activity_history h
 join public.leads l on l.id=h.entity_id join public.customers c on c.id=l.customer_id
 where public.is_admin_or_staff() and h.event_type='AI_ACTION_OPEN'
 and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=h.id::text)
 and (h.metadata->>'kind'<>'QUOTE_READY' or exists(select 1 from public.quotes q where q.id=(h.metadata->>'quote_id')::uuid and q.status='DRAFT' and q.ai_ready_at is not null and q.confirmed_email=c.email))
 and (h.metadata->>'kind'<>'HUMAN_REQUEST' or l.human_takeover)
 and (h.metadata->>'kind'<>'PAYMENT_CLAIM' or exists(select 1 from public.invoices i where i.id=(h.metadata->>'invoice_id')::uuid and i.status='SENT' and i.payment_claimed_at is not null))
 order by h.created_at;
$$;
revoke all on function public.open_ai_staff_actions() from public,anon;
grant execute on function public.open_ai_staff_actions() to authenticated;

create function public.invalidate_ai_quote_ready() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.status is distinct from old.status or new.grand_total is distinct from old.grand_total or new.address is distinct from old.address
 or new.delivery_fee_per_load is distinct from old.delivery_fee_per_load or new.notes is distinct from old.notes then new.ai_ready_at:=null; end if;
 return new;
end $$;
create trigger invalidate_ai_quote_ready before update on public.quotes for each row execute function public.invalidate_ai_quote_ready();
revoke all on function public.invalidate_ai_quote_ready() from public,anon,authenticated;

create function public.invalidate_ai_quote_items_ready() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.quotes set ai_ready_at=null where id=case when TG_OP='DELETE' then old.quote_id else new.quote_id end;
 return null;
end $$;
create trigger invalidate_ai_quote_items_ready after insert or update or delete on public.quote_items for each row execute function public.invalidate_ai_quote_items_ready();
revoke all on function public.invalidate_ai_quote_items_ready() from public,anon,authenticated;

create function public.apply_ai_lifecycle(p_lead_id uuid,p_expected_revision bigint,p_source_message_id uuid,p_plan jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.leads%rowtype; c public.customers%rowtype; m public.lead_messages%rowtype;
 q public.quotes%rowtype; j public.jobs%rowtype; i public.invoices%rowtype;
 before_customer jsonb; before_lead jsonb; before_quote jsonb; before_items jsonb; before_job jsonb; before_invoice jsonb;
 a text; v_email text; material_result jsonb; route_result jsonb; result jsonb; settings public.app_settings%rowtype;
 facts_only boolean; ready boolean:=false; new_lead uuid;
begin
 select * into l from public.leads where id=p_lead_id;
 select * into c from public.customers where id=l.customer_id for update;
 select * into l from public.leads where id=p_lead_id for update;
 if l.id is null or l.conversation_revision is distinct from p_expected_revision then return jsonb_build_object('status','STALE'); end if;
 select * into m from public.lead_messages where id=p_source_message_id and lead_id=l.id and customer_id=c.id and sender_type='CUSTOMER';
 if m.id is null or m.id is distinct from (select id from public.lead_messages where lead_id=l.id and sender_type='CUSTOMER' order by created_at desc,id desc limit 1)
 or (m.message_kind='COMPLIANCE' and upper(trim(m.body)) not in ('YES','SI','SÍ')) then return jsonb_build_object('status','STALE'); end if;
 if c.sms_opted_out_at is not null then return jsonb_build_object('status','OPTED_OUT'); end if;
 select metadata->'result' into result from public.activity_history where entity_id=l.id and event_type='AI_LIFECYCLE_APPLIED' and metadata->>'source_message_id'=m.id::text;
 if found then return result||jsonb_build_object('status','ALREADY_APPLIED'); end if;
 facts_only:=not l.human_takeover and nullif(p_plan->>'clarification','') is null and coalesce((p_plan->>'write_allowed')::boolean,false);
 select * into q from public.quotes where lead_id=l.id and status not in ('VOID','DECLINED') order by created_at desc limit 1 for update;
 select * into j from public.jobs where quote_id=q.id and status<>'CANCELLED' for update;
 before_customer:=jsonb_build_object('name',c.name,'email',c.email);
 before_lead:=jsonb_build_object('delivery_address',l.delivery_address,'requested_text',l.requested_delivery_text,'requested_date',l.requested_delivery_date,'requested_time',l.requested_delivery_time,'quote_confirmed_email',l.quote_confirmed_email,'quote_requested_at',l.quote_requested_at);
 before_quote:=to_jsonb(q); before_job:=to_jsonb(j);
 select coalesce(jsonb_agg(to_jsonb(qi)),'[]') into before_items from public.quote_items qi where quote_id=q.id;
 if facts_only then
   if nullif(p_plan->>'name','') is not null then
     if length(p_plan->>'name')>80 or position(lower(p_plan->>'name') in lower(m.body))=0 then raise exception 'Name must come from the current customer message'; end if;
   end if;
   v_email:=nullif(p_plan->>'email','');
   if v_email is not null then
     if length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or position(v_email in m.body)=0 then raise exception 'Email must come from the current customer message'; end if;
     if exists(select 1 from public.customers where id<>c.id and normalized_email=lower(v_email)) then
       perform public.open_ai_staff_action(l.id,m.id,'CONTACT_REVIEW',jsonb_build_object('request','Email is already associated with another customer. No records were merged.'));
       return jsonb_build_object('status','CONTACT_REVIEW');
     end if;
     update public.customers set email=v_email,normalized_email=lower(v_email),updated_at=now() where id=c.id;
   end if;
   if nullif(p_plan->>'name','') is not null then update public.customers set name=trim(p_plan->>'name'),updated_at=now() where id=c.id; end if;
   if j.id is null and (q.id is null or q.status='DRAFT') and p_plan#>>'{context,pricing,route,status}'='ROUTE_CALCULATED' then
     update public.leads set delivery_address=p_plan#>>'{context,pricing,route,destination}' where id=l.id;
   end if;
   if nullif(p_plan->>'confirmed_email','') is not null then
     if lower(p_plan->>'confirmed_email') is distinct from lower(coalesce(v_email,c.email)) then raise exception 'Confirmation does not match current email'; end if;
     update public.leads set quote_confirmed_email=coalesce(v_email,c.email) where id=l.id;
   end if;
   if coalesce((p_plan->>'quote_requested')::boolean,false) and (q.id is null or q.status='DRAFT') then update public.leads set quote_requested_at=coalesce(quote_requested_at,now()) where id=l.id; end if;
   if j.id is null and nullif(p_plan->>'requested_date','') is not null then
     if (p_plan->>'requested_date')::date<(now() at time zone 'America/Chicago')::date or (p_plan->>'requested_date')::date>(now() at time zone 'America/Chicago')::date+730 then raise exception 'Invalid requested date'; end if;
     update public.leads set requested_delivery_date=(p_plan->>'requested_date')::date,
       requested_delivery_time=nullif(p_plan->>'requested_time','')::time,requested_delivery_text=left(p_plan->>'requested_text',200) where id=l.id;
   end if;
   if j.id is not null and nullif(p_plan->>'job_note','') is not null then
     if length(p_plan->>'job_note')>500 or position(p_plan->>'job_note' in m.body)=0 then raise exception 'Job note must quote customer instructions'; end if;
     update public.jobs set notes=concat_ws(E'\n',nullif(notes,''),'Customer instruction: '||(p_plan->>'job_note')),updated_at=now() where id=j.id;
   end if;
   select * into l from public.leads where id=l.id;
   if q.id is null and coalesce((p_plan->>'ready')::boolean,false) then
     select * into settings from public.app_settings order by id limit 1;
     insert into public.quotes(quote_number,customer_id,lead_id,description,tax_rate,tax_applies_to_delivery)
       values('Q'||nextval('public.quote_number_seq'),c.id,l.id,l.need,case when settings.tax_enabled then settings.tax_rate else 0 end,settings.tax_applies_to_delivery) returning * into q;
   end if;
   if q.status='DRAFT' then
     if p_plan#>>'{context,pricing,quantity,status}'='RESOLVED' then
       material_result:=public.apply_ai_material_to_quote(l.id,p_expected_revision,(p_plan#>>'{context,pricing,material_id}')::uuid,(p_plan#>>'{context,pricing,yards}')::numeric);
     end if;
     if p_plan#>>'{context,pricing,route,status}'='ROUTE_CALCULATED' then
       route_result:=public.apply_ai_route_to_quote(l.id,p_expected_revision,p_plan#>>'{context,pricing,route,destination}',p_plan#>>'{context,pricing,route,origin}',(p_plan#>>'{context,pricing,route,distance_miles}')::numeric,p_plan#>>'{context,pricing,route,destination_place_id}');
     end if;
     ready:=coalesce((p_plan->>'ready')::boolean,false) and l.quote_requested_at is not null and l.quote_confirmed_email is not null
       and l.requested_delivery_date is not null and l.requested_delivery_time is not null
       and material_result->>'status'='APPLIED' and route_result->>'status'='APPLIED';
     update public.quotes set requested_delivery_date=l.requested_delivery_date,requested_delivery_time=l.requested_delivery_time,
       confirmed_email=l.quote_confirmed_email,ai_ready_at=case when ready then now() else null end where id=q.id;
     if ready then perform public.open_ai_staff_action(l.id,m.id,'QUOTE_READY',jsonb_build_object('quote_id',q.id,'email',l.quote_confirmed_email,'date',l.requested_delivery_date,'time',l.requested_delivery_time)); end if;
     if coalesce((p_plan->>'ready')::boolean,false) and not ready then perform public.open_ai_staff_action(l.id,m.id,'ORDER_CHANGE',jsonb_build_object('quote_id',q.id,'request','Customer wants a quote; staff-protected draft needs review.')); end if;
   end if;
 end if;
 for a in select jsonb_array_elements_text(coalesce(p_plan->'actions','[]')) loop
   if a='PAYMENT_CLAIM' then
     select * into i from public.invoices where customer_id=c.id and status='SENT' and (quote_id=q.id or job_id=j.id) order by created_at desc limit 1 for update;
     before_invoice:=to_jsonb(i);
     if i.id is not null then update public.invoices set payment_claimed_at=now(),payment_claim_note=m.body,updated_at=now() where id=i.id; end if;
   end if;
   if a='NEW_WORK' and j.status='COMPLETED' then
     select id into new_lead from public.leads where customer_id=c.id and status in ('NEW','ACTIVE') and id<>l.id order by created_at desc limit 1;
     if new_lead is null then insert into public.leads(customer_id,source,need,status) values(c.id,'Other',left(m.body,1000),'ACTIVE') returning id into new_lead; end if;
   end if;
   perform public.open_ai_staff_action(l.id,m.id,a,(p_plan->'context')||jsonb_build_object('requested_date',p_plan->>'requested_date','requested_time',p_plan->>'requested_time','new_lead_id',new_lead));
 end loop;
 result:=jsonb_build_object('status','APPLIED','quote_id',q.id,'ready',coalesce(ready,false),'material',material_result,'route',route_result,'new_lead_id',new_lead);
 insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
 values(c.id,'LEAD',l.id,'AI_LIFECYCLE_APPLIED','AI processed customer facts and staff actions','AI',jsonb_build_object(
   'source_message_id',m.id,'result',result,'quote_id',q.id,'job_id',j.id,'invoice_id',i.id,
   'before',jsonb_build_object('customer',before_customer,'lead',before_lead,'quote',before_quote,'quote_items',before_items,'job',before_job,'invoice',before_invoice),
   'after',jsonb_build_object('customer',(select jsonb_build_object('name',name,'email',email) from public.customers where id=c.id),
     'lead',(select jsonb_build_object('delivery_address',delivery_address,'requested_text',requested_delivery_text,'requested_date',requested_delivery_date,'requested_time',requested_delivery_time,'quote_confirmed_email',quote_confirmed_email,'quote_requested_at',quote_requested_at) from public.leads where id=l.id),
     'quote',(select to_jsonb(x) from public.quotes x where id=q.id),'quote_items',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.quote_items x where quote_id=q.id),
     'job',(select to_jsonb(x) from public.jobs x where id=j.id),'invoice',(select to_jsonb(x) from public.invoices x where id=i.id))));
 return result;
end $$;

create function public.finish_ai_handoff(p_job_id uuid,p_lease_token uuid,p_spanish boolean,p_template_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.communication_jobs%rowtype; result jsonb;
begin
 select * into j from public.communication_jobs where id=p_job_id;
 if j.kind is distinct from 'AI_REPLY' then raise exception 'Handoff must be a customer reply'; end if;
 result:=public.finish_communication_job(p_job_id,p_lease_token,case when p_spanish then 'claro, le aviso a Salvador para que revise su mensaje.' else 'got it, I will have Salvador take a look at this.' end,p_template_id,null);
 if result->>'id' is not null then
   update public.leads set human_takeover=true,handoff_ack_message_id=(result->>'id')::uuid,updated_at=now() where id=j.lead_id;
   perform public.open_ai_staff_action(j.lead_id,j.trigger_message_id,'HUMAN_REQUEST',jsonb_build_object('message_id',result->>'id'));
 end if;
 return result;
end $$;

do $$ declare definition text; begin
 select pg_get_functiondef('public.authorize_sms_dispatch(uuid,uuid)'::regprocedure) into definition;
 if position('(l.human_takeover or o.conversation_revision<>l.conversation_revision)' in definition)=0 then raise exception 'Dispatch guard changed; review handoff integration'; end if;
 definition:=replace(definition,'(l.human_takeover or o.conversation_revision<>l.conversation_revision)',
 '((l.human_takeover and l.handoff_ack_message_id is distinct from m.id) or o.conversation_revision<>l.conversation_revision)');
 execute definition;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('open_ai_staff_action','apply_ai_lifecycle','finish_ai_handoff') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   foreach t in array array['activity_history','quotes','jobs','invoices','payments'] loop
     if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
   end loop;
 end if;
end $$;