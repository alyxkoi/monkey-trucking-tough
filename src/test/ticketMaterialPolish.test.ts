// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { computeTotals, MATERIALS, TAX_RATE } from '@/control-center/approved/state/pricing'
import { formatTaxRate } from '@/lib/tax'
import { forceMonochromePixels } from '@/lib/admin/print'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('Ticket and material final polish', () => {
  it('uses percentage points consistently and keeps the current operational rate at zero', () => {
    expect(TAX_RATE).toBe(0)
    expect(formatTaxRate(0)).toBe('0%')
    expect(formatTaxRate(8.25)).toBe('8.25%')

    const material = MATERIALS[0]
    const totals = computeTotals({
      materialLines: [{ id: 'line', materialId: material.id, materialName: material.name, isFullLoad: false, loads: 0, yards: 5, rateUsed: 20, lineTotal: 100 }],
      customLines: [],
      delivery: { mode: 'PICKUP' },
      deliveryLoads: 1,
      taxRate: 8.25,
    })
    expect(totals.tax).toBe(8.25)
    expect(computeTotals({ ...totalsInput(), taxRate: TAX_RATE }).tax).toBe(0)
  })

  it('converts colored and gray print pixels to pure one-bit output', () => {
    const pixels = new Uint8ClampedArray([
      255, 49, 49, 180,
      143, 203, 255, 255,
      120, 120, 120, 255,
      255, 255, 255, 255,
    ])
    forceMonochromePixels(pixels)
    expect([...pixels]).toEqual([
      0, 0, 0, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
    ])
  })

  it('ships a forward-only zero-tax setting and protected material delete RPC', () => {
    const migration = read('supabase/migrations/20260827220000_ticket_material_final_polish.sql')
    expect(migration).toMatch(/update public\.app_settings\s+set tax_rate = 0/i)
    expect(migration).toContain('delete_material_if_unused')
    expect(migration).toContain('from public.ticket_items')
    expect(migration).toContain('from public.quote_items')
    expect(migration).toContain("'status', 'PROTECTED'")
    expect(migration).toContain('public.is_admin_or_staff()')
    expect(migration).not.toMatch(/update\s+public\.(tickets|ticket_items|quotes|quote_items|invoices|payments)/i)
    expect(migration).not.toMatch(/next_ticket_number\s*=/i)
  })
})

function totalsInput() {
  return {
    materialLines: [],
    customLines: [],
    delivery: { mode: 'PICKUP' as const },
    deliveryLoads: 1,
  }
}
