-- Current tax policy and historically safe material deletion.
-- Tax rates use percentage points throughout the application: 8.25 means 8.25%.
-- This migration changes current settings only. It never rewrites stored business records.

begin;

do $$
begin
  if to_regclass('public.app_settings') is null
    or to_regclass('public.materials') is null
    or to_regclass('public.ticket_items') is null
    or to_regclass('public.quote_items') is null then
    raise exception 'Ticket material polish requires app_settings, materials, ticket_items, and quote_items';
  end if;
end
$$;

-- Monkey Trucking is not currently charging tax. Existing Ticket, Quote, and
-- Invoice snapshots remain exactly as recorded.
update public.app_settings
set tax_rate = 0,
    updated_at = now();

create or replace function public.delete_material_if_unused(p_material_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket_references bigint := 0;
  v_quote_references bigint := 0;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  -- Lock the master row while references are checked so a new line cannot race
  -- a safe deletion. Historical line snapshots are never changed or detached.
  perform 1 from public.materials where id = p_material_id for update;
  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  select count(*) into v_ticket_references
  from public.ticket_items
  where material_id = p_material_id;

  select count(*) into v_quote_references
  from public.quote_items
  where material_id = p_material_id;

  if v_ticket_references > 0 or v_quote_references > 0 then
    return jsonb_build_object(
      'status', 'PROTECTED',
      'ticket_references', v_ticket_references,
      'quote_references', v_quote_references
    );
  end if;

  delete from public.materials where id = p_material_id;
  return jsonb_build_object('status', 'DELETED');
end;
$$;

revoke all on function public.delete_material_if_unused(uuid) from public, anon;
grant execute on function public.delete_material_if_unused(uuid) to authenticated;

commit;