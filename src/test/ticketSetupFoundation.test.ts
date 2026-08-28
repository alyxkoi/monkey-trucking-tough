// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DELIVERY_TIERS,
  MATERIALS,
  TAX_ON_DELIVERY,
  TAX_RATE,
  deliveryFeePerLoad,
} from '@/control-center/approved/state/pricing'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('Ticket setup foundation', () => {
  it('keeps the approved ten-material catalog and full-load rates', () => {
    expect(MATERIALS.map(({ name, pricePerYard, fullLoadPrice, fullLoadYards }) => ({
      name, pricePerYard, fullLoadPrice, fullLoadYards,
    }))).toEqual([
      { name: 'Commercial Crushed Concrete Clean', pricePerYard: 20, fullLoadPrice: 350, fullLoadYards: 20 },
      { name: 'Select Fill and Cushion Sand', pricePerYard: 20, fullLoadPrice: 350, fullLoadYards: 20 },
      { name: '3x4 Crushed Concrete', pricePerYard: 35, fullLoadPrice: 700, fullLoadYards: 20 },
      { name: 'Flexbase First Class 1" or 3"', pricePerYard: 38, fullLoadPrice: 720, fullLoadYards: 20 },
      { name: 'Mason Sand', pricePerYard: 45, fullLoadPrice: 820, fullLoadYards: 20 },
      { name: 'Millings Asphalt 1/2" Minus', pricePerYard: 45, fullLoadPrice: 840, fullLoadYards: 20 },
      { name: 'Native Gravel 3/8"-1"', pricePerYard: 53, fullLoadPrice: 980, fullLoadYards: 20 },
      { name: 'Concrete Sand Mix Native Gravel', pricePerYard: 55, fullLoadPrice: 1040, fullLoadYards: 20 },
      { name: 'Decomposed Granite', pricePerYard: 65, fullLoadPrice: 1200, fullLoadYards: 20 },
      { name: 'Limestone 1"-1 1/2"', pricePerYard: 95, fullLoadPrice: 1700, fullLoadYards: 20 },
    ])
  })

  it('uses deterministic approved delivery and tax defaults', () => {
    expect(DELIVERY_TIERS).toMatchObject({ tier3to5: 60, tier6to10: 100, over10Base: 100, over10PerMile: 10, over10Threshold: 10 })
    expect(deliveryFeePerLoad({ mode: 'TIER_0_2' })).toBe(0)
    expect(deliveryFeePerLoad({ mode: 'TIER_3_5' })).toBe(60)
    expect(deliveryFeePerLoad({ mode: 'TIER_6_10' })).toBe(100)
    expect(deliveryFeePerLoad({ mode: 'OVER_10', miles: 15 })).toBe(150)
    expect(deliveryFeePerLoad({ mode: 'PICKUP' })).toBe(0)
    expect(TAX_RATE).toBe(0)
    expect(TAX_ON_DELIVERY).toBe(false)
  })

  it('reconciles only current master data and never touches ticket history or numbering', () => {
    const migration = read('supabase/migrations/20260827200000_ticket_setup_foundation.sql')
    const normalized = migration.replace(/\s+/g, ' ')
    const approvedRows = [
      `(1, 'Commercial Crushed Concrete Clean', 20::numeric, 350::numeric)`,
      `(2, 'Select Fill and Cushion Sand', 20::numeric, 350::numeric)`,
      `(3, '3x4 Crushed Concrete', 35::numeric, 700::numeric)`,
      `(4, 'Flexbase First Class 1" or 3"', 38::numeric, 720::numeric)`,
      `(5, 'Mason Sand', 45::numeric, 820::numeric)`,
      `(6, 'Millings Asphalt 1/2" Minus', 45::numeric, 840::numeric)`,
      `(7, 'Native Gravel 3/8"-1"', 53::numeric, 980::numeric)`,
      `(8, 'Concrete Sand Mix Native Gravel', 55::numeric, 1040::numeric)`,
      `(9, 'Decomposed Granite', 65::numeric, 1200::numeric)`,
      `(10, 'Limestone 1"-1 1/2"', 95::numeric, 1700::numeric)`,
    ]

    approvedRows.forEach((row) => expect(normalized).toContain(row))
    expect(migration).toContain("lower(btrim(name)) = lower(btrim(v_material.name))")
    expect(migration).toContain('full_load_yards = 20')
    expect(migration).toContain('delivery_tier_1_fee = 0')
    expect(migration).toContain('delivery_tier_2_fee = 60')
    expect(migration).toContain('delivery_tier_3_fee = 100')
    expect(migration).toContain('delivery_overage_base_fee = 100')
    expect(migration).toContain('delivery_overage_per_mile = 10')
    expect(migration).toContain('tax_applies_to_delivery = true')
    expect(migration).not.toMatch(/update\s+public\.(tickets|ticket_items|ticket_history)/i)
    expect(migration).not.toMatch(/next_ticket_number\s*=/i)
    expect(migration).not.toMatch(/insert\s+into\s+public\.drivers/i)
  })

  it('uses searchable setup-aware pickers without a production driver fallback', () => {
    const materialPicker = read('src/control-center/approved/components/sales/MaterialSheet.tsx')
    const driverPicker = read('src/control-center/approved/components/tickets/DriverPicker.tsx')
    const drivers = read('src/control-center/approved/state/ticketsData.ts')
    expect(materialPicker).toContain('Search material')
    expect(materialPicker).toContain('No active materials configured')
    expect(read('src/control-center/approved/screens/TicketBuilder.tsx')).toContain('No active materials are configured')
    expect(read('src/control-center/readiness.ts')).toContain('Missing active material:')
    expect(driverPicker).toContain('Search driver')
    expect(driverPicker).toContain('No drivers configured')
    expect(drivers).toContain('export const DRIVERS: Driver[] = []')
  })

  it('embeds the hosted logo before exporting the existing 4 by 6 label', () => {
    const print = read('src/lib/admin/print.ts')
    const preview = read('src/control-center/approved/components/tickets/TicketLabelPreview.tsx')
    expect(print).toContain('MT-LOGO.png')
    expect(print).toContain('await Promise.all')
    expect(print).toContain('center("Monkey Trucking LLC"')
    expect(print).not.toContain('t.companyName.toUpperCase()')
    expect(preview).toContain('TICKET_LOGO_URL')
  })
})
