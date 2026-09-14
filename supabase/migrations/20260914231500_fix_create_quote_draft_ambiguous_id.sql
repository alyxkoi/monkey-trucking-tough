begin;

create or replace function public.create_quote_draft_from_lead(p_lead_id uuid)
returns table (id uuid, quote_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lead public.leads%rowtype;
  v_id uuid;
  v_number text;
  v_tax_enabled boolean;
  v_tax_rate numeric;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  select * into v_lead
  from public.leads
  where public.leads.id = p_lead_id
  for update;
  if not found then raise exception 'Lead not found'; end if;

  select q.id, q.quote_number into v_id, v_number
  from public.quotes q
  where q.lead_id = p_lead_id and q.status <> 'VOID'
  order by q.created_at desc
  limit 1;
  if found then
    return query select v_id, v_number;
    return;
  end if;

  select settings.tax_enabled, settings.tax_rate into v_tax_enabled, v_tax_rate
  from public.app_settings settings
  order by settings.id
  limit 1;

  v_number := public.next_quote_number();
  insert into public.quotes (
    quote_number, customer_id, lead_id, status, description, address,
    delivery_load_count, tax_rate, tax_applies_to_delivery, custom_work_tax_rule
  ) values (
    v_number, v_lead.customer_id, v_lead.id, 'DRAFT', v_lead.need, '',
    1, case when coalesce(v_tax_enabled, false) then coalesce(v_tax_rate, 0) else 0 end,
    false, 'EXEMPT'
  ) returning public.quotes.id into v_id;

  update public.leads set status = 'QUOTED' where public.leads.id = p_lead_id;
  update public.customers set last_activity_at = now() where public.customers.id = v_lead.customer_id;
  insert into public.activity_history (
    customer_id, entity_type, entity_id, event_type, summary, actor_label
  ) values (
    v_lead.customer_id, 'QUOTE', v_id, 'CREATED',
    'Quote ' || v_number || ' draft created',
    coalesce(auth.jwt()->>'email', auth.uid()::text)
  );

  return query select v_id, v_number;
end;
$$;

revoke all on function public.create_quote_draft_from_lead(uuid) from public, anon;
grant execute on function public.create_quote_draft_from_lead(uuid) to authenticated;

commit;
