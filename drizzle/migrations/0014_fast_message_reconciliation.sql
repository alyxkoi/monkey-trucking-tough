-- The dashboard's five-second message catch-up query stays index-only at scale.
create index if not exists lead_messages_updated_at_idx
  on public.lead_messages(updated_at);

-- A short database lease prevents overlapping provider reads when pg_net or the
-- provider runs slowly. Webhooks remain primary; this is only a missed/late-event safety net.
create table if not exists public.communication_provider_sync (
  provider text primary key,
  lease_token uuid,
  lease_until timestamptz,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint communication_provider_sync_provider_check check (provider in ('SENT_DM'))
);

insert into public.communication_provider_sync(provider)
values('SENT_DM')
on conflict(provider) do nothing;

alter table public.communication_provider_sync enable row level security;

create or replace function public.claim_sent_dm_reconciliation()
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare claimed_token uuid;
begin
  update public.communication_provider_sync
  set lease_token=gen_random_uuid(),
      lease_until=now()+interval '20 seconds',
      last_started_at=now(),
      updated_at=now()
  where provider='SENT_DM' and (lease_until is null or lease_until<now())
  returning lease_token into claimed_token;
  return claimed_token;
end $$;

create or replace function public.finish_sent_dm_reconciliation(p_lease_token uuid,p_error text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.communication_provider_sync
  set lease_token=null,
      lease_until=null,
      last_succeeded_at=case when p_error is null then now() else last_succeeded_at end,
      last_error=left(p_error,500),
      updated_at=now()
  where provider='SENT_DM' and lease_token=p_lease_token;
end $$;

revoke all on table public.communication_provider_sync from public,anon,authenticated;
grant select,insert,update on table public.communication_provider_sync to service_role;
revoke all on function public.claim_sent_dm_reconciliation() from public,anon,authenticated;
grant execute on function public.claim_sent_dm_reconciliation() to service_role;
revoke all on function public.finish_sent_dm_reconciliation(uuid,text) from public,anon,authenticated;
grant execute on function public.finish_sent_dm_reconciliation(uuid,text) to service_role;