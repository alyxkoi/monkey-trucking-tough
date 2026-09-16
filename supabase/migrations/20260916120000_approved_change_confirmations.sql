begin;

-- A snapshot of saved business records, not the customer's proposed values.
create function public.ai_change_snapshot(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare h public.activity_history%rowtype; q public.quotes%rowtype; j public.jobs%rowtype; c public.customers%rowtype; k text; yards numeric;
begin
 select * into h from public.activity_history where id=p_request_id and event_type='AI_ACTION_OPEN';
 if not found then raise exception 'Request not found'; end if;
 select * into c from public.customers where id=h.customer_id;
 select * into q from public.quotes where id=(h.metadata->>'quote_id')::uuid and lead_id=h.entity_id and customer_id=h.customer_id;
 select * into j from public.jobs where quote_id=q.id and status not in ('CANCELLED','COMPLETED') order by created_at desc limit 1;
 k:=h.metadata->>'kind';
 if k='SCHEDULE_CHANGE' then
   if j.id is null or j.scheduled_date is null or j.scheduled_time is null then raise exception 'Save an actual job date and time before approving'; end if;
   return jsonb_build_object('kind',k,'job_id',j.id,'date',j.scheduled_date,'time',to_char(j.scheduled_time,'HH12:MI AM'));
 elsif k='ORDER_CHANGE' then
   if q.id is null or q.status not in ('SENT','ACCEPTED') then raise exception 'A current sent or accepted order is required'; end if;
   select sum(i.yards) into yards from public.quote_items i where i.quote_id=q.id and i.kind='MATERIAL';
   if yards is null or yards<=0 then raise exception 'Save the approved material quantities before approving'; end if;
   return jsonb_build_object('kind',k,'quote_id',q.id,'yards',yards,'total',q.grand_total,'items',(select jsonb_agg(jsonb_build_object('id',i.id,'material_id',i.material_id,'description',i.description,'yards',i.yards,'line_total',i.line_total) order by i.id) from public.quote_items i where i.quote_id=q.id));
 elsif k='ADDRESS_CHANGE' then
   if q.id is null or q.status not in ('SENT','ACCEPTED') or nullif(trim(coalesce(j.address,q.address)),'') is null then raise exception 'Save the approved delivery address before approving'; end if;
   if j.id is not null and j.address is distinct from q.address then raise exception 'Job and quote delivery addresses must agree before notifying'; end if;
   return jsonb_build_object('kind',k,'quote_id',q.id,'job_id',j.id,'address',coalesce(j.address,q.address),'total',q.grand_total);
 elsif k='CONTACT_REVIEW' then
   if nullif(trim(c.email),'') is null then raise exception 'Save the approved contact email first'; end if;
   return jsonb_build_object('kind',k,'email',c.email);
 elsif k='CUSTOM_WORK' then
   if q.id is null or q.status not in ('SENT','ACCEPTED') or not exists(select 1 from public.quote_items where quote_id=q.id and kind='CUSTOM_WORK') then raise exception 'Save and send the reviewed custom work quote before approving'; end if;
   return jsonb_build_object('kind',k,'quote_id',q.id,'total',q.grand_total,'description',q.description);
 end if;
 raise exception 'This action is handled through its existing review workflow, not change approval';
end $$;
revoke all on function public.ai_change_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.ai_change_snapshot(uuid) to service_role;

create function public.preview_ai_change_approval(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin_or_staff() then raise exception 'Staff access required'; end if;
 if exists(select 1 from public.activity_history where event_type='AI_ACTION_RESOLVED' and metadata->>'request_id'=p_request_id::text) then raise exception 'Request is already resolved'; end if;
 return public.ai_change_snapshot(p_request_id);
end $$;
revoke all on function public.preview_ai_change_approval(uuid) from public,anon;
grant execute on function public.preview_ai_change_approval(uuid) to authenticated;

create function public.decide_ai_staff_action(p_request_id uuid,p_note text,p_outcome text,p_expected jsonb default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare h public.activity_history%rowtype; r public.activity_history%rowtype; snapshot jsonb; m jsonb; body text; es boolean; send_at timestamptz;
begin
 if not public.is_admin_or_staff() then raise exception 'Staff access required'; end if;
 if p_outcome not in ('APPROVED','REJECTED','CANCELLED','HANDLED') or length(trim(coalesce(p_note,'')))<3 then raise exception 'Choose an outcome and add a resolution note'; end if;
 select * into h from public.activity_history where id=p_request_id and event_type='AI_ACTION_OPEN';
 if not found then raise exception 'Request not found'; end if;
 -- Same lock order as customer messaging and lifecycle writes.
 perform 1 from public.customers where id=h.customer_id for update;
 perform 1 from public.leads where id=h.entity_id for update;
 perform 1 from public.activity_history where id=p_request_id for update;
 select * into r from public.activity_history where event_type='AI_ACTION_RESOLVED' and metadata->>'request_id'=p_request_id::text;
 if found then
   if r.metadata->>'outcome' is distinct from p_outcome then raise exception 'Request is already resolved'; end if;
   return r.metadata;
 end if;
 if p_outcome='APPROVED' then
   perform 1 from public.quotes where id=(h.metadata->>'quote_id')::uuid for update;
   perform 1 from public.jobs where quote_id=(h.metadata->>'quote_id')::uuid for update;
   perform 1 from public.quote_items where quote_id=(h.metadata->>'quote_id')::uuid for update;
   snapshot:=public.ai_change_snapshot(p_request_id);
   if p_expected is null or snapshot is distinct from p_expected then raise exception 'Saved details changed. Review the latest values before approving'; end if;
   if not exists(select 1 from public.customers where id=h.customer_id and sms_consent_at is not null and sms_double_opt_in_at is not null and sms_opted_out_at is null) then raise exception 'Confirmed SMS consent is required to approve and notify'; end if;
   select coalesce(lm.body,'')~*'\m(hola|quiero|necesito|yardas|entrega|gracias|correo)\M' into es from public.lead_messages lm where lead_id=h.entity_id and sender_type='CUSTOMER' order by created_at desc,id desc limit 1;
   body:=case snapshot->>'kind'
     when 'SCHEDULE_CHANGE' then case when es then 'listo, su entrega está confirmada para ' else 'you''re all set, your delivery is confirmed for ' end||to_char((snapshot->>'date')::date,'FMDay, FMMonth FMDD')||case when es then ' a las ' else ' at ' end||(snapshot->>'time')||'.'
     when 'ORDER_CHANGE' then case when es then 'listo, su pedido aprobado es de ' else 'you''re all set, your approved order is now ' end||(snapshot->>'yards')||case when es then ' yardas. total aprobado: $' else ' yards. approved total: $' end||to_char((snapshot->>'total')::numeric,'FM999999990.00')||'.'
     when 'ADDRESS_CHANGE' then case when es then 'listo, la dirección de entrega aprobada es ' else 'you''re all set, the approved delivery address is ' end||(snapshot->>'address')||'.'
     when 'CONTACT_REVIEW' then case when es then 'listo, su correo ahora es ' else 'you''re all set, your email is now ' end||(snapshot->>'email')||'.'
     when 'CUSTOM_WORK' then case when es then 'Salvador revisó el trabajo solicitado. el total de la cotización enviada es $' else 'Salvador reviewed the requested work. the sent quote total is $' end||to_char((snapshot->>'total')::numeric,'FM999999990.00')||'.'
   end;
   -- Explicit staff approval uses the existing human outbox path. It never
   -- resumes a paused AI. SMS protections run again at provider dispatch.
   m:=public.enqueue_sms(h.entity_id,body,'approved-change:'||h.id::text,'HUMAN',auth.uid(),null,null,null,jsonb_build_object('approved_request_id',h.id,'approved_snapshot',snapshot));
   send_at:=public.sms_business_time(now());
   if send_at is null then raise exception 'Business messaging hours are not configured'; end if;
   update public.sms_outbox set next_attempt_at=send_at,expires_at=send_at+interval '23 hours' where message_id=(m->>'id')::uuid;
 end if;
 insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_id,actor_label,metadata)
 values(h.customer_id,h.entity_type,h.entity_id,'AI_ACTION_RESOLVED',left(trim(p_note),500),auth.uid(),'Staff',jsonb_build_object('request_id',h.id,'outcome',p_outcome,'approved_snapshot',snapshot,'message_id',m->>'id')) returning * into r;
 return r.metadata;
end $$;
revoke all on function public.decide_ai_staff_action(uuid,text,text,jsonb) from public,anon;
grant execute on function public.decide_ai_staff_action(uuid,text,text,jsonb) to authenticated;

-- Retain every existing preflight, adding only a saved-value approval guard.
do $$ declare definition text; begin
 select pg_get_functiondef('public.authorize_sms_dispatch(uuid,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'reason:=case',E'reason:=case\n    when o.guard ? ''approved_request_id'' and not public.ai_change_confirmation_current(o.guard) then ''Approved change was withdrawn or saved details changed''\n    when o.guard ? ''approved_request_id'' and (c.sms_consent_at is null or c.sms_double_opt_in_at is null) then ''Double opt in is missing''\n    when o.guard ? ''approved_request_id'' and public.sms_business_time(now())>now() then ''Outside business messaging hours''');
 execute definition;
end $$;

create function public.ai_change_confirmation_current(p_guard jsonb) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare request_id uuid:=(p_guard->>'approved_request_id')::uuid;
begin
 if not exists(select 1 from public.activity_history where event_type='AI_ACTION_RESOLVED' and metadata->>'request_id'=request_id::text and metadata->>'outcome'='APPROVED') then return false; end if;
 return public.ai_change_snapshot(request_id)=p_guard->'approved_snapshot';
exception when others then return false;
end $$;
revoke all on function public.ai_change_confirmation_current(jsonb) from public,anon,authenticated;
grant execute on function public.ai_change_confirmation_current(jsonb) to service_role;

commit;
