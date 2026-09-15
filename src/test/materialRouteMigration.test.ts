// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20260915010000_ai_material_and_route_intelligence.sql', import.meta.url), 'utf8')

describe('material and route migration', () => {
  it('applies AI intake only to an untouched draft and computes quote totals', async () => {
    const db = new PGlite()
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.materials(id uuid primary key, name text not null, price_per_yard numeric not null, full_load_price numeric not null, full_load_yards numeric not null, is_active boolean not null, sort_order integer not null, created_at timestamptz default now(), updated_at timestamptz default now());
      create table public.control_center_settings(id integer primary key, updated_at timestamptz default now());
      create table public.leads(id uuid primary key, customer_id uuid not null, human_takeover boolean not null default false, conversation_revision bigint not null default 0);
      create table public.app_settings(id integer primary key, company_address text not null, company_city_state_zip text not null, delivery_tier_1_max_miles numeric not null, delivery_tier_1_fee numeric not null, delivery_tier_2_max_miles numeric not null, delivery_tier_2_fee numeric not null, delivery_tier_3_max_miles numeric not null, delivery_tier_3_fee numeric not null, delivery_overage_base_fee numeric not null, delivery_overage_per_mile numeric not null, tax_applies_to_delivery boolean not null);
      create table public.quotes(id uuid primary key, lead_id uuid, status text not null, created_at timestamptz default now(), updated_at timestamptz default now(), description text default '', address text not null default '', delivery_type text, delivery_miles numeric, delivery_fee_per_load numeric not null default 0, delivery_load_count integer not null default 1, delivery_total numeric not null default 0, materials_subtotal numeric not null default 0, custom_work_subtotal numeric not null default 0, tax_rate numeric not null default 0, tax_applies_to_delivery boolean not null default false, custom_work_tax_rule text not null default 'EXEMPT', tax_amount numeric not null default 0, grand_total numeric not null default 0, notes text);
      create table public.quote_items(id uuid primary key default gen_random_uuid(), quote_id uuid not null, kind text not null, material_id uuid, description text not null, loads integer, yards numeric, is_full_load boolean not null default false, rate_used numeric not null default 0, line_total numeric not null default 0, created_at timestamptz default now());
      create function public.is_admin_or_staff() returns boolean language sql as 'select true';
      insert into public.materials values('10000000-0000-4000-8000-000000000001','Commercial Crushed Concrete Clean',20,350,20,true,1,now(),now());
      insert into public.control_center_settings(id) values(1);
      insert into public.app_settings values(1,'7653 S FM 148','Kaufman, TX 75142',2,0,5,60,10,100,100,10,false);
      insert into public.leads values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',false,4);
      insert into public.quotes(id,lead_id,status,tax_rate) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','DRAFT',0);
    `)
    await db.exec(migration)
    const seeded = await db.query<{ tons_per_cubic_yard: number; tons_conversion_verified: boolean }>('select tons_per_cubic_yard,tons_conversion_verified from public.materials limit 1')
    expect(Number(seeded.rows[0].tons_per_cubic_yard)).toBe(1.4)
    expect(seeded.rows[0].tons_conversion_verified).toBe(false)

    await db.query(`select public.apply_ai_material_to_quote($1,$2,$3,$4)`, [
      '20000000-0000-4000-8000-000000000001', 4, '10000000-0000-4000-8000-000000000001', 10,
    ])
    await db.query(`select public.apply_ai_route_to_quote($1,$2,$3,$4,$5,$6)`, [
      '20000000-0000-4000-8000-000000000001', 4, '123 Oak Road, Terrell, TX 75160',
      '7653 S FM 148, Kaufman, TX 75142', 15, 'place-1',
    ])
    const quote = await db.query<{ materials_subtotal: number; delivery_fee_per_load: number; delivery_total: number; grand_total: number; delivery_distance_source: string }>('select materials_subtotal,delivery_fee_per_load,delivery_total,grand_total,delivery_distance_source from public.quotes limit 1')
    expect(quote.rows[0]).toMatchObject({ delivery_distance_source: 'GOOGLE_ROUTES' })
    expect(Number(quote.rows[0].materials_subtotal)).toBe(200)
    expect(Number(quote.rows[0].delivery_fee_per_load)).toBe(150)
    expect(Number(quote.rows[0].delivery_total)).toBe(150)
    expect(Number(quote.rows[0].grand_total)).toBe(350)

    await db.exec(`update public.quotes set delivery_distance_source='MANUAL',delivery_fee_per_load=77`)
    const skipped = await db.query<{ result: { status: string } }>(`select public.apply_ai_route_to_quote($1,$2,$3,$4,$5,$6) result`, [
      '20000000-0000-4000-8000-000000000001', 4, '999 New Road, Terrell, TX 75160',
      '7653 S FM 148, Kaufman, TX 75142', 20, 'place-2',
    ])
    expect(skipped.rows[0].result).toMatchObject({ status: 'SKIPPED_MANUAL_DELIVERY' })
    await db.close()
  })
})

