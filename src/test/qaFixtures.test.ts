// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { deriveAttention } from '@/control-center/approved/state/attention'
import { dateKey, parseDateKey } from '@/control-center/approved/state/jobsData'
import { collectedSeries, computeMoney } from '@/control-center/approved/state/moneyData'
import {
  mapCustomers,
  mapInvoices,
  mapJobs,
  mapLeads,
  mapPayments,
  mapQuotes,
  mapTickets,
  mapWorkerPayments,
} from '@/control-center/approved/state/databaseMap'
import {
  createQaFixtureData,
  fixtureReferenceDate,
  fixtureSignature,
} from '@/control-center/demo/qaFixtures'

const reference = new Date('2026-08-26T12:00:00-05:00')
const at = fixtureReferenceDate(reference)
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('Phase 06 deterministic QA fixture layer', () => {
  it('restores the exact same baseline for the same QA day', () => {
    const first = createQaFixtureData(reference)
    const second = createQaFixtureData(reference)
    expect(fixtureSignature(first)).toBe(fixtureSignature(second))
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('round trips date-only values without shifting a day in local time', () => {
    expect(dateKey(parseDateKey('2026-08-26'))).toBe('2026-08-26')
  })

  it('preserves separate material loads and delivery loads on the mixed ticket', () => {
    const data = createQaFixtureData(reference)
    const ticket = mapTickets(data).find((row) => row.id === 'qa-ticket-mixed')
    expect(ticket?.materialLines.map((line) => line.loads)).toEqual([3, 2])
    expect(ticket?.deliveryLoads).toBe(5)
    expect(data.ticketItems.find((row) => row.id === 'qa-ticket-item-flex-3')?.loads).toBe(3)
  })

  it('derives Needs Attention from the underlying fixture records', () => {
    const data = createQaFixtureData(reference)
    const customers = mapCustomers(data)
    const leads = mapLeads(data)
    const quotes = mapQuotes(data)
    const jobs = mapJobs(data)
    const invoices = mapInvoices(data)
    const attention = deriveAttention({ leads, quotes, jobs, invoices, customers, today: dateKey(new Date(at)), at })

    expect(attention.map((item) => item.id)).toEqual(expect.arrayContaining([
      'blocked:qa-job-ortiz',
      'waiting:qa-lead-escalation',
      'newlead:qa-lead-facebook',
      'schedule:qa-quote-accepted',
      'overdue:qa-invoice-overdue',
      'verify:qa-invoice-zelle',
      'dispute:qa-invoice-dispute',
    ]))
    expect(attention[0]?.id).toBe('blocked:qa-job-ortiz')
  })

  it('reconciles the Collected hero with the sum of daily payment values', () => {
    const data = createQaFixtureData(reference)
    const payments = mapPayments(data)
    const invoices = mapInvoices(data)
    const workerPayments = mapWorkerPayments(data)
    const money = computeMoney({ period: 'MTD', payments, invoices, workerPayments, at })
    const series = collectedSeries({ period: 'MTD', payments, at })
    expect(series.reduce((sum, point) => sum + point.dayValue, 0)).toBe(money.collected)
    expect(money.collected).toBe(3370)
  })

  it('keeps extracted and pending worker pay out of paid totals', () => {
    const data = createQaFixtureData(reference)
    const totals = computeMoney({
      period: 'MTD',
      payments: mapPayments(data),
      invoices: mapInvoices(data),
      workerPayments: mapWorkerPayments(data),
      at,
    })
    expect(totals.workerPay).toBe(1320)
    expect(totals.workerCount).toBe(1)
  })

  it('contains the documented offline, standalone, void and empty-state records', () => {
    const data = createQaFixtureData(reference)
    const tickets = mapTickets(data)
    expect(tickets.find((row) => row.id === 'qa-ticket-offline')?.sync).toBe('PENDING')
    expect(tickets.find((row) => row.id === 'qa-ticket-standalone')?.jobId).toBeUndefined()
    expect(tickets.find((row) => row.id === 'qa-ticket-void')?.status).toBe('VOID')
    expect(data.customers.find((row) => row.id === 'qa-customer-empty')).toBeDefined()
    expect(data.activities.some((row) => row.customer_id === 'qa-customer-empty')).toBe(false)
  })

  it('gates fixture capability and disables the real query while active', () => {
    const demo = read('src/control-center/demo/DemoMode.tsx')
    const context = read('src/control-center/context.tsx')
    const fixture = read('src/control-center/demo/qaFixtures.ts')
    expect(demo).toContain("import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'")
    expect(context).toContain('enabled: !demo.enabled')
    expect(context).toContain('if (demo.enabled) return')
    expect(fixture).not.toContain("@/integrations/supabase")
    expect(fixture).not.toContain('controlDb')
    expect(fixture).not.toContain('localStorage')
  })
})
