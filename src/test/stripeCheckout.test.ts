import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkoutBlockReason,
  dollarsToCents,
  isAuthoritativePaidCheckoutEvent,
  isTerminalUnpaidCheckoutEvent,
  outstandingCents,
} from '../../supabase/functions/_shared/stripe-domain'

const root = resolve(process.cwd())
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Stripe Checkout money and state domain', () => {
  it('converts USD to integer cents without accepting fractional cents', () => {
    expect(dollarsToCents('5800')).toBe(580000)
    expect(dollarsToCents('3182.40')).toBe(318240)
    expect(dollarsToCents('0.01')).toBe(1)
    expect(() => dollarsToCents('12.345')).toThrow(/two decimal places/)
    expect(() => dollarsToCents('0')).toThrow(/supported range/)
  })

  it('uses only the full authoritative outstanding balance', () => {
    const invoice = { status: 'SENT', amount: '5800.00', paid: '0', disputed: false }
    expect(outstandingCents(invoice)).toBe(580000)
    expect(checkoutBlockReason(invoice)).toBeNull()
    expect(checkoutBlockReason({ ...invoice, status: 'PAID' })).toMatch(/already paid/)
    expect(checkoutBlockReason({ ...invoice, status: 'VOID' })).toMatch(/void/)
    expect(checkoutBlockReason({ ...invoice, status: 'DRAFT' })).toMatch(/not payable/)
    expect(checkoutBlockReason({ ...invoice, disputed: true })).toMatch(/paused/)
  })

  it('treats only paid Checkout events as authoritative and preserves terminal failures', () => {
    expect(isAuthoritativePaidCheckoutEvent('checkout.session.completed', 'paid')).toBe(true)
    expect(isAuthoritativePaidCheckoutEvent('checkout.session.completed', 'unpaid')).toBe(false)
    expect(isAuthoritativePaidCheckoutEvent('checkout.session.async_payment_succeeded', 'unpaid')).toBe(true)
    expect(isTerminalUnpaidCheckoutEvent('checkout.session.expired')).toBe('EXPIRED')
    expect(isTerminalUnpaidCheckoutEvent('checkout.session.async_payment_failed')).toBe('FAILED')
  })
})

describe('Stripe server architecture contracts', () => {
  const migration = source('supabase/migrations/20260827213000_phase06_stripe_checkout.sql')
  const checkout = source('supabase/functions/stripe-checkout/index.ts')
  const webhook = source('supabase/functions/stripe-webhook/index.ts')
  const publicInvoice = source('src/pages/CustomerDocument.tsx')
  const data = source('src/control-center/data.ts')

  it('resolves token and authoritative invoice amount server-side', () => {
    expect(checkout).toContain(".eq('token_hash', hash).eq('document_type', 'INVOICE')")
    expect(checkout).toContain("service.from('invoices')")
    expect(checkout).toContain('outstandingCents')
    expect(checkout).toContain("service.rpc('reserve_stripe_checkout_session'")
    expect(checkout).not.toMatch(/body\?\.(amount|invoiceId|customerId)/)
    expect(checkout).toContain("mode: 'payment'")
    expect(checkout).not.toContain('invoice_creation')
  })

  it('reuses only same-amount active sessions and expires failed creations', () => {
    expect(migration).toContain('stripe_checkout_one_active_amount')
    expect(migration).toContain("status in ('CREATING','OPEN')")
    expect(migration).toContain('p_amount_cents <> v_due_cents')
    expect(checkout).toContain('reservation.checkout_url')
    expect(checkout).toContain('stripeClient.checkout.sessions.expire')
  })

  it('verifies the raw signed webhook and creates exactly one operational Payment', () => {
    expect(webhook).toContain("req.headers.get('stripe-signature')")
    expect(webhook).toContain('constructEventAsync')
    expect(webhook.indexOf('constructEventAsync')).toBeLessThan(webhook.indexOf("service.rpc('process_stripe_checkout_payment'"))
    expect(migration).toContain('payments_stripe_payment_intent_unique')
    expect(migration).toContain('payments_stripe_event_unique')
    expect(migration).toContain("'STRIPE', 'PROCESSOR'")
    expect(migration).toContain("set status='PAID'")
  })

  it('keeps provider failures recoverable and visible without joining them to core boot', () => {
    expect(migration).toContain("status in ('FAILED','RECONCILIATION_REQUIRED')")
    expect(webhook).toContain("status: 'FAILED'")
    expect(webhook).toContain("'RECONCILIATION_REQUIRED'")
    expect(data).toContain('loadOptionalStripeData')
    expect(data).toContain('const optionalStripePromise = loadOptionalStripeData()')
    expect(data).toContain('stripeIntegration: optionalStripe.integration')
    expect(data).toContain('Apply the Phase 06 Stripe Checkout migration before enabling online payment.')
  })

  it('uses webhook truth rather than success redirects and sends one idempotent receipt', () => {
    expect(publicInvoice).toContain('Your payment is being confirmed.')
    expect(publicInvoice).not.toContain("status: 'PAID'")
    expect(webhook).toContain("template: 'PAYMENT_RECEIVED'")
    expect(webhook).toContain("receipt_email_status: 'RETRY_REQUIRED'")
    expect(source('supabase/functions/_shared/customer-email-domain.ts')).toContain("return `payment-received:${input.recordId}`")
  })

  it('keeps manual payment as the separate full-balance path', () => {
    const moneyData = source('src/control-center/approved/state/moneyData.ts')
    const manualMethods = moneyData.slice(moneyData.indexOf('export const PAYMENT_METHODS'), moneyData.indexOf('export const PAYMENT_METHOD_LABEL'))
    expect(migration).toContain("'MANUAL'")
    expect(migration).toContain("p_method not in ('ACH','CARD','ZELLE','APPLE_PAY','CHECK','OTHER')")
    expect(manualMethods).not.toContain('STRIPE')
    expect(migration).toContain('v_outstanding := round(v_invoice.amount-v_paid,2)')
  })

  it('skips a missing-email receipt without undoing the verified Payment', () => {
    const email = source('supabase/functions/customer-document-email/index.ts')
    expect(email).toContain("return { skipped: true as const, reason: 'missing_email' }")
    expect(webhook).toContain("receipt?.skipped ? 'SKIPPED_NO_EMAIL' : 'ACCEPTED'")
    expect(webhook.indexOf("service.rpc('process_stripe_checkout_payment'")).toBeLessThan(webhook.indexOf("template: 'PAYMENT_RECEIVED'"))
  })

  it('preserves the three authoritative invoice source paths', () => {
    expect(migration).toContain("v_source := 'QUOTE'; v_amount := v_quote.grand_total")
    expect(migration).toContain("v_source := 'JOB'; v_amount := v_job.agreed_amount")
    expect(source('supabase/migrations/20260826233725_153bad09-043b-46f3-bca2-683f4918a548.sql')).toContain("create_invoice_from_standalone_ticket")
    expect(migration).toContain("select v_id,id from public.tickets")
    expect(migration).not.toMatch(/sum\([^)]*grand_total[^)]*\).*job/i)
  })

  it('does not touch Ticket numbering, snapshots, or public marketing routes', () => {
    expect(migration).not.toContain('next_ticket_number')
    expect(migration).not.toContain('ticket_items')
    expect(migration).not.toContain('app_settings')
    expect(source('src/App.tsx')).toContain('<Route path="/invoice/:token" element={<PublicInvoice />} />')
  })
})
