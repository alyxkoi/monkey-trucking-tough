import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Quote } from '@/control-center/approved/state/salesData'

const scheduleJob = vi.hoisted(() => vi.fn())
const rescheduleJob = vi.hoisted(() => vi.fn())

vi.mock('@/control-center/approved/state/AppState', () => ({
  useAppState: () => ({
    customerById: (id: string) => id === 'customer-1' ? { id, name: 'Mike Wazowski' } : undefined,
    scheduleJob,
    rescheduleJob,
  }),
}))

import { ScheduleJobSheet } from '@/control-center/approved/components/jobs/ScheduleJobSheet'

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  id: 'quote-1', number: 'Q1004', leadId: 'lead-1', customerId: 'customer-1', status: 'ACCEPTED',
  description: 'Limestone delivery', address: '4625 Virginia Ave, Dallas, TX 75204',
  requestedDeliveryDate: '2026-09-22', requestedDeliveryTime: '18:30', requestedDeliveryText: 'Tuesday between 6 and 8',
  materialLines: [{ id: 'line-1', materialId: 'material-1', materialName: 'Limestone', isFullLoad: false, loads: 1, yards: 7, rateUsed: 95, lineTotal: 665 }],
  customLines: [], delivery: { mode: 'CUSTOM', customFee: 250 }, deliveryLoads: 1,
  taxRate: 8.25, taxOnDelivery: false, customWorkTax: 'NOT_TAXED',
  snapshotTotals: { materials: 665, custom: 0, delivery: 250, deliveryPerLoad: 250, taxable: 665, tax: 54.86, total: 969.86, taxRate: 8.25, customWorkTax: 'NOT_TAXED', customTaxed: false },
  createdAt: Date.now(), acceptedAt: Date.now(),
  ...overrides,
})

describe('Schedule Job customer request handoff', () => {
  beforeEach(() => scheduleJob.mockReset().mockResolvedValue('job-1'))
  afterEach(cleanup)

  it('prefills the accepted Quote date and time and schedules those exact values', async () => {
    const onClose = vi.fn()
    render(<ScheduleJobSheet open onClose={onClose} quote={quote()} />)

    expect(screen.getByText('Customer requested')).toBeVisible()
    expect(screen.getByText(/Tuesday, Sep 22, 2026 at 6:30 PM/)).toBeVisible()
    expect(screen.getByText('“Tuesday between 6 and 8”')).toBeVisible()
    expect(document.querySelector<HTMLInputElement>('input[type="date"]')).toHaveValue('2026-09-22')
    expect(document.querySelector<HTMLInputElement>('input[type="time"]')).toHaveValue('18:30')

    fireEvent.click(screen.getByRole('button', { name: 'Schedule Job' }))
    await waitFor(() => expect(scheduleJob).toHaveBeenCalledWith(expect.objectContaining({
      quoteId: 'quote-1', date: '2026-09-22', time: '18:30', allDay: false,
    })))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not invent today or 8 AM when the Quote has no customer preference', () => {
    render(<ScheduleJobSheet open onClose={vi.fn()} quote={quote({
      requestedDeliveryDate: undefined,
      requestedDeliveryTime: undefined,
      requestedDeliveryText: undefined,
    })} />)

    expect(document.querySelector<HTMLInputElement>('input[type="date"]')).toHaveValue('')
    expect(document.querySelector<HTMLInputElement>('input[type="time"]')).toHaveValue('')
    expect(screen.getByText('The customer did not provide an exact time. Choose one before scheduling.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Schedule Job' })).toBeDisabled()
  })
})
