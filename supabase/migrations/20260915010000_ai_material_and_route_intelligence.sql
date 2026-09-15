begin;

alter table public.materials
  add column if not exists tons_per_cubic_yard numeric,
  add column if not exists tons_conversion_basis text not null default 'OPERATIONAL_ESTIMATE',
  add column if not exists tons_conversion_verified boolean not null default false,
  add column if not exists tons_conversion_note text;

alter table public.materials drop constraint if exists materials_tons_per_cubic_yard_check;
alter table public.materials add constraint materials_tons_per_cubic_yard_check
  check (tons_per_cubic_yard is null or tons_per_cubic_yard > 0 and tons_per_cubic_yard <= 5);
alter table public.materials drop constraint if exists materials_tons_conversion_basis_check;
alter table public.materials add constraint materials_tons_conversion_basis_check
  check (tons_conversion_basis in ('OPERATIONAL_ESTIMATE','SUPPLIER_TICKET','LAB_TEST'));

-- These are deliberately marked unverified operational estimates. The dashboard
-- makes the basis visible so Salvador can replace each one with the average from
-- actual supplier scale tickets without changing historical quote snapshots.
update public.materials
set tons_per_cubic_yard = case sort_order
    when 1 then 1.40 when 2 then 1.35 when 3 then 1.35 when 4 then 1.40
    when 5 then 1.35 when 6 then 1.25 when 7 then 1.35 when 8 then 1.40
    when 9 then 1.35 when 10 then 1.40 else tons_per_cubic_yard end,
    tons_conversion_basis = 'OPERATIONAL_ESTIMATE',
    tons_conversion_verified = false,
    tons_conversion_note = coalesce(tons_conversion_note, 'Initial loose-material estimate. Replace with the average from supplier scale tickets.'),
    updated_at = now()
where tons_per_cubic_yard is null and sort_order between 1 and 10;

alter table public.control_center_settings
  add column if not exists route_intelligence_enabled boolean not null default true,
  add column if not exists route_status text not null default 'SETUP_REQUIRED';
alter table public.control_center_settings drop constraint if exists control_center_settings_route_status_check;
alter table public.control_center_settings add constraint control_center_settings_route_status_check
  check (route_status in ('READY','SETUP_REQUIRED','ERROR','OFF'));

alter table public.quotes
  add column if not exists delivery_distance_source text,
  add column if not exists delivery_distance_calculated_at timestamptz,
  add column if not exists delivery_origin text,
  add column if not exists delivery_destination_place_id text;
alter table public.quotes drop constraint if exists quotes_delivery_distance_source_check;
alter table public.quotes add constraint quotes_delivery_distance_source_check
  check (delivery_distance_source is null or delivery_distance_source in ('GOOGLE_ROUTES','MANUAL'));

alter table public.quote_items add column if not exists intake_source text;
alter table public.quote_items drop constraint if exists quote_items_intake_source_check;
alter table public.quote_items add constraint quote_items_intake_source_check
  check (intake_source is null or intake_source in ('AI_CONVERSATION'));

-- A staff save owns the delivery values whenever it changes them. This prevents
-- a later AI route calculation from overwriting Salvador's manual correction.
create or replace function public.update_quote_draft_atomic(
  p_quote_id uuid, p_quote jsonb, p_items jsonb
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_quote public.quotes%rowtype;
  v_address text;
  v_type text;
  v_miles numeric;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
  select * into v_quote from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if v_quote.status <> 'DRAFT' then raise exception 'Only a draft quote can be edited'; end if;
  v_address:=coalesce(p_quote->>'address','');
  v_type:=nullif(p_quote->>'delivery_type','');
  v_miles:=nullif(p_quote->>'delivery_miles','')::numeric;
  update public.quotes set
    description=coalesce(p_quote->>'description',''),address=v_address,delivery_type=v_type,delivery_miles=v_miles,
    delivery_fee_per_load=coalesce((p_quote->>'delivery_fee_per_load')::numeric,0),
    delivery_load_count=greatest(coalesce((p_quote->>'delivery_load_count')::integer,1),1),
    delivery_total=coalesce((p_quote->>'delivery_total')::numeric,0),materials_subtotal=coalesce((p_quote->>'materials_subtotal')::numeric,0),
    custom_work_subtotal=coalesce((p_quote->>'custom_work_subtotal')::numeric,0),tax_rate=coalesce((p_quote->>'tax_rate')::numeric,tax_rate),
    tax_applies_to_delivery=coalesce((p_quote->>'tax_applies_to_delivery')::boolean,tax_applies_to_delivery),
    custom_work_tax_rule=coalesce(nullif(p_quote->>'custom_work_tax_rule',''),custom_work_tax_rule),
    tax_amount=coalesce((p_quote->>'tax_amount')::numeric,0),grand_total=coalesce((p_quote->>'grand_total')::numeric,0),notes=nullif(p_quote->>'notes',''),
    delivery_distance_source=case
      when v_type is null then null
      when v_quote.delivery_distance_source='GOOGLE_ROUTES' and v_address=v_quote.address and v_type=v_quote.delivery_type and v_miles is not distinct from v_quote.delivery_miles then 'GOOGLE_ROUTES'
      else 'MANUAL' end,
    delivery_distance_calculated_at=case
      when v_quote.delivery_distance_source='GOOGLE_ROUTES' and v_address=v_quote.address and v_type=v_quote.delivery_type and v_miles is not distinct from v_quote.delivery_miles then v_quote.delivery_distance_calculated_at
      else null end,
    delivery_origin=case when v_quote.delivery_distance_source='GOOGLE_ROUTES' and v_address=v_quote.address and v_type=v_quote.delivery_type and v_miles is not distinct from v_quote.delivery_miles then v_quote.delivery_origin else null end,
    delivery_destination_place_id=case when v_quote.delivery_distance_source='GOOGLE_ROUTES' and v_address=v_quote.address and v_type=v_quote.delivery_type and v_miles is not distinct from v_quote.delivery_miles then v_quote.delivery_destination_place_id else null end
  where id=p_quote_id;
  delete from public.quote_items where quote_id=p_quote_id;
  insert into public.quote_items(quote_id,kind,material_id,description,loads,yards,is_full_load,rate_used,line_total,intake_source)
  select p_quote_id,item->>'kind',nullif(item->>'material_id','')::uuid,item->>'description',nullif(item->>'loads','')::integer,
    nullif(item->>'yards','')::numeric,coalesce((item->>'is_full_load')::boolean,false),coalesce((item->>'rate_used')::numeric,0),
    coalesce((item->>'line_total')::numeric,0),null
  from jsonb_array_elements(p_items) as elements(item);
end;
$$;

create or replace function public.apply_ai_material_to_quote(
  p_lead_id uuid,
  p_expected_revision bigint,
  p_material_id uuid,
  p_yards numeric
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lead public.leads%rowtype;
  v_quote public.quotes%rowtype;
  v_material public.materials%rowtype;
  v_full_loads integer;
  v_remainder numeric;
  v_materials numeric;
  v_loads integer;
  v_delivery numeric;
  v_taxable numeric;
  v_tax numeric;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found or v_lead.human_takeover or v_lead.conversation_revision <> p_expected_revision then
    return jsonb_build_object('status','SKIPPED_CONVERSATION_CHANGED');
  end if;
  if p_yards <= 0 or p_yards > 1000 then raise exception 'Invalid AI material quantity'; end if;
  select * into v_material from public.materials where id = p_material_id and is_active;
  if not found then return jsonb_build_object('status','SKIPPED_MATERIAL_UNAVAILABLE'); end if;
  select * into v_quote from public.quotes
  where lead_id = p_lead_id and status = 'DRAFT' order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('status','NO_DRAFT_QUOTE'); end if;
  if exists(select 1 from public.quote_items where quote_id = v_quote.id and intake_source is distinct from 'AI_CONVERSATION') then
    return jsonb_build_object('status','SKIPPED_MANUAL_ITEMS','quote_id',v_quote.id);
  end if;

  delete from public.quote_items where quote_id = v_quote.id and intake_source = 'AI_CONVERSATION';
  v_full_loads := floor(p_yards / v_material.full_load_yards);
  v_remainder := p_yards - v_full_loads * v_material.full_load_yards;
  if v_full_loads > 0 then
    insert into public.quote_items(quote_id,kind,material_id,description,loads,yards,is_full_load,rate_used,line_total,intake_source)
    values(v_quote.id,'MATERIAL',v_material.id,v_material.name,v_full_loads,v_full_loads*v_material.full_load_yards,true,v_material.full_load_price,v_full_loads*v_material.full_load_price,'AI_CONVERSATION');
  end if;
  if v_remainder > 0 then
    insert into public.quote_items(quote_id,kind,material_id,description,loads,yards,is_full_load,rate_used,line_total,intake_source)
    values(v_quote.id,'MATERIAL',v_material.id,v_material.name,null,v_remainder,false,v_material.price_per_yard,v_remainder*v_material.price_per_yard,'AI_CONVERSATION');
  end if;
  select coalesce(sum(line_total),0) into v_materials from public.quote_items where quote_id = v_quote.id and kind = 'MATERIAL';
  v_loads := greatest(ceil(p_yards / v_material.full_load_yards)::integer, 1);
  v_delivery := round(v_quote.delivery_fee_per_load * v_loads, 2);
  v_taxable := v_materials
    + case when v_quote.tax_applies_to_delivery then v_delivery else 0 end
    + case when v_quote.custom_work_tax_rule = 'TAXED' then v_quote.custom_work_subtotal else 0 end;
  v_tax := round(v_taxable * v_quote.tax_rate / 100, 2);
  update public.quotes set materials_subtotal=v_materials, delivery_load_count=v_loads,
    delivery_total=v_delivery, tax_amount=v_tax,
    grand_total=round(v_materials+custom_work_subtotal+v_delivery+v_tax,2), updated_at=now()
  where id=v_quote.id;
  return jsonb_build_object('status','APPLIED','quote_id',v_quote.id,'yards',p_yards,'delivery_loads',v_loads);
end;
$$;

create or replace function public.apply_ai_route_to_quote(
  p_lead_id uuid,
  p_expected_revision bigint,
  p_address text,
  p_origin text,
  p_distance_miles numeric,
  p_destination_place_id text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lead public.leads%rowtype;
  v_quote public.quotes%rowtype;
  v_settings public.app_settings%rowtype;
  v_type text;
  v_fee numeric;
  v_delivery numeric;
  v_taxable numeric;
  v_tax numeric;
begin
  select * into v_lead from public.leads where id=p_lead_id for update;
  if not found or v_lead.human_takeover or v_lead.conversation_revision <> p_expected_revision then
    return jsonb_build_object('status','SKIPPED_CONVERSATION_CHANGED');
  end if;
  if p_distance_miles < 0 or p_distance_miles > 1000 then raise exception 'Invalid route distance'; end if;
  select * into v_quote from public.quotes
  where lead_id=p_lead_id and status='DRAFT' order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('status','NO_DRAFT_QUOTE'); end if;
  if v_quote.delivery_distance_source = 'MANUAL'
     or (v_quote.delivery_distance_source is null and v_quote.delivery_type is not null)
     or (btrim(v_quote.address) <> '' and lower(btrim(v_quote.address)) <> lower(btrim(p_address)) and v_quote.delivery_distance_source is distinct from 'GOOGLE_ROUTES') then
    return jsonb_build_object('status','SKIPPED_MANUAL_DELIVERY','quote_id',v_quote.id);
  end if;
  select * into v_settings from public.app_settings order by id limit 1;
  if not found then return jsonb_build_object('status','SETTINGS_UNAVAILABLE'); end if;
  if p_distance_miles <= v_settings.delivery_tier_1_max_miles then v_type:='tier_1'; v_fee:=v_settings.delivery_tier_1_fee;
  elsif p_distance_miles <= v_settings.delivery_tier_2_max_miles then v_type:='tier_2'; v_fee:=v_settings.delivery_tier_2_fee;
  elsif p_distance_miles <= v_settings.delivery_tier_3_max_miles then v_type:='tier_3'; v_fee:=v_settings.delivery_tier_3_fee;
  else v_type:='over_10'; v_fee:=v_settings.delivery_overage_base_fee+(p_distance_miles-v_settings.delivery_tier_3_max_miles)*v_settings.delivery_overage_per_mile;
  end if;
  v_fee:=round(v_fee,2);
  v_delivery:=round(v_fee*greatest(v_quote.delivery_load_count,1),2);
  v_taxable:=v_quote.materials_subtotal
    + case when v_quote.tax_applies_to_delivery then v_delivery else 0 end
    + case when v_quote.custom_work_tax_rule='TAXED' then v_quote.custom_work_subtotal else 0 end;
  v_tax:=round(v_taxable*v_quote.tax_rate/100,2);
  update public.quotes set address=btrim(p_address),delivery_type=v_type,delivery_miles=round(p_distance_miles,1),
    delivery_fee_per_load=v_fee,delivery_total=v_delivery,tax_amount=v_tax,
    grand_total=round(materials_subtotal+custom_work_subtotal+v_delivery+v_tax,2),
    delivery_distance_source='GOOGLE_ROUTES',delivery_distance_calculated_at=now(),
    delivery_origin=btrim(p_origin),delivery_destination_place_id=p_destination_place_id,updated_at=now()
  where id=v_quote.id;
  return jsonb_build_object('status','APPLIED','quote_id',v_quote.id,'delivery_type',v_type,'fee_per_load',v_fee);
end;
$$;

revoke all on function public.apply_ai_material_to_quote(uuid,bigint,uuid,numeric) from public, anon, authenticated;
grant execute on function public.apply_ai_material_to_quote(uuid,bigint,uuid,numeric) to service_role;
revoke all on function public.apply_ai_route_to_quote(uuid,bigint,text,text,numeric,text) from public, anon, authenticated;
grant execute on function public.apply_ai_route_to_quote(uuid,bigint,text,text,numeric,text) to service_role;
revoke all on function public.update_quote_draft_atomic(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.update_quote_draft_atomic(uuid,jsonb,jsonb) to authenticated;

commit;
