begin;

-- Keep using the existing lifecycle transaction and deterministic pricing tools.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.apply_ai_lifecycle(uuid,bigint,uuid,jsonb)'::regprocedure) into definition;
  if position('l.quote_requested_at is not null and p_plan#>>' in definition)>0 then return; end if;
  if position('if q.id is null and coalesce((p_plan->>''ready'')::boolean,false)' in definition)=0 then
    raise exception 'Unexpected lifecycle definition';
  end if;
  definition:=replace(definition,
    'nullif(p_plan->>''clarification'','''') is null',
    '(nullif(p_plan->>''clarification'','''') is null or p_plan->>''clarification''=''DATE_TIME'')');
  definition:=replace(definition,
    'if q.id is null and coalesce((p_plan->>''ready'')::boolean,false) then',
    'if q.id is null and l.quote_requested_at is not null and p_plan#>>''{context,pricing,status}''=''MATERIAL_CALCULATED'' then');
  definition:=replace(definition,
    'description,tax_rate,tax_applies_to_delivery)',
    'description,notes,tax_rate,tax_applies_to_delivery)');
  definition:=replace(definition,'c.id,l.id,l.need,case when settings.tax_enabled','c.id,l.id,l.need,l.notes,case when settings.tax_enabled');
  definition:=replace(definition,'settings.tax_applies_to_delivery) returning * into q;',
    'settings.tax_applies_to_delivery) returning * into q;
     update public.leads set status=''QUOTED'',updated_at=now() where id=l.id and status=''NEW'';');
  definition:=replace(definition,
    'v_confirmed_email is distinct from lower(coalesce(c.email,'''')))',
    'v_confirmed_email is distinct from lower(coalesce(c.email,'''')) and not exists (
      select 1 from (select body from public.lead_messages where lead_id=l.id and sender_type in (''AI'',''HUMAN'') and created_at<=m.created_at order by created_at desc,id desc limit 1) prior
      where position(v_confirmed_email in lower(prior.body))>0 and position(''?'' in prior.body)>0
        and lower(trim(evidence.body,'' .!'')) in (''yes'',''yeah'',''yep'',''sure'',''ok'',''okay'',''si'',''sí'',''claro'',''correct'',''correcto'',''yes please'')))');
  -- Date-only intake is durable even while we clarify the time.
  definition:=replace(definition,
    'requested_delivery_time=nullif(p_plan->>''requested_time'','''')::time',
    'requested_delivery_time=case when requested_delivery_date=(p_plan->>''requested_date'')::date then coalesce(nullif(p_plan->>''requested_time'','''')::time,requested_delivery_time) else nullif(p_plan->>''requested_time'','''')::time end');
  execute definition;
end $migration$;

-- The confirmed quote recipient is the sender's existing source of truth.
-- Profile email is never changed by this staff action.
create or replace function public.confirm_quote_recipient(p_quote_id uuid,p_email text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.quotes%rowtype; recipient text:=lower(trim(coalesce(p_email,'')));
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
  if length(recipient)>254 or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid quote recipient email'; end if;
  -- Match lifecycle lock order: lead before quote.
  perform 1 from public.leads where id=(select lead_id from public.quotes where id=p_quote_id) for update;
  select * into q from public.quotes where id=p_quote_id for update;
  if q.id is null or q.status<>'DRAFT' then raise exception 'Only a draft quote recipient can be changed'; end if;
  if q.confirmed_email is distinct from recipient then
    update public.quotes set confirmed_email=recipient,updated_at=now() where id=q.id;
    update public.leads set quote_confirmed_email=recipient,conversation_revision=conversation_revision+1,updated_at=now() where id=q.lead_id;
    insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
    values(q.customer_id,'QUOTE',q.id,'RECIPIENT_CONFIRMED','Staff confirmed the quote recipient',coalesce(auth.uid()::text,'Staff'),
      jsonb_build_object('previous_email',q.confirmed_email,'confirmed_email',recipient,'confirmed_at',now()));
  end if;
  return recipient;
end $$;
revoke all on function public.confirm_quote_recipient(uuid,text) from public,anon;
grant execute on function public.confirm_quote_recipient(uuid,text) to authenticated;

-- Manual creation also carries durable intake, and reuses only the latest
-- successful current-message calculation. The existing tools protect edits.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.create_quote_draft_from_lead(uuid)'::regprocedure) into definition;
  if position('preparation jsonb' in definition)>0 then return; end if;
  definition:=replace(definition,'v_tax_rate numeric;','v_tax_rate numeric; preparation jsonb;');
  definition:=replace(definition,
    'delivery_load_count, tax_rate, tax_applies_to_delivery, custom_work_tax_rule',
    'delivery_load_count, tax_rate, tax_applies_to_delivery, custom_work_tax_rule, requested_delivery_date, requested_delivery_time, confirmed_email, notes');
  definition:=replace(definition,'v_lead.need, '''',','v_lead.need, coalesce(v_lead.delivery_address,''''),');
  definition:=replace(definition,'false, ''EXEMPT''','false, ''EXEMPT'', v_lead.requested_delivery_date, v_lead.requested_delivery_time, v_lead.quote_confirmed_email, v_lead.notes');
  definition:=replace(definition,'update public.leads set status = ''QUOTED''',
    'select tool_results->''pricing'' into preparation from public.ai_audit_logs
      where lead_id=v_lead.id and status=''SUCCESS''
        and decision#>>''{dashboard_proposal,source_message_id}''=(select m.id::text from public.lead_messages m where m.lead_id=v_lead.id and m.sender_type=''CUSTOMER'' order by m.created_at desc,m.id desc limit 1)
      order by created_at desc limit 1;
    if preparation->>''status''=''MATERIAL_CALCULATED'' and preparation#>>''{quantity,status}''=''RESOLVED'' then
      perform public.apply_ai_material_to_quote(v_lead.id,v_lead.conversation_revision,(preparation->>''material_id'')::uuid,(preparation->>''yards'')::numeric);
      if preparation#>>''{route,status}''=''ROUTE_CALCULATED'' then
        perform public.apply_ai_route_to_quote(v_lead.id,v_lead.conversation_revision,preparation#>>''{route,destination}'',preparation#>>''{route,origin}'',(preparation#>>''{route,distance_miles}'')::numeric,preparation#>>''{route,destination_place_id}'');
      end if;
    end if;
    update public.leads set status = ''QUOTED''');
  execute definition;
end $migration$;

commit;
