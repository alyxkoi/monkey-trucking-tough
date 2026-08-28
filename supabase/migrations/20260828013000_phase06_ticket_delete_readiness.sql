-- Phase 06 production-readiness: protected permanent Ticket deletion and
-- explicit email readiness state.
--
-- Forward-only. This migration never changes app_settings.next_ticket_number,
-- never rewrites a Ticket snapshot, and never infers legacy material loads.

begin;

do $$
begin
  if to_regclass('public.tickets') is null
    or to_regclass('public.ticket_items') is null
    or to_regclass('public.ticket_history') is null
    or to_regclass('public.invoices') is null
    or to_regclass('public.invoice_tickets') is null
    or to_regclass('public.payments') is null
    or to_regclass('public.activity_history') is null
    or to_regclass('public.control_center_settings') is null then
    raise exception 'Ticket deletion readiness requires the Phase 05 Control Center and Ticket safety schema';
  end if;
end
$$;

create table if not exists public.ticket_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  ticket_number text not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null default auth.uid(),
  reason text not null,
  was_job_linked boolean not null,
  job_id uuid
);

create index if not exists ticket_deletion_audit_deleted_at_idx
  on public.ticket_deletion_audit (deleted_at desc);

alter table public.ticket_deletion_audit enable row level security;
revoke all on public.ticket_deletion_audit from public, anon;
grant select on public.ticket_deletion_audit to authenticated;
grant all on public.ticket_deletion_audit to service_role;

drop policy if exists ticket_deletion_audit_admin_read on public.ticket_deletion_audit;
create policy ticket_deletion_audit_admin_read
  on public.ticket_deletion_audit
  for select to authenticated
  using (public.is_admin_or_staff());

-- The email provider cannot be inferred from browser-visible configuration.
-- This flag stays SETUP_REQUIRED until a real provider-accepted test succeeds.
alter table public.control_center_settings
  add column if not exists email_status text not null default 'SETUP_REQUIRED'
  check (email_status in ('READY', 'SETUP_REQUIRED', 'OFF'));

-- The physically tested Ticket output already uses the approved monochrome
-- Monkey Trucking logo. This updates configuration only, not Ticket history.
update public.control_center_settings
set printable_logo_status = 'READY',
    updated_at = now()
where id = 1 and printable_logo_status <> 'READY';

create or replace function public.delete_ticket_permanently(
  p_ticket_id uuid,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_invoice_status text;
  v_payment_count bigint := 0;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A deletion reason is required';
  end if;

  select * into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  if coalesce(btrim(p_confirmation), '') <> v_ticket.ticket_number then
    return jsonb_build_object(
      'status', 'CONFIRMATION_MISMATCH',
      'ticket_number', v_ticket.ticket_number
    );
  end if;

  -- Any Invoice relationship is protected financial truth, including a voided
  -- Invoice whose correction history must remain coherent. Payments are reached
  -- through that Invoice and make the explanation more specific.
  select i.id, i.invoice_number, i.status
    into v_invoice_id, v_invoice_number, v_invoice_status
  from public.invoices i
  where i.standalone_ticket_id = p_ticket_id
     or exists (
       select 1 from public.invoice_tickets it
       where it.invoice_id = i.id and it.ticket_id = p_ticket_id
     )
  order by case when i.status = 'PAID' then 0 else 1 end, i.created_at
  limit 1;

  if v_invoice_id is not null then
    select count(*) into v_payment_count
    from public.payments
    where invoice_id = v_invoice_id and voided_at is null;

    return jsonb_build_object(
      'status', 'PROTECTED',
      'ticket_number', v_ticket.ticket_number,
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'invoice_status', v_invoice_status,
      'payment_count', v_payment_count,
      'message', case
        when v_invoice_status = 'PAID' or v_payment_count > 0 then
          'This Ticket is part of a paid customer record. Void or correct it instead.'
        else
          'This Ticket is attached to Invoice ' || v_invoice_number || ' and cannot be permanently deleted.'
      end
    );
  end if;

  insert into public.ticket_deletion_audit (
    ticket_id, ticket_number, deleted_by, reason, was_job_linked, job_id
  ) values (
    v_ticket.id,
    v_ticket.ticket_number,
    auth.uid(),
    btrim(p_reason),
    v_ticket.job_id is not null,
    v_ticket.job_id
  );

  -- These rows belong only to the Ticket. Deleting them removes material
  -- references so delete_material_if_unused can succeed when no Quote or other
  -- Ticket still uses the material. The audit above intentionally stores no
  -- material IDs or pricing snapshots.
  delete from public.activity_history
  where entity_type = 'TICKET' and entity_id = p_ticket_id;

  delete from public.ticket_history where ticket_id = p_ticket_id;
  delete from public.ticket_items where ticket_id = p_ticket_id;
  delete from public.tickets where id = p_ticket_id;

  return jsonb_build_object(
    'status', 'DELETED',
    'ticket_number', v_ticket.ticket_number
  );
end;
$$;

revoke all on function public.delete_ticket_permanently(uuid, text, text) from public, anon;
grant execute on function public.delete_ticket_permanently(uuid, text, text) to authenticated;

commit;
