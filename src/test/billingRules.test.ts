// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { effectiveTaxRate, processingFeeFor } from '@/control-center/billing'

const migration = readFileSync('supabase/migrations/20260828123000_business_tax_and_invoice_processing_fee.sql', 'utf8')

describe('Business billing rules', () => {
  it('uses percentage points and applies zero tax while the toggle is off', () => {
    expect(effectiveTaxRate({ tax_enabled: false, tax_rate: 8.25 })).toBe(0)
    expect(effectiveTaxRate({ tax_enabled: true, tax_rate: 8.25 })).toBe(8.25)
  })

  it('adds one processing-fee line to the authoritative invoice total', () => {
    expect(processingFeeFor(1_000, { processing_fee_enabled: true, processing_fee_rate: 2.9 })).toEqual({
      subtotal: 1_000,
      rate: 2.9,
      amount: 29,
      total: 1_029,
    })
    expect(processingFeeFor(1_000, { processing_fee_enabled: false, processing_fee_rate: 2.9 }).total).toBe(1_000)
  })

  it('keeps legacy financial records untouched and snapshots only new invoices', () => {
    expect(migration).toContain('add column if not exists tax_enabled boolean')
    expect(migration).toContain('add column if not exists processing_fee_enabled boolean')
    expect(migration).toContain('add column if not exists subtotal_amount numeric')
    expect(migration).toContain('add column if not exists processing_fee_rate numeric(7,4)')
    expect(migration).toContain('add column if not exists processing_fee_amount numeric')
    expect(migration).toContain('v_fee := round(v_subtotal * v_fee_rate / 100, 2)')
    expect(migration).not.toMatch(/update\s+public\.(tickets|ticket_items|quotes|payments)\b/i)
    expect(migration).not.toMatch(/update\s+public\.invoices[\s\S]{0,160}where\s+(subtotal_amount|processing_fee_rate|processing_fee_amount)\s+is\s+null/i)
    expect(migration).not.toMatch(/next_ticket_number\s*=/i)
  })
})
