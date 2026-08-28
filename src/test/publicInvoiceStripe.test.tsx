import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}))

import { PublicInvoice } from '@/pages/CustomerDocument'

const invoice = (overrides: Record<string, unknown> = {}) => ({
  type: 'INVOICE',
  number: '1108',
  status: 'SENT',
  issuedAt: '2026-08-27T12:00:00.000Z',
  dueAt: '2026-08-30T12:00:00.000Z',
  paidAt: null,
  customerName: 'Ellis Construction',
  description: 'Equipment pad grading',
  job: { description: 'Grade equipment pad', address: '225 Industrial Way, Forney' },
  ticketNumbers: ['MT1108'],
  amountSource: 'JOB',
  amount: 2800,
  amountPaid: 0,
  amountDue: 2800,
  disputed: false,
  items: [],
  sourceTotals: null,
  payments: [],
  ...overrides,
})

function renderInvoice(entry = '/invoice/secure-test-token') {
  window.history.replaceState({}, '', entry)
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/invoice/:token" element={<PublicInvoice />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
}

describe('secure public Invoice Stripe states', () => {
  beforeEach(() => invoke.mockReset())
  afterEach(cleanup)

  it('shows Pay Invoice only for a sent, undisputed outstanding Invoice', async () => {
    invoke.mockResolvedValue({ data: { available: true, document: invoice() }, error: null })
    renderInvoice()
    expect(await screen.findByRole('button', { name: 'Pay invoice' })).toBeVisible()
    expect(screen.getAllByText('$2,800.00')).toHaveLength(2)
  })

  it('renders a snapshotted processing fee as its own Invoice line item', async () => {
    invoke.mockResolvedValue({
      data: {
        available: true,
        document: invoice({
          subtotalAmount: 2800,
          processingFeeRate: 3,
          processingFeeAmount: 84,
          amount: 2884,
          amountDue: 2884,
        }),
      },
      error: null,
    })
    renderInvoice()
    expect(await screen.findByText('Processing fee 3%')).toBeVisible()
    expect(screen.getByText('$84.00')).toBeVisible()
    expect(screen.getAllByText('$2,884.00')).toHaveLength(2)
  })

  it('sends only the secure token to Checkout and keeps provider failure isolated', async () => {
    invoke.mockImplementation(async (name: string) => name === 'customer-document'
      ? { data: { available: true, document: invoice() }, error: null }
      : { data: { available: false, error: 'Online payment is temporarily unavailable.' }, error: null })
    renderInvoice()
    fireEvent.click(await screen.findByRole('button', { name: 'Pay invoice' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('stripe-checkout', { body: { token: 'secure-test-token' } }))
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable')
  })

  it('hides Checkout for paid Invoices and renders the receipt state', async () => {
    invoke.mockResolvedValue({
      data: {
        available: true,
        document: invoice({
          status: 'PAID', amountPaid: 2800, amountDue: 0, paidAt: '2026-08-27T18:00:00.000Z',
          payments: [{ id: 'pay-1', amount: 2800, method: 'STRIPE', received_at: '2026-08-27T18:00:00.000Z' }],
        }),
      },
      error: null,
    })
    renderInvoice()
    expect(await screen.findByRole('heading', { name: 'Payment receipt' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pay invoice' })).not.toBeInTheDocument()
    expect(screen.getByText('STRIPE')).toBeVisible()
  })

  it('blocks a disputed Invoice and never offers Checkout', async () => {
    invoke.mockResolvedValue({ data: { available: true, document: invoice({ disputed: true }) }, error: null })
    renderInvoice()
    expect(await screen.findByText('Payment is paused while this invoice is reviewed.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pay invoice' })).not.toBeInTheDocument()
  })

  it('treats a success return as confirming until backend Payment truth arrives', async () => {
    invoke.mockResolvedValue({ data: { available: true, document: invoice() }, error: null })
    const view = renderInvoice('/invoice/secure-test-token?checkout=success')
    expect(await screen.findByText('Your payment is being confirmed.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pay invoice' })).toBeVisible()
    expect(screen.queryByText('Payment receipt')).not.toBeInTheDocument()
    view.unmount()
  })
})
