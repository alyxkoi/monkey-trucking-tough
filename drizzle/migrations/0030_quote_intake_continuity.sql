begin;

-- First committed inbound path only; diagnostics never change replay protection.
alter table public.sms_webhook_events add column if not exists ingress_timings jsonb;

-- Reuse the last audited calculation across acknowledgement-only turns, not
-- across corrections, new addresses, product changes, or ambiguous messages.
-- Existing deterministic tools still recalculate catalog prices and preserve
-- manual items/delivery, takeover, revision and protected-quote guards.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.create_quote_draft_from_lead(uuid)'::regprocedure) into definition;
  if position('acknowledgement-only' in definition)>0 then return; end if;
  if position('select tool_results->''pricing'' into preparation' in definition)=0 then raise exception 'Unexpected manual quote function'; end if;
  definition:=replace(definition,
    'select tool_results->''pricing'' into preparation from public.ai_audit_logs
      where lead_id=v_lead.id and status=''SUCCESS''
        and decision#>>''{dashboard_proposal,source_message_id}''=(select m.id::text from public.lead_messages m where m.lead_id=v_lead.id and m.sender_type=''CUSTOMER'' order by m.created_at desc,m.id desc limit 1)
      order by created_at desc limit 1;',
    'select audit.tool_results->''pricing'' into preparation from public.ai_audit_logs audit
      join public.lead_messages source on source.id::text=audit.decision#>>''{dashboard_proposal,source_message_id}'' and source.lead_id=v_lead.id
      where audit.lead_id=v_lead.id and audit.status=''SUCCESS'' and audit.created_at>now()-interval ''24 hours''
        -- acknowledgement-only continuation of the same verified intake
        and not exists(select 1 from public.lead_messages newer where newer.lead_id=v_lead.id and newer.sender_type=''CUSTOMER''
          and (newer.created_at,newer.id)>(source.created_at,source.id)
          and lower(trim(newer.body,'' .!'')) not in (''yes'',''yes please'',''yeah'',''yep'',''sure'',''please do'',''send it'',''ok'',''okay'',''si'',''sí'',''claro'',''correct'',''correcto''))
      order by audit.created_at desc,audit.id desc limit 1;');
  if position('acknowledgement-only' in definition)=0 then raise exception 'Quote prefill replacement did not match'; end if;
  execute definition;
end $migration$;

commit;