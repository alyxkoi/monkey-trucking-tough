// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let db: PGlite
const customerId = '11111111-1111-4111-8111-111111111111'
const leadId = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';
    create function auth.role() returns text language sql stable as 'select ''service_role''::text';
    create function public.is_admin_or_staff() returns boolean language sql as 'select true';
    create function public.next_quote_number() returns text language sql as 'select ''Q1001''::text';

    create table public.app_settings (
      id integer primary key,
      tax_enabled boolean not null,
      tax_rate numeric not null
    );
    create table public.customers (
      id uuid primary key,
      last_activity_at timestamptz not null default now()
    );
    create table public.leads (
      id uuid primary key,
      customer_id uuid not null references public.customers(id),
      status text not null,
      need text not null
    );
    create table public.quotes (
      id uuid primary key default gen_random_uuid(),
      quote_number text not null,
      customer_id uuid not null references public.customers(id),
      lead_id uuid references public.leads(id),
      status text not null,
      description text not null,
      address text not null,
      delivery_load_count integer not null,
      tax_rate numeric not null,
      tax_applies_to_delivery boolean not null,
      custom_work_tax_rule text not null,
      accepted_at timestamptz,
      updated_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );
    create table public.customer_document_tokens (
      id uuid primary key,
      token_hash text not null unique,
      document_type text not null,
      quote_id uuid,
      revoked_at timestamptz,
      accepted_at timestamptz
    );
    create table public.activity_history (
      customer_id uuid not null,
      entity_type text not null,
      entity_id uuid not null,
      event_type text not null,
      summary text not null,
      actor_label text
    );

    insert into public.app_settings values (1, true, 0.0825);
    insert into public.customers(id) values ('${customerId}');
    insert into public.leads(id, customer_id, status, need)
    values ('${leadId}', '${customerId}', 'ACTIVE', 'Two loads of crushed concrete');
  `)
  await db.exec(readFileSync(
    'supabase/migrations/20260914231500_fix_create_quote_draft_ambiguous_id.sql',
    'utf8',
  ))
  await db.exec(readFileSync(
    'supabase/migrations/20260916170000_public_quote_acceptance.sql',
    'utf8',
  ))
}, 30_000)

afterAll(async () => { await db?.close() })

describe.sequential('quote draft database action', () => {
  it('creates and returns one draft without an ambiguous id error', async () => {
    const first = (await db.query<{ id: string; quote_number: string }>(
      'select * from public.create_quote_draft_from_lead($1)',
      [leadId],
    )).rows
    const second = (await db.query<{ id: string; quote_number: string }>(
      'select * from public.create_quote_draft_from_lead($1)',
      [leadId],
    )).rows

    expect(first).toHaveLength(1)
    expect(first[0].quote_number).toBe('Q1001')
    expect(second).toEqual(first)
    expect((await db.query<{ count: number }>('select count(*)::int as count from public.quotes')).rows[0].count).toBe(1)
    expect((await db.query<{ status: string }>('select status from public.leads where id = $1', [leadId])).rows[0].status).toBe('QUOTED')
    expect((await db.query<{ count: number }>('select count(*)::int as count from public.activity_history')).rows[0].count).toBe(1)
  })

  it('accepts a sent Quote atomically and stays idempotent on repeat confirmation', async () => {
    await db.exec(`
      insert into public.quotes (
        id, quote_number, customer_id, status, description, address,
        delivery_load_count, tax_rate, tax_applies_to_delivery, custom_work_tax_rule
      ) values (
        '00000000-0000-4000-8000-000000000001', 'Q1004', '${customerId}', 'SENT',
        'Limestone delivery', '4625 Virginia Ave, Dallas, TX 75204', 1, 8.25, false, 'EXEMPT'
      );
      insert into public.customer_document_tokens (id, token_hash, document_type, quote_id)
      values ('00000000-0000-4000-8000-000000000003', 'secure-hash', 'QUOTE', '00000000-0000-4000-8000-000000000001');
    `)

    const first = await db.query<{ status: string; accepted_at: Date }>("select status, accepted_at from public.accept_public_quote('secure-hash')")
    const second = await db.query<{ status: string; accepted_at: Date }>("select status, accepted_at from public.accept_public_quote('secure-hash')")
    const state = await db.query<{ status: string; quote_accepted: Date; token_accepted: Date; events: number }>(`
      select q.status, q.accepted_at quote_accepted, t.accepted_at token_accepted,
        (select count(*)::int from public.activity_history where event_type='ACCEPTED') events
      from public.quotes q join public.customer_document_tokens t on t.quote_id=q.id
      where q.id='00000000-0000-4000-8000-000000000001'
    `)

    expect(first.rows[0].status).toBe('ACCEPTED')
    expect(first.rows[0].accepted_at).toBeTruthy()
    expect(second.rows[0].status).toBe('ACCEPTED')
    expect(second.rows[0].accepted_at).toEqual(first.rows[0].accepted_at)
    expect(state.rows[0]).toMatchObject({ status: 'ACCEPTED', events: 1 })
    expect(state.rows[0].quote_accepted).toEqual(state.rows[0].token_accepted)
  })
})
