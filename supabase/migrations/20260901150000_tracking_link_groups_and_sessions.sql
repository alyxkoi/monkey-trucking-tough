-- Add durable organization and privacy-conscious unique-session counting to
-- Tracking Links. Existing links remain ungrouped and existing visit history is
-- preserved exactly; session deduplication applies only to new redirect rows.

begin;

do $$
begin
  if to_regclass('public.tracking_links') is null
    or to_regclass('public.tracking_link_visits') is null then
    raise exception 'Tracking link groups require the existing Tracking Links schema';
  end if;
end
$$;

create table if not exists public.tracking_link_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0 check (position >= 0),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracking_link_groups_name_check check (
    name = trim(name) and char_length(name) between 1 and 80
  )
);

create unique index if not exists tracking_link_groups_name_unique
  on public.tracking_link_groups (lower(name));
create index if not exists tracking_link_groups_position_idx
  on public.tracking_link_groups (position, created_at, id);

alter table public.tracking_link_groups enable row level security;
drop policy if exists tracking_link_groups_admin_staff_read on public.tracking_link_groups;
create policy tracking_link_groups_admin_staff_read on public.tracking_link_groups
  for select to authenticated using (public.is_admin_or_staff());
revoke all on public.tracking_link_groups from anon;
revoke insert, update, delete on public.tracking_link_groups from authenticated;
grant select on public.tracking_link_groups to authenticated;
grant all on public.tracking_link_groups to service_role;

alter table public.tracking_links
  add column if not exists group_id uuid references public.tracking_link_groups(id) on delete set null,
  add column if not exists position integer not null default 0;

alter table public.tracking_links drop constraint if exists tracking_links_position_check;
alter table public.tracking_links add constraint tracking_links_position_check check (position >= 0);

with ranked as (
  select id, row_number() over (order by created_at desc, id)::integer * 1000 as next_position
  from public.tracking_links
)
update public.tracking_links tl
set position = ranked.next_position
from ranked
where tl.id = ranked.id and tl.position = 0;

create index if not exists tracking_links_group_position_idx
  on public.tracking_links (group_id, position, created_at, id);

alter table public.tracking_link_visits
  add column if not exists session_id uuid;

-- PostgreSQL unique indexes still allow multiple NULL values, which keeps all
-- legacy visit rows valid while giving PostgREST a conflict target for new rows.
create unique index if not exists tracking_link_visits_link_session_unique
  on public.tracking_link_visits (tracking_link_id, session_id);

comment on column public.tracking_link_visits.session_id is
  'Random signed-cookie session ID. No IP, user-agent, or fingerprint is stored.';

-- Keep the original view column order and append organization fields so this is
-- a deployment-safe CREATE OR REPLACE for existing API clients.
create or replace view public.tracking_link_metrics
with (security_invoker = true) as
select
  tl.id,
  tl.source,
  tl.campaign,
  tl.destination,
  tl.slug,
  tl.is_active,
  tl.archived_at,
  tl.archived_by,
  tl.created_by,
  tl.created_at,
  coalesce(tl.visits, 0) + (select count(*) from public.tracking_link_visits v where v.tracking_link_id = tl.id)::integer as visits,
  coalesce(tl.leads, 0) + (select count(*) from public.leads l where l.tracking_link_id = tl.id)::integer as leads,
  coalesce(tl.customers, 0) + (select count(distinct l.customer_id) from public.leads l where l.tracking_link_id = tl.id)::integer as customers,
  tl.group_id,
  tl.position
from public.tracking_links tl;

grant select on public.tracking_link_metrics to authenticated;

create or replace function public.create_tracking_link_group(p_name text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
  v_position integer;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Group name must be between 1 and 80 characters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tracking-link-groups', 0));
  select coalesce(max(position), 0) + 1000 into v_position
  from public.tracking_link_groups;

  insert into public.tracking_link_groups (name, position)
  values (v_name, v_position)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'A group with this name already exists' using errcode = '23505';
end;
$$;

create or replace function public.rename_tracking_link_group(p_group_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Group name must be between 1 and 80 characters';
  end if;

  update public.tracking_link_groups
  set name = v_name, updated_at = now()
  where id = p_group_id;
  if not found then raise exception 'Tracking link group not found'; end if;
exception
  when unique_violation then
    raise exception 'A group with this name already exists' using errcode = '23505';
end;
$$;

create or replace function public.delete_tracking_link_group(
  p_group_id uuid,
  p_move_links_to_ungrouped boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_link_count integer;
  v_base_position integer;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tracking_link_groups where id = p_group_id) then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  lock table public.tracking_links in share row exclusive mode;
  select count(*)::integer into v_link_count
  from public.tracking_links where group_id = p_group_id;

  if v_link_count > 0 and not p_move_links_to_ungrouped then
    return jsonb_build_object('status', 'PROTECTED', 'links', v_link_count);
  end if;

  if v_link_count > 0 then
    select coalesce(max(position), 0) into v_base_position
    from public.tracking_links where group_id is null;

    with moved as (
      select id, row_number() over (order by position, created_at, id)::integer as ordinal
      from public.tracking_links where group_id = p_group_id
    )
    update public.tracking_links tl
    set group_id = null, position = v_base_position + moved.ordinal * 1000
    from moved where tl.id = moved.id;
  end if;

  delete from public.tracking_link_groups where id = p_group_id;
  return jsonb_build_object('status', 'DELETED', 'moved_links', v_link_count);
end;
$$;

create or replace function public.reorder_tracking_link_groups(p_group_ids uuid[])
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_position integer := 0;
  v_expected integer;
  v_supplied integer;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tracking-link-groups', 0));
  select count(*)::integer into v_expected from public.tracking_link_groups;
  select count(distinct supplied.id)::integer into v_supplied
  from unnest(coalesce(p_group_ids, array[]::uuid[])) as supplied(id);
  if v_expected <> v_supplied
    or exists (
      select 1 from unnest(coalesce(p_group_ids, array[]::uuid[])) supplied(id)
      left join public.tracking_link_groups g on g.id = supplied.id
      where g.id is null
    ) then
    raise exception 'Group order must include every group exactly once';
  end if;

  foreach v_id in array coalesce(p_group_ids, array[]::uuid[]) loop
    v_position := v_position + 1000;
    update public.tracking_link_groups
    set position = v_position, updated_at = now()
    where id = v_id;
  end loop;
end;
$$;

create or replace function public.move_tracking_link(
  p_tracking_link_id uuid,
  p_group_id uuid,
  p_position integer
)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_source_group_id uuid;
  v_is_active boolean;
  v_target_ids uuid[];
  v_source_ids uuid[];
  v_ordered_ids uuid[] := array[]::uuid[];
  v_index integer;
  v_target_position integer;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  if p_group_id is not null
    and not exists (select 1 from public.tracking_link_groups where id = p_group_id) then
    raise exception 'Tracking link group not found';
  end if;

  lock table public.tracking_links in share row exclusive mode;
  select group_id, is_active into v_source_group_id, v_is_active
  from public.tracking_links where id = p_tracking_link_id;
  if not found then raise exception 'Tracking link not found'; end if;
  if not v_is_active then raise exception 'Archived links must be reactivated before they can be moved'; end if;

  select coalesce(array_agg(id order by position, created_at, id), array[]::uuid[])
  into v_target_ids
  from public.tracking_links
  where is_active and group_id is not distinct from p_group_id and id <> p_tracking_link_id;

  v_target_position := least(greatest(coalesce(p_position, 0), 0), cardinality(v_target_ids));
  if cardinality(v_target_ids) > 0 then
    for v_index in 1..cardinality(v_target_ids) loop
      if v_index - 1 = v_target_position then
        v_ordered_ids := array_append(v_ordered_ids, p_tracking_link_id);
      end if;
      v_ordered_ids := array_append(v_ordered_ids, v_target_ids[v_index]);
    end loop;
  end if;
  if v_target_position = cardinality(v_target_ids) then
    v_ordered_ids := array_append(v_ordered_ids, p_tracking_link_id);
  end if;

  if cardinality(v_ordered_ids) > 0 then
    for v_index in 1..cardinality(v_ordered_ids) loop
      update public.tracking_links
      set group_id = p_group_id, position = v_index * 1000
      where id = v_ordered_ids[v_index];
    end loop;
  end if;

  if v_source_group_id is distinct from p_group_id then
    select coalesce(array_agg(id order by position, created_at, id), array[]::uuid[])
    into v_source_ids
    from public.tracking_links
    where is_active and group_id is not distinct from v_source_group_id;

    if cardinality(v_source_ids) > 0 then
      for v_index in 1..cardinality(v_source_ids) loop
        update public.tracking_links set position = v_index * 1000
        where id = v_source_ids[v_index];
      end loop;
    end if;
  end if;
end;
$$;

create or replace function public.create_tracking_link(
  p_source text,
  p_campaign text,
  p_destination text,
  p_slug text,
  p_group_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_position integer;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  if p_group_id is not null
    and not exists (select 1 from public.tracking_link_groups where id = p_group_id) then
    raise exception 'Tracking link group not found';
  end if;

  lock table public.tracking_links in share row exclusive mode;
  select coalesce(max(position), 0) + 1000 into v_position
  from public.tracking_links where is_active and group_id is not distinct from p_group_id;

  insert into public.tracking_links (source, campaign, destination, slug, group_id, position)
  values (p_source, trim(p_campaign), trim(p_destination), p_slug, p_group_id, v_position)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_tracking_link_archived(
  p_tracking_link_id uuid,
  p_archived boolean
)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_group_id uuid;
  v_position integer;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  select group_id into v_group_id from public.tracking_links where id = p_tracking_link_id;
  if not found then raise exception 'Tracking link not found'; end if;

  if not p_archived then
    select coalesce(max(position), 0) + 1000 into v_position
    from public.tracking_links
    where is_active and group_id is not distinct from v_group_id and id <> p_tracking_link_id;
  end if;

  update public.tracking_links set
    is_active = not p_archived,
    archived_at = case when p_archived then now() else null end,
    archived_by = case when p_archived then auth.uid() else null end,
    position = case when p_archived then position else v_position end
  where id = p_tracking_link_id;
end;
$$;

revoke all on function public.create_tracking_link_group(text) from public, anon;
revoke all on function public.rename_tracking_link_group(uuid,text) from public, anon;
revoke all on function public.delete_tracking_link_group(uuid,boolean) from public, anon;
revoke all on function public.reorder_tracking_link_groups(uuid[]) from public, anon;
revoke all on function public.move_tracking_link(uuid,uuid,integer) from public, anon;
revoke all on function public.create_tracking_link(text,text,text,text,uuid) from public, anon;
revoke all on function public.set_tracking_link_archived(uuid,boolean) from public, anon;

grant execute on function public.create_tracking_link_group(text) to authenticated;
grant execute on function public.rename_tracking_link_group(uuid,text) to authenticated;
grant execute on function public.delete_tracking_link_group(uuid,boolean) to authenticated;
grant execute on function public.reorder_tracking_link_groups(uuid[]) to authenticated;
grant execute on function public.move_tracking_link(uuid,uuid,integer) to authenticated;
grant execute on function public.create_tracking_link(text,text,text,text,uuid) to authenticated;
grant execute on function public.set_tracking_link_archived(uuid,boolean) to authenticated;

commit;
