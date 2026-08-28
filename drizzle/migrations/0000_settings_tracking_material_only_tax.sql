-- Settings simplification support, material-only current tax, and durable tracking.
-- Forward only: finalized Ticket/Quote/Invoice snapshots, legacy attribution
-- counters, Payments, material prices, and the MT ticket counter are untouched.

begin;

do $$
begin
  if to_regclass('public.tracking_links') is null
    or to_regclass('public.leads') is null
    or to_regclass('public.customers') is null
    or to_regclass('public.contact_submissions') is null then
    raise exception 'Tracking requires the Control Center and public contact-submission schema';
  end if;
end
$$;

-- Current operational tax is material-only. These are current settings, not
-- finalized record snapshots. Existing Tickets and Quotes are not rewritten.
update public.app_settings set tax_applies_to_delivery = false
where tax_applies_to_delivery is distinct from false;
alter table public.app_settings alter column tax_applies_to_delivery set default false;

update public.control_center_settings set custom_work_tax_rule = 'EXEMPT'
where custom_work_tax_rule is distinct from 'EXEMPT';
alter table public.control_center_settings alter column custom_work_tax_rule set default 'EXEMPT';

alter table public.tracking_links
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.tracking_links drop constraint if exists tracking_links_archive_state_check;
alter table public.tracking_links add constraint tracking_links_archive_state_check
  check ((is_active and archived_at is null) or (not is_active and archived_at is not null));

create table if not exists public.tracking_link_visits (
  id uuid primary key default gen_random_uuid(),
  tracking_link_id uuid not null references public.tracking_links(id) on delete restrict,
  visited_at timestamptz not null default now()
);
create index if not exists tracking_link_visits_link_time_idx
  on public.tracking_link_visits (tracking_link_id, visited_at desc);

alter table public.leads add column if not exists tracking_link_id uuid
  references public.tracking_links(id) on delete restrict;
create index if not exists leads_tracking_link_idx
  on public.leads (tracking_link_id, created_at desc)
  where tracking_link_id is not null;

-- QR is valid automatic attribution even though it remains absent from the
-- intentionally simpler manual Lead Source picker.
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('Word of mouth','Facebook','Website','Walk in','QR code','Other'));

alter table public.contact_submissions
  add column if not exists source text,
  add column if not exists campaign text,
  add column if not exists tracking_link_id uuid references public.tracking_links(id) on delete restrict,
  add column if not exists customer_id uuid references public.customers(id) on delete restrict,
  add column if not exists lead_id uuid references public.leads(id) on delete restrict;
create index if not exists contact_submissions_tracking_idx
  on public.contact_submissions (tracking_link_id, submitted_at desc)
  where tracking_link_id is not null;

-- The old integer fields are retained as immutable historical baselines. Exact
-- timestamps were never stored, so they are not backfilled or fabricated.
comment on column public.tracking_links.visits is 'Legacy visit baseline recorded before durable visit rows existed.';
comment on column public.tracking_links.leads is 'Legacy attributed-lead baseline recorded before lead foreign keys existed.';
comment on column public.tracking_links.customers is 'Legacy attributed-customer baseline recorded before lead foreign keys existed.';

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
  coalesce(tl.customers, 0) + (select count(distinct l.customer_id) from public.leads l where l.tracking_link_id = tl.id)::integer as customers
from public.tracking_links tl;

grant select on public.tracking_link_metrics to authenticated;

alter table public.tracking_link_visits enable row level security;
drop policy if exists tracking_link_visits_admin_staff_read on public.tracking_link_visits;
create policy tracking_link_visits_admin_staff_read on public.tracking_link_visits
  for select to authenticated using (public.is_admin_or_staff());
revoke insert, update, delete on public.tracking_link_visits from authenticated, anon;
grant select on public.tracking_link_visits to authenticated;
grant all on public.tracking_link_visits to service_role;

create or replace function public.set_tracking_link_archived(
  p_tracking_link_id uuid,
  p_archived boolean
)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  update public.tracking_links set
    is_active = not p_archived,
    archived_at = case when p_archived then now() else null end,
    archived_by = case when p_archived then auth.uid() else null end
  where id = p_tracking_link_id;

  if not found then raise exception 'Tracking link not found'; end if;
end;
$$;

create or replace function public.delete_tracking_link_if_unused(p_tracking_link_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_visits integer;
  v_leads integer;
  v_customers integer;
  v_attribution_records integer;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  select visits, leads, customers into v_visits, v_leads, v_customers
  from public.tracking_link_metrics where id = p_tracking_link_id;
  if not found then return jsonb_build_object('status', 'NOT_FOUND'); end if;

  select count(*)::integer into v_attribution_records
  from public.contact_submissions where tracking_link_id = p_tracking_link_id;

  if v_visits > 0 or v_leads > 0 or v_customers > 0 or v_attribution_records > 0 then
    return jsonb_build_object(
      'status', 'PROTECTED',
      'visits', v_visits,
      'leads', v_leads,
      'customers', v_customers,
      'attribution_records', v_attribution_records
    );
  end if;

  delete from public.tracking_links where id = p_tracking_link_id;
  return jsonb_build_object('status', 'DELETED');
end;
$$;

revoke all on function public.set_tracking_link_archived(uuid,boolean) from public, anon;
revoke all on function public.delete_tracking_link_if_unused(uuid) from public, anon;
grant execute on function public.set_tracking_link_archived(uuid,boolean) to authenticated;
grant execute on function public.delete_tracking_link_if_unused(uuid) to authenticated;

-- Every public contact submission becomes a real deduplicated Lead. Tracking
-- identity is resolved from the stored link; client-supplied source text is
-- never authoritative. This runs in the same transaction as the submission.
create or replace function public.prepare_website_contact_lead()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_link public.tracking_links%rowtype;
  v_customer public.customers%rowtype;
  v_phone text := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(new.email, ''))), '');
  v_need text;
  v_has_link boolean := false;
begin
  if new.tracking_link_id is not null then
    select * into v_link from public.tracking_links where id = new.tracking_link_id;
    v_has_link := found;
  end if;

  if v_has_link then
    new.source := v_link.source;
    new.campaign := v_link.campaign;
  else
    new.tracking_link_id := null;
    new.source := 'Website';
    new.campaign := null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(v_phone, '') || '|' || coalesce(v_email, ''), 0));
  select * into v_customer from public.customers
  where (v_phone is not null and normalized_phone = v_phone)
     or (v_email is not null and normalized_email = v_email)
  order by last_activity_at desc limit 1 for update;

  if found then
    update public.customers set
      phone = coalesce(phone, nullif(trim(new.phone), '')),
      email = coalesce(email, nullif(trim(new.email), '')),
      normalized_phone = coalesce(normalized_phone, v_phone),
      normalized_email = coalesce(normalized_email, v_email),
      last_activity_at = now()
    where id = v_customer.id returning * into v_customer;
  else
    insert into public.customers (name, phone, normalized_phone, email, normalized_email)
    values (trim(new.name), nullif(trim(new.phone), ''), v_phone, nullif(trim(new.email), ''), v_email)
    returning * into v_customer;
  end if;

  v_need := nullif(trim(concat_ws(': ', nullif(trim(new.project_type), ''), nullif(trim(new.message), ''))), '');
  insert into public.leads (customer_id, source, campaign, tracking_link_id, need)
  values (
    v_customer.id,
    new.source,
    new.campaign,
    new.tracking_link_id,
    coalesce(v_need, 'Website contact request')
  ) returning id into new.lead_id;

  new.customer_id := v_customer.id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
  values (v_customer.id, 'LEAD', new.lead_id, 'CREATED', 'Lead created from website contact form', 'Monkey Trucking website');
  return new;
end;
$$;

drop trigger if exists prepare_website_contact_lead on public.contact_submissions;
create trigger prepare_website_contact_lead
before insert on public.contact_submissions
for each row execute function public.prepare_website_contact_lead();

revoke all on function public.prepare_website_contact_lead() from public, anon, authenticated;

-- Material-only tax is enforced at the database boundary so no client can
-- reintroduce delivery or custom-work tax into a new finalized snapshot.
create or replace function public.enforce_material_only_tax_snapshot()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.tax_applies_to_delivery := false;
  new.tax_amount := round(coalesce(new.materials_subtotal, 0) * coalesce(new.tax_rate, 0) / 100, 2);
  if tg_table_name = 'quotes' then
    new.custom_work_tax_rule := 'EXEMPT';
    new.grand_total := round(
      coalesce(new.materials_subtotal, 0) + coalesce(new.delivery_total, 0)
      + coalesce(new.custom_work_subtotal, 0) + new.tax_amount,
      2
    );
  else
    new.grand_total := round(
      coalesce(new.materials_subtotal, 0) + coalesce(new.delivery_total, 0) + new.tax_amount,
      2
    );
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_material_only_quote_tax on public.quotes;
create trigger enforce_material_only_quote_tax
before insert or update on public.quotes
for each row execute function public.enforce_material_only_tax_snapshot();

drop trigger if exists enforce_material_only_ticket_tax on public.tickets;
create trigger enforce_material_only_ticket_tax
before insert or update on public.tickets
for each row execute function public.enforce_material_only_tax_snapshot();

revoke all on function public.enforce_material_only_tax_snapshot() from public, anon, authenticated;

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
  select * into v_lead from public.leads where public.leads.id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;

  select q.id, q.quote_number into v_id, v_number
  from public.quotes q where q.lead_id = p_lead_id and q.status <> 'VOID'
  order by q.created_at desc limit 1;
  if found then return query select v_id, v_number; return; end if;

  select tax_enabled, tax_rate into v_tax_enabled, v_tax_rate
  from public.app_settings order by id limit 1;

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
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
  values (v_lead.customer_id, 'QUOTE', v_id, 'CREATED', 'Quote ' || v_number || ' draft created', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return query select v_id, v_number;
end;
$$;

commit;