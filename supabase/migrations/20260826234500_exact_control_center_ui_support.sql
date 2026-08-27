-- Exact Claude Control Center UI support.
-- Additive only: no production data is rewritten and no Ticket history is touched.

alter table public.leads add column if not exists notes text;

-- Approved admin preferences. These are operational settings, not provider
-- credentials, and default to the already-approved v1 behavior.
alter table public.control_center_settings
  add column if not exists ai_english boolean not null default true,
  add column if not exists ai_spanish boolean not null default true,
  add column if not exists human_takeover_on_reply boolean not null default true;

-- Keep the legacy DEMOLITION value valid without reinterpreting it. The approved
-- picker adds LIGHT_CLEARING as its own explicit category.
alter table public.jobs drop constraint if exists jobs_category_check;
alter table public.jobs add constraint jobs_category_check check (
  category in (
    'MATERIAL_DELIVERY', 'DRIVEWAY', 'DIRT_GRADING', 'POND',
    'LIGHT_CLEARING', 'DEMOLITION', 'OTHER'
  )
);

create or replace function public.create_quote_draft_from_lead(p_lead_id uuid)
returns table (id uuid, quote_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lead public.leads%rowtype;
  v_id uuid;
  v_number text;
  v_tax_rate numeric;
  v_tax_delivery boolean;
  v_custom_rule text;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  select * into v_lead from public.leads where public.leads.id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;

  select q.id, q.quote_number into v_id, v_number
  from public.quotes q where q.lead_id = p_lead_id and q.status <> 'VOID'
  order by q.created_at desc limit 1;
  if found then return query select v_id, v_number; return; end if;

  select tax_rate, tax_applies_to_delivery into v_tax_rate, v_tax_delivery
  from public.app_settings order by id limit 1;
  select custom_work_tax_rule into v_custom_rule
  from public.control_center_settings where id = 1;
  v_number := public.next_quote_number();
  insert into public.quotes (
    quote_number, customer_id, lead_id, status, description, address,
    delivery_load_count, tax_rate, tax_applies_to_delivery, custom_work_tax_rule
  ) values (
    v_number, v_lead.customer_id, v_lead.id, 'DRAFT', v_lead.need, '',
    1, coalesce(v_tax_rate, 0), coalesce(v_tax_delivery, true), coalesce(v_custom_rule, 'PENDING')
  ) returning public.quotes.id into v_id;
  update public.leads set status = 'QUOTED' where public.leads.id = p_lead_id;
  update public.customers set last_activity_at = now() where id = v_lead.customer_id;
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

create or replace function public.update_quote_draft_atomic(
  p_quote_id uuid, p_quote jsonb, p_items jsonb
)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_quote public.quotes%rowtype;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if v_quote.status <> 'DRAFT' then raise exception 'Only a draft quote can be edited'; end if;

  update public.quotes set
    description = coalesce(p_quote->>'description', ''),
    address = coalesce(p_quote->>'address', ''),
    delivery_type = nullif(p_quote->>'delivery_type', ''),
    delivery_miles = nullif(p_quote->>'delivery_miles', '')::numeric,
    delivery_fee_per_load = coalesce((p_quote->>'delivery_fee_per_load')::numeric, 0),
    delivery_load_count = greatest(coalesce((p_quote->>'delivery_load_count')::integer, 1), 1),
    delivery_total = coalesce((p_quote->>'delivery_total')::numeric, 0),
    materials_subtotal = coalesce((p_quote->>'materials_subtotal')::numeric, 0),
    custom_work_subtotal = coalesce((p_quote->>'custom_work_subtotal')::numeric, 0),
    tax_rate = coalesce((p_quote->>'tax_rate')::numeric, tax_rate),
    tax_applies_to_delivery = coalesce((p_quote->>'tax_applies_to_delivery')::boolean, tax_applies_to_delivery),
    custom_work_tax_rule = coalesce(nullif(p_quote->>'custom_work_tax_rule', ''), custom_work_tax_rule),
    tax_amount = coalesce((p_quote->>'tax_amount')::numeric, 0),
    grand_total = coalesce((p_quote->>'grand_total')::numeric, 0),
    notes = nullif(p_quote->>'notes', '')
  where id = p_quote_id;

  delete from public.quote_items where quote_id = p_quote_id;
  insert into public.quote_items (
    quote_id, kind, material_id, description, loads, yards,
    is_full_load, rate_used, line_total
  )
  select p_quote_id, item->>'kind', nullif(item->>'material_id', '')::uuid,
    item->>'description', nullif(item->>'loads', '')::integer,
    nullif(item->>'yards', '')::numeric,
    coalesce((item->>'is_full_load')::boolean, false),
    coalesce((item->>'rate_used')::numeric, 0),
    coalesce((item->>'line_total')::numeric, 0)
  from jsonb_array_elements(p_items) as elements(item);
end;
$$;

revoke all on function public.create_quote_draft_from_lead(uuid) from public, anon;
grant execute on function public.create_quote_draft_from_lead(uuid) to authenticated;
revoke all on function public.update_quote_draft_atomic(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_quote_draft_atomic(uuid, jsonb, jsonb) to authenticated;
