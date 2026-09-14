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
    create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';
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
      created_at timestamptz not null default now()
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
})
