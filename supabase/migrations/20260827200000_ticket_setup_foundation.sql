-- Monkey Trucking Ticket setup foundation.
-- Forward-only master-data reconciliation. This migration deliberately does not
-- update tickets, ticket_items, ticket_history, or app_settings.next_ticket_number.

begin;

do $$
declare
  v_material record;
  v_existing_id uuid;
begin
  if to_regclass('public.materials') is null
    or to_regclass('public.app_settings') is null then
    raise exception 'Ticket setup requires the existing materials and app_settings tables';
  end if;

  for v_material in
    select * from (values
      (1,  'Commercial Crushed Concrete Clean', 20::numeric,  350::numeric),
      (2,  'Select Fill and Cushion Sand',      20::numeric,  350::numeric),
      (3,  '3x4 Crushed Concrete',              35::numeric,  700::numeric),
      (4,  'Flexbase First Class 1" or 3"',     38::numeric,  720::numeric),
      (5,  'Mason Sand',                        45::numeric,  820::numeric),
      (6,  'Millings Asphalt 1/2" Minus',       45::numeric,  840::numeric),
      (7,  'Native Gravel 3/8"-1"',             53::numeric,  980::numeric),
      (8,  'Concrete Sand Mix Native Gravel',   55::numeric, 1040::numeric),
      (9,  'Decomposed Granite',                65::numeric, 1200::numeric),
      (10, 'Limestone 1"-1 1/2"',               95::numeric, 1700::numeric)
    ) as approved(sort_order, name, price_per_yard, full_load_price)
  loop
    select id into v_existing_id
    from public.materials
    where lower(btrim(name)) = lower(btrim(v_material.name))
    order by is_active desc, created_at, id
    limit 1;

    if v_existing_id is null then
      insert into public.materials (
        name, price_per_yard, full_load_price, full_load_yards, is_active, sort_order
      ) values (
        v_material.name, v_material.price_per_yard, v_material.full_load_price, 20, true, v_material.sort_order
      );
    else
      -- This updates only the current catalog row. Finalized ticket item
      -- snapshots retain their original names and rates.
      update public.materials
      set name = v_material.name,
          price_per_yard = v_material.price_per_yard,
          full_load_price = v_material.full_load_price,
          full_load_yards = 20,
          is_active = true,
          sort_order = v_material.sort_order,
          updated_at = now()
      where id = v_existing_id;

      -- Exact-name duplicates are retained for history but removed from new
      -- pickers. Nothing is deleted and no ticket reference is changed.
      update public.materials
      set is_active = false,
          updated_at = now()
      where id <> v_existing_id
        and lower(btrim(name)) = lower(btrim(v_material.name));
    end if;

    v_existing_id := null;
  end loop;
end
$$;

-- Approved current pricing defaults. The MT counter and all historical ticket
-- snapshots are intentionally absent from this update.
update public.app_settings
set tax_rate = 0.0825,
    tax_applies_to_delivery = true,
    delivery_tier_1_max_miles = 2,
    delivery_tier_1_fee = 0,
    delivery_tier_2_max_miles = 5,
    delivery_tier_2_fee = 60,
    delivery_tier_3_max_miles = 10,
    delivery_tier_3_fee = 100,
    delivery_overage_base_fee = 100,
    delivery_overage_per_mile = 10,
    updated_at = now();

commit;
