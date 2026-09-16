import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}))

import { PublicQuote } from '@/pages/CustomerDocument'

const quote = (overrides: Record<string, unknown> = {}) => ({
  type: 'QUOTE',
  number: 'Q1004',
  status: 'SENT',
  createdAt: '2026-09-16T18:59:00.000Z',
  acceptedAt: null,
  customerName: 'Mike Wazowski',
  description: 'Limestone delivery',
  address: '4625 Virginia Ave, Dallas, TX 75204',
  notes: null,
  items: [{ id: 'item-1', kind: 'MATERIAL', description: 'Limestone 1 1/2 inch', loads: 1, yards: 7, is_full_load: false, line_total: 665 }],
  delivery: { type: 'DISTANCE', miles: 38, loads: 1, feePerLoad: 250, total: 250 },
  totals: { materials: 665, customWork: 0, taxRate: 8.25, tax: 54.86, total: 969.86 },
  ...overrides,
})

function renderQuote() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/quote/secure-test-token']}>
        <Routes>
          <Route path="/quote/:token" element={<PublicQuote />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
}

describe('secure public Quote acceptance', () => {
  beforeEach(() => invoke.mockReset())
  afterEach(cleanup)

  it('records acceptance once and immediately renders the confirmation screen', async () => {
    let resolveAcceptance: (value: unknown) => void = () => undefined
    const acceptance = new Promise((resolve) => { resolveAcceptance = resolve })
    invoke
      .mockResolvedValueOnce({ data: { available: true, document: quote() }, error: null })
      .mockReturnValueOnce(acceptance)

    renderQuote()
    fireEvent.click(await screen.findByRole('button', { name: 'Accept quote' }))
    const confirm = screen.getByRole('button', { name: 'Confirm acceptance' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(screen.getByRole('button', { name: 'Accepting…' })).toBeDisabled()
    resolveAcceptance({ data: { success: true, quote: { status: 'ACCEPTED', accepted_at: '2026-09-16T19:02:53.000Z' } }, error: null })

    expect(await screen.findByRole('heading', { name: 'Quote accepted' })).toBeVisible()
    expect(screen.getByText('Acceptance confirmed')).toBeVisible()
    expect(screen.getByText(/Monkey Trucking received your acceptance/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /accept quote|confirm acceptance/i })).not.toBeInTheDocument()
    expect(invoke.mock.calls.filter(([, options]) => options.body.action === 'ACCEPT')).toHaveLength(1)
  })

  it('shows an acceptance failure inline and lets the customer retry', async () => {
    invoke
      .mockResolvedValueOnce({ data: { available: true, document: quote() }, error: null })
      .mockResolvedValueOnce({ data: { error: 'This quote cannot be accepted right now.' }, error: new Error('409') })

    renderQuote()
    fireEvent.click(await screen.findByRole('button', { name: 'Accept quote' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm acceptance' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This quote cannot be accepted right now.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm acceptance' })).toBeEnabled())
  })

  it('renders an already accepted quote as confirmation without acceptance controls', async () => {
    invoke.mockResolvedValue({
      data: { available: true, document: quote({ status: 'ACCEPTED', acceptedAt: '2026-09-16T19:02:53.000Z' }) },
      error: null,
    })
    renderQuote()

    expect(await screen.findByRole('heading', { name: 'Quote accepted' })).toBeVisible()
    expect(screen.getByText('Acceptance confirmed')).toBeVisible()
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
  })
})
