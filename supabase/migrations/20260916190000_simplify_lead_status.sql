begin;

-- Talking was a UI label for the legacy ACTIVE value, not a business stage.
-- Stop the two current server paths from creating ACTIVE rows while retaining
-- the value in the old check constraint so historical restores stay readable.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.record_inbound_sms(text,text,text,text,timestamptz)'::regprocedure) into definition;
  if position('values(c.id,''Other'',left(trim(p_body),1000),''ACTIVE'',p_received_at)' in definition)=0 then
    raise exception 'record_inbound_sms lead-status rule changed; manual migration review required';
  end if;
  definition=replace(definition,
    'values(c.id,''Other'',left(trim(p_body),1000),''ACTIVE'',p_received_at)',
    'values(c.id,''Other'',left(trim(p_body),1000),''NEW'',p_received_at)');
  execute definition;

  select pg_get_functiondef('public.apply_ai_lifecycle(uuid,bigint,uuid,jsonb)'::regprocedure) into definition;
  if position('values(c.id,''Other'',left(m.body,1000),''ACTIVE'')' in definition)=0 then
    raise exception 'apply_ai_lifecycle lead-status rule changed; manual migration review required';
  end if;
  definition=replace(definition,
    'values(c.id,''Other'',left(m.body,1000),''ACTIVE'')',
    'values(c.id,''Other'',left(m.body,1000),''NEW'')');
  execute definition;
end $$;

-- Existing ACTIVE rows with a quote belong in QUOTED. Everything else remains
-- an open NEW opportunity; messages and human-takeover state continue to carry
-- conversation activity independently.
update public.leads l
set status=case
  when exists(select 1 from public.quotes q where q.lead_id=l.id and q.status not in ('VOID','DECLINED')) then 'QUOTED'
  else 'NEW'
end,
updated_at=now()
where l.status='ACTIVE';

commit;
