begin;

-- Fail closed when the Lovable-managed project does not match the repository
-- baseline. Nothing in this migration guesses or repairs missing production
-- objects.
do $$
begin
  if to_regclass('public.app_settings') is null
    or to_regclass('public.drivers') is null
    or to_regclass('public.materials') is null
    or to_regclass('public.ticket_items') is null
    or to_regclass('public.tickets') is null
    or to_regclass('public.user_roles') is null then
    raise exception 'Phase 05 Ticket safety requires the existing Ticket tables and user_roles table';
  end if;

  if to_regprocedure('public.next_ticket_number()') is null then
    raise exception 'Phase 05 Ticket safety requires the existing public.next_ticket_number() function';
  end if;

  if not exists (select 1 from public.app_settings) then
    raise exception 'Phase 05 Ticket safety requires the existing app_settings row and MT counter';
  end if;

  if exists (
    select 1 from public.tickets group by ticket_number having count(*) > 1
  ) then
    raise exception 'Duplicate legacy ticket numbers must be reviewed before Phase 05 Ticket safety';
  end if;

  if not exists (
    select 1
    from public.user_roles
    where role in ('admin'::public.app_role, 'staff'::public.app_role)
  ) then
    raise exception 'Assign at least one existing user an admin or staff role before applying Phase 05 Ticket safety';
  end if;
end
$$;

-- Historical rows remain null. These columns intentionally have no defaults.
alter table public.ticket_items add column if not exists loads integer;
alter table public.ticket_items alter column loads drop default;
alter table public.ticket_items add column if not exists superseded_at timestamptz;
alter table public.ticket_items alter column superseded_at drop default;

alter table public.tickets add column if not exists client_request_id uuid;
alter table public.tickets alter column client_request_id drop default;
alter table public.tickets add column if not exists tax_applies_to_delivery boolean;
alter table public.tickets alter column tax_applies_to_delivery drop default;
alter table public.tickets add column if not exists status text;
alter table public.tickets alter column status drop default;
alter table public.tickets add column if not exists voided_at timestamptz;
alter table public.tickets add column if not exists void_reason text;
alter table public.tickets add column if not exists voided_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ticket_items_loads_positive'
      and conrelid = 'public.ticket_items'::regclass
  ) then
    alter table public.ticket_items
      add constraint ticket_items_loads_positive
      check (loads is null or loads >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tickets_status_allowed'
      and conrelid = 'public.tickets'::regclass
  ) then
    alter table public.tickets
      add constraint tickets_status_allowed
      check (status is null or status in ('saved', 'void'));
  end if;
end
$$;

create unique index if not exists tickets_client_request_id_unique
  on public.tickets (client_request_id)
  where client_request_id is not null;

create unique index if not exists tickets_ticket_number_unique
  on public.tickets (ticket_number);

create index if not exists ticket_items_current_by_ticket
  on public.ticket_items (ticket_id, created_at)
  where superseded_at is null;

create table if not exists public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete restrict,
  event_type text not null check (event_type in ('created', 'corrected', 'voided')),
  reason text,
  actor_id uuid,
  actor_label text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint ticket_history_reason_required check (
    event_type = 'created' or nullif(btrim(reason), '') is not null
  )
);

alter table public.ticket_history add column if not exists actor_label text;

create index if not exists ticket_history_ticket_created
  on public.ticket_history (ticket_id, created_at desc);

create or replace function public.is_admin_or_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'staff'::public.app_role)
  );
$$;

revoke all on function public.is_admin_or_staff() from public;
revoke all on function public.is_admin_or_staff() from anon;
grant execute on function public.is_admin_or_staff() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- MT numbers may only be consumed by the atomic creation function after this
-- migration. The function body and counter semantics are otherwise untouched.
revoke execute on function public.next_ticket_number() from public;
revoke execute on function public.next_ticket_number() from anon;
revoke execute on function public.next_ticket_number() from authenticated;

create or replace function public.validate_ticket_payload(
  p_ticket jsonb,
  p_items jsonb,
  p_preserve_legacy_unknowns boolean default false
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_item_loads integer;
  v_item_yards numeric;
  v_item_rate numeric;
  v_item_total numeric;
  v_materials_subtotal numeric := 0;
  v_delivery_total numeric;
  v_tax_amount numeric;
  v_grand_total numeric;
  v_tax_on_delivery boolean;
  v_expected numeric;
begin
  if coalesce(jsonb_typeof(p_ticket), '') <> 'object' then
    raise exception 'Ticket payload must be an object';
  end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' then
    raise exception 'Material items must be an array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'At least one material item is required';
  end if;
  if coalesce(p_ticket->>'delivery_type', '') not in (
    'tier_1', 'tier_2', 'tier_3', 'over_10', 'custom', 'pickup'
  ) then
    raise exception 'An explicit delivery selection is required';
  end if;
  if coalesce((p_ticket->>'load_count')::integer, 0) < 1 then
    raise exception 'Delivery load count must be at least one';
  end if;
  if not p_preserve_legacy_unknowns
    and jsonb_typeof(p_ticket->'tax_applies_to_delivery') <> 'boolean' then
    raise exception 'New tickets require a tax-on-delivery snapshot';
  end if;

  if coalesce((p_ticket->>'delivery_fee_per_load')::numeric, 0) < 0
    or coalesce((p_ticket->>'delivery_total')::numeric, 0) < 0
    or coalesce((p_ticket->>'materials_subtotal')::numeric, 0) < 0
    or coalesce((p_ticket->>'tax_rate')::numeric, 0) < 0
    or coalesce((p_ticket->>'tax_rate')::numeric, 0) > 100
    or coalesce((p_ticket->>'tax_amount')::numeric, 0) < 0
    or coalesce((p_ticket->>'grand_total')::numeric, 0) < 0 then
    raise exception 'Ticket amounts cannot be negative and tax rate must be between zero and 100';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_loads := case
      when v_item->'loads' is null or jsonb_typeof(v_item->'loads') = 'null' then null
      else (v_item->>'loads')::integer
    end;
    v_item_yards := coalesce((v_item->>'yards')::numeric, 0);
    v_item_rate := coalesce((v_item->>'rate_used')::numeric, 0);
    v_item_total := coalesce((v_item->>'line_total')::numeric, 0);

    if v_item_loads is null and not p_preserve_legacy_unknowns then
      raise exception 'New material items require a load count';
    end if;
    if v_item_loads is not null and v_item_loads < 1 then
      raise exception 'Material load count must be at least one';
    end if;
    if nullif(btrim(v_item->>'material_name'), '') is null then
      raise exception 'Material snapshot name is required';
    end if;
    if v_item_yards < 0 or v_item_rate < 0 or v_item_total < 0 then
      raise exception 'Material snapshot values cannot be negative';
    end if;

    if coalesce((v_item->>'is_full_load')::boolean, false) and v_item_loads is not null then
      v_expected := round(v_item_rate * v_item_loads, 2);
    elsif not coalesce((v_item->>'is_full_load')::boolean, false) then
      v_expected := round(v_item_rate * v_item_yards, 2);
    else
      v_expected := v_item_total;
    end if;
    if round(v_item_total, 2) <> v_expected then
      raise exception 'Material line total does not match its pricing snapshot';
    end if;

    v_materials_subtotal := v_materials_subtotal + round(v_item_total, 2);
  end loop;

  if round(v_materials_subtotal, 2)
    <> round(coalesce((p_ticket->>'materials_subtotal')::numeric, 0), 2) then
    raise exception 'Materials subtotal does not match item snapshots';
  end if;

  v_delivery_total := round(
    coalesce((p_ticket->>'delivery_fee_per_load')::numeric, 0)
      * (p_ticket->>'load_count')::integer,
    2
  );
  if v_delivery_total <> round(coalesce((p_ticket->>'delivery_total')::numeric, 0), 2) then
    raise exception 'Delivery total does not match the delivery load snapshot';
  end if;

  v_tax_amount := round(coalesce((p_ticket->>'tax_amount')::numeric, 0), 2);
  if jsonb_typeof(p_ticket->'tax_applies_to_delivery') = 'boolean' then
    v_tax_on_delivery := (p_ticket->>'tax_applies_to_delivery')::boolean;
    v_expected := round(
      (v_materials_subtotal + case when v_tax_on_delivery then v_delivery_total else 0 end)
        * coalesce((p_ticket->>'tax_rate')::numeric, 0) / 100,
      2
    );
    if v_tax_amount <> v_expected then
      raise exception 'Tax amount does not match the tax snapshot';
    end if;
  end if;

  v_grand_total := round(v_materials_subtotal + v_delivery_total + v_tax_amount, 2);
  if v_grand_total <> round(coalesce((p_ticket->>'grand_total')::numeric, 0), 2) then
    raise exception 'Grand total does not match the Ticket snapshots';
  end if;
end;
$$;

revoke all on function public.validate_ticket_payload(jsonb, jsonb, boolean) from public;
revoke all on function public.validate_ticket_payload(jsonb, jsonb, boolean) from anon;
revoke all on function public.validate_ticket_payload(jsonb, jsonb, boolean) from authenticated;

create or replace function public.enforce_ticket_safe_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_setting('app.ticket_safe_write', true) = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'tickets' and tg_op = 'UPDATE'
    and (to_jsonb(new) - 'printed_at' - 'payment_status' - 'updated_at')
      = (to_jsonb(old) - 'printed_at' - 'payment_status' - 'updated_at') then
    return new;
  end if;

  raise exception 'Ticket records must be created or corrected through the approved Ticket safety functions'
    using errcode = '42501';
end;
$$;

revoke all on function public.enforce_ticket_safe_write() from public;
revoke all on function public.enforce_ticket_safe_write() from anon;
revoke all on function public.enforce_ticket_safe_write() from authenticated;

drop trigger if exists phase05_ticket_safe_write on public.tickets;
create trigger phase05_ticket_safe_write
before insert or update or delete on public.tickets
for each row execute function public.enforce_ticket_safe_write();

drop trigger if exists phase05_ticket_item_safe_write on public.ticket_items;
create trigger phase05_ticket_item_safe_write
before insert or update or delete on public.ticket_items
for each row execute function public.enforce_ticket_safe_write();

create or replace function public.create_ticket_atomic(
  p_ticket jsonb,
  p_items jsonb,
  p_client_request_id uuid,
  p_preserve_legacy_unknowns boolean default false
)
returns table (id uuid, ticket_number text, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_id uuid;
  v_existing_number text;
  v_ticket_id uuid;
  v_ticket_number text;
  v_ticket_row public.tickets%rowtype;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  if p_client_request_id is null then
    raise exception 'A client request id is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));

  select t.id, t.ticket_number
    into v_existing_id, v_existing_number
  from public.tickets t
  where t.client_request_id = p_client_request_id;

  if found then
    return query select v_existing_id, v_existing_number, false;
    return;
  end if;

  perform public.validate_ticket_payload(p_ticket, p_items, p_preserve_legacy_unknowns);

  perform set_config('app.ticket_safe_write', 'true', true);

  -- The existing function remains the only MT counter source. It is called
  -- inside this transaction after validation and only for a new request id.
  v_ticket_number := public.next_ticket_number();

  insert into public.tickets (
    ticket_number,
    customer_name,
    customer_phone,
    job_site_address,
    driver_id,
    delivery_type,
    delivery_miles,
    delivery_fee_per_load,
    load_count,
    delivery_total,
    materials_subtotal,
    tax_rate,
    tax_applies_to_delivery,
    tax_amount,
    grand_total,
    notes,
    payment_status,
    created_by,
    client_request_id,
    status
  ) values (
    v_ticket_number,
    coalesce(p_ticket->>'customer_name', ''),
    coalesce(p_ticket->>'customer_phone', ''),
    coalesce(p_ticket->>'job_site_address', ''),
    nullif(p_ticket->>'driver_id', '')::uuid,
    p_ticket->>'delivery_type',
    nullif(p_ticket->>'delivery_miles', '')::numeric,
    coalesce((p_ticket->>'delivery_fee_per_load')::numeric, 0),
    (p_ticket->>'load_count')::integer,
    coalesce((p_ticket->>'delivery_total')::numeric, 0),
    coalesce((p_ticket->>'materials_subtotal')::numeric, 0),
    coalesce((p_ticket->>'tax_rate')::numeric, 0),
    case
      when jsonb_typeof(p_ticket->'tax_applies_to_delivery') = 'boolean'
        then (p_ticket->>'tax_applies_to_delivery')::boolean
      else null
    end,
    coalesce((p_ticket->>'tax_amount')::numeric, 0),
    coalesce((p_ticket->>'grand_total')::numeric, 0),
    nullif(p_ticket->>'notes', ''),
    coalesce(nullif(p_ticket->>'payment_status', ''), 'unpaid'),
    auth.uid(),
    p_client_request_id,
    'saved'
  )
  returning public.tickets.id into v_ticket_id;

  insert into public.ticket_items (
    ticket_id,
    material_id,
    material_name,
    yards,
    is_full_load,
    rate_used,
    line_total,
    loads
  )
  select
    v_ticket_id,
    nullif(item->>'material_id', '')::uuid,
    item->>'material_name',
    coalesce((item->>'yards')::numeric, 0),
    coalesce((item->>'is_full_load')::boolean, false),
    coalesce((item->>'rate_used')::numeric, 0),
    coalesce((item->>'line_total')::numeric, 0),
    case
      when item->'loads' is null or jsonb_typeof(item->'loads') = 'null' then null
      else (item->>'loads')::integer
    end
  from jsonb_array_elements(p_items) as elements(item);

  select * into v_ticket_row from public.tickets where public.tickets.id = v_ticket_id;

  insert into public.ticket_history (
    ticket_id,
    event_type,
    actor_id,
    actor_label,
    after_snapshot
  ) values (
    v_ticket_id,
    'created',
    auth.uid(),
    coalesce(auth.jwt()->>'email', auth.uid()::text),
    jsonb_build_object(
      'ticket', to_jsonb(v_ticket_row),
      'items', (
        select coalesce(jsonb_agg(to_jsonb(ti) order by ti.created_at, ti.id), '[]'::jsonb)
        from public.ticket_items ti
        where ti.ticket_id = v_ticket_id and ti.superseded_at is null
      )
    )
  );

  return query select v_ticket_id, v_ticket_number, true;
end;
$$;

create or replace function public.correct_ticket_atomic(
  p_ticket_id uuid,
  p_reason text,
  p_ticket jsonb,
  p_items jsonb
)
returns table (id uuid, ticket_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_item jsonb;
  v_old_item public.ticket_items%rowtype;
  v_source_id uuid;
  v_source_ids uuid[] := array[]::uuid[];
  v_item_loads integer;
  v_same boolean;
  v_legacy_pricing_locked boolean;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A correction reason is required';
  end if;

  select * into v_ticket
  from public.tickets
  where public.tickets.id = p_ticket_id
  for update;

  if not found then raise exception 'Ticket not found'; end if;
  if v_ticket.status = 'void' then raise exception 'A voided ticket cannot be corrected'; end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' then
    raise exception 'Material items must be an array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'At least one material item is required';
  end if;
  if coalesce(p_ticket->>'delivery_type', '') not in (
    'tier_1', 'tier_2', 'tier_3', 'over_10', 'custom', 'pickup'
  ) then
    raise exception 'An explicit delivery selection is required';
  end if;
  if coalesce((p_ticket->>'load_count')::integer, 0) < 1 then
    raise exception 'Delivery load count must be at least one';
  end if;

  v_legacy_pricing_locked := v_ticket.tax_applies_to_delivery is null;
  if not v_legacy_pricing_locked then
    perform public.validate_ticket_payload(p_ticket, p_items, false);
  end if;

  v_before := jsonb_build_object(
    'ticket', to_jsonb(v_ticket),
    'items', (
      select coalesce(jsonb_agg(to_jsonb(ti) order by ti.created_at, ti.id), '[]'::jsonb)
      from public.ticket_items ti
      where ti.ticket_id = p_ticket_id and ti.superseded_at is null
    )
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if nullif(v_item->>'source_item_id', '') is not null then
      v_source_ids := array_append(v_source_ids, (v_item->>'source_item_id')::uuid);
    end if;
  end loop;

  if v_legacy_pricing_locked then
    if coalesce(jsonb_typeof(p_ticket->'tax_applies_to_delivery'), 'null') <> 'null'
      or p_ticket->>'delivery_type' is distinct from v_ticket.delivery_type
      or nullif(p_ticket->>'delivery_miles', '')::numeric is distinct from v_ticket.delivery_miles
      or coalesce((p_ticket->>'delivery_fee_per_load')::numeric, 0) <> v_ticket.delivery_fee_per_load
      or (p_ticket->>'load_count')::integer <> v_ticket.load_count
      or coalesce((p_ticket->>'delivery_total')::numeric, 0) <> v_ticket.delivery_total
      or coalesce((p_ticket->>'materials_subtotal')::numeric, 0) <> v_ticket.materials_subtotal
      or coalesce((p_ticket->>'tax_rate')::numeric, 0) <> v_ticket.tax_rate
      or coalesce((p_ticket->>'tax_amount')::numeric, 0) <> v_ticket.tax_amount
      or coalesce((p_ticket->>'grand_total')::numeric, 0) <> v_ticket.grand_total then
      raise exception 'Legacy Ticket pricing snapshots cannot be changed or reinterpreted';
    end if;

    if (
      select count(distinct source_id)
      from unnest(v_source_ids) as source_rows(source_id)
    ) <> (
      select count(*)
      from public.ticket_items ti
      where ti.ticket_id = p_ticket_id and ti.superseded_at is null
    ) then
      raise exception 'Legacy Ticket material snapshots cannot be added, removed or reinterpreted';
    end if;
  end if;

  perform set_config('app.ticket_safe_write', 'true', true);

  -- Removed lines are preserved as superseded snapshots instead of deleted.
  update public.ticket_items
  set superseded_at = now()
  where ticket_id = p_ticket_id
    and superseded_at is null
    and not (id = any(v_source_ids));

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_source_id := nullif(v_item->>'source_item_id', '')::uuid;
    v_item_loads := case
      when v_item->'loads' is null or jsonb_typeof(v_item->'loads') = 'null' then null
      else (v_item->>'loads')::integer
    end;

    if v_item_loads is not null and v_item_loads < 1 then
      raise exception 'Material load count must be at least one';
    end if;

    if v_source_id is not null then
      select * into v_old_item
      from public.ticket_items ti
      where ti.id = v_source_id
        and ti.ticket_id = p_ticket_id
        and ti.superseded_at is null
      for update;

      if not found then raise exception 'Ticket item is missing or already superseded'; end if;

      v_same :=
        nullif(v_item->>'material_id', '')::uuid is not distinct from v_old_item.material_id
        and v_item->>'material_name' is not distinct from v_old_item.material_name
        and coalesce((v_item->>'yards')::numeric, 0) = v_old_item.yards
        and coalesce((v_item->>'is_full_load')::boolean, false) = v_old_item.is_full_load
        and coalesce((v_item->>'rate_used')::numeric, 0) = v_old_item.rate_used
        and coalesce((v_item->>'line_total')::numeric, 0) = v_old_item.line_total
        and v_item_loads is not distinct from v_old_item.loads;

      if v_same then continue; end if;

      if v_legacy_pricing_locked then
        raise exception 'Legacy Ticket material snapshots cannot be changed or reinterpreted';
      end if;

      if v_item_loads is null then
        raise exception 'Set an explicit material load count before correcting a legacy item';
      end if;

      update public.ticket_items set superseded_at = now() where id = v_source_id;
    elsif v_legacy_pricing_locked then
      raise exception 'Legacy Ticket material snapshots cannot be added, removed or reinterpreted';
    elsif v_item_loads is null then
      raise exception 'New correction items require a material load count';
    end if;

    insert into public.ticket_items (
      ticket_id,
      material_id,
      material_name,
      yards,
      is_full_load,
      rate_used,
      line_total,
      loads
    ) values (
      p_ticket_id,
      nullif(v_item->>'material_id', '')::uuid,
      v_item->>'material_name',
      coalesce((v_item->>'yards')::numeric, 0),
      coalesce((v_item->>'is_full_load')::boolean, false),
      coalesce((v_item->>'rate_used')::numeric, 0),
      coalesce((v_item->>'line_total')::numeric, 0),
      v_item_loads
    );
  end loop;

  update public.tickets
  set
    customer_name = coalesce(p_ticket->>'customer_name', ''),
    customer_phone = coalesce(p_ticket->>'customer_phone', ''),
    job_site_address = coalesce(p_ticket->>'job_site_address', ''),
    driver_id = nullif(p_ticket->>'driver_id', '')::uuid,
    delivery_type = p_ticket->>'delivery_type',
    delivery_miles = nullif(p_ticket->>'delivery_miles', '')::numeric,
    delivery_fee_per_load = coalesce((p_ticket->>'delivery_fee_per_load')::numeric, 0),
    load_count = (p_ticket->>'load_count')::integer,
    delivery_total = coalesce((p_ticket->>'delivery_total')::numeric, 0),
    materials_subtotal = coalesce((p_ticket->>'materials_subtotal')::numeric, 0),
    tax_rate = coalesce((p_ticket->>'tax_rate')::numeric, 0),
    tax_applies_to_delivery = case
      when jsonb_typeof(p_ticket->'tax_applies_to_delivery') = 'boolean'
        then (p_ticket->>'tax_applies_to_delivery')::boolean
      else null
    end,
    tax_amount = coalesce((p_ticket->>'tax_amount')::numeric, 0),
    grand_total = coalesce((p_ticket->>'grand_total')::numeric, 0),
    notes = nullif(p_ticket->>'notes', ''),
    updated_at = now()
  where public.tickets.id = p_ticket_id
  returning * into v_ticket;

  v_after := jsonb_build_object(
    'ticket', to_jsonb(v_ticket),
    'items', (
      select coalesce(jsonb_agg(to_jsonb(ti) order by ti.created_at, ti.id), '[]'::jsonb)
      from public.ticket_items ti
      where ti.ticket_id = p_ticket_id and ti.superseded_at is null
    )
  );

  insert into public.ticket_history (
    ticket_id,
    event_type,
    reason,
    actor_id,
    actor_label,
    before_snapshot,
    after_snapshot
  ) values (
    p_ticket_id,
    'corrected',
    btrim(p_reason),
    auth.uid(),
    coalesce(auth.jwt()->>'email', auth.uid()::text),
    v_before,
    v_after
  );

  return query select v_ticket.id, v_ticket.ticket_number;
end;
$$;

create or replace function public.void_ticket(
  p_ticket_id uuid,
  p_reason text
)
returns table (id uuid, ticket_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A void reason is required';
  end if;

  select * into v_ticket
  from public.tickets
  where public.tickets.id = p_ticket_id
  for update;

  if not found then raise exception 'Ticket not found'; end if;
  if v_ticket.status = 'void' then
    return query select v_ticket.id, v_ticket.ticket_number;
    return;
  end if;

  v_before := jsonb_build_object(
    'ticket', to_jsonb(v_ticket),
    'items', (
      select coalesce(jsonb_agg(to_jsonb(ti) order by ti.created_at, ti.id), '[]'::jsonb)
      from public.ticket_items ti
      where ti.ticket_id = p_ticket_id and ti.superseded_at is null
    )
  );

  perform set_config('app.ticket_safe_write', 'true', true);

  update public.tickets
  set
    status = 'void',
    voided_at = now(),
    void_reason = btrim(p_reason),
    voided_by = auth.uid(),
    updated_at = now()
  where public.tickets.id = p_ticket_id
  returning * into v_ticket;

  v_after := jsonb_build_object(
    'ticket', to_jsonb(v_ticket),
    'items', v_before->'items'
  );

  insert into public.ticket_history (
    ticket_id,
    event_type,
    reason,
    actor_id,
    actor_label,
    before_snapshot,
    after_snapshot
  ) values (
    p_ticket_id,
    'voided',
    btrim(p_reason),
    auth.uid(),
    coalesce(auth.jwt()->>'email', auth.uid()::text),
    v_before,
    v_after
  );

  return query select v_ticket.id, v_ticket.ticket_number;
end;
$$;

revoke all on function public.create_ticket_atomic(jsonb, jsonb, uuid, boolean) from public;
revoke all on function public.create_ticket_atomic(jsonb, jsonb, uuid, boolean) from anon;
grant execute on function public.create_ticket_atomic(jsonb, jsonb, uuid, boolean) to authenticated;

revoke all on function public.correct_ticket_atomic(uuid, text, jsonb, jsonb) from public;
revoke all on function public.correct_ticket_atomic(uuid, text, jsonb, jsonb) from anon;
grant execute on function public.correct_ticket_atomic(uuid, text, jsonb, jsonb) to authenticated;

revoke all on function public.void_ticket(uuid, text) from public;
revoke all on function public.void_ticket(uuid, text) from anon;
grant execute on function public.void_ticket(uuid, text) to authenticated;

revoke all on public.ticket_history from anon;
revoke all on public.ticket_history from authenticated;
grant select on public.ticket_history to authenticated;

-- Existing permissive policies are left in place because their names are not
-- available in the repository. Restrictive policies make role membership a
-- required condition even if an older authenticated policy remains.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'app_settings',
    'drivers',
    'materials',
    'ticket_items',
    'tickets',
    'user_roles',
    'ticket_history'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists phase05_role_access on public.%I', v_table);
    execute format('drop policy if exists phase05_role_guard on public.%I', v_table);
    execute format('drop policy if exists phase05_anon_guard on public.%I', v_table);
    execute format(
      'create policy phase05_role_access on public.%I as permissive for all to authenticated using (public.is_admin_or_staff()) with check (public.is_admin_or_staff())',
      v_table
    );
    execute format(
      'create policy phase05_role_guard on public.%I as restrictive for all to authenticated using (public.is_admin_or_staff()) with check (public.is_admin_or_staff())',
      v_table
    );
    execute format(
      'create policy phase05_anon_guard on public.%I as restrictive for all to anon using (false) with check (false)',
      v_table
    );
  end loop;

  foreach v_table in array array['drivers', 'materials', 'ticket_items', 'tickets', 'ticket_history']
  loop
    execute format('drop policy if exists phase05_no_hard_delete on public.%I', v_table);
    execute format(
      'create policy phase05_no_hard_delete on public.%I as restrictive for delete to authenticated using (false)',
      v_table
    );
  end loop;

  drop policy if exists phase05_user_roles_read_guard on public.user_roles;
  create policy phase05_user_roles_read_guard
    on public.user_roles as restrictive for select to authenticated
    using (public.is_admin() or user_id = auth.uid());

  drop policy if exists phase05_user_roles_insert_guard on public.user_roles;
  create policy phase05_user_roles_insert_guard
    on public.user_roles as restrictive for insert to authenticated
    with check (public.is_admin());

  drop policy if exists phase05_user_roles_update_guard on public.user_roles;
  create policy phase05_user_roles_update_guard
    on public.user_roles as restrictive for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

  drop policy if exists phase05_user_roles_delete_guard on public.user_roles;
  create policy phase05_user_roles_delete_guard
    on public.user_roles as restrictive for delete to authenticated
    using (public.is_admin());
end
$$;

commit;
