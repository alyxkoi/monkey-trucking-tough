import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  customerEmailIdempotencyKey,
  formatBusinessDate,
  invoiceCanBeEmailed,
  quoteCanBeEmailed,
  verifiedPaymentCanReceiveReceipt,
} from '../../supabase/functions/_shared/customer-email-domain'
import {
  renderInvoiceReadyEmail,
  renderPaymentReceivedEmail,
  renderQuoteReadyEmail,
} from '../../supabase/functions/_shared/customer-email-templates'

const root = resolve(process.cwd())
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')
const urls = {
  privacyUrl: 'https://www.monkeytrucking.llc/privacy-policy',
  termsUrl: 'https://www.monkeytrucking.llc/terms',
}

describe('approved transactional email rendering', () => {
  it('renders authoritative quote data, multiple materials, loads, and escaped customer text', () => {
    const email = renderQuoteReadyEmail({
      customerFirstName: '<Salvador>', customerName: 'Salvador & Sons', quoteNumber: 'Q1048',
      createdDate: 'Aug 27, 2026', total: '$4,156.80',
      materials: [
        { name: 'Flexbase', detail: '60 yd · 3 full loads' },
        { name: 'Crushed Concrete', detail: '40 yd · 2 full loads' },
      ],
      delivery: { title: '15 miles', detail: '5 delivery loads' },
      customWork: [{ title: '<script>alert(1)</script> driveway grading' }],
      quoteUrl: 'https://www.monkeytrucking.llc/quote/secure-token', ...urls,
    })
    expect(email.subject).toBe('Your Monkey Trucking quote is ready')
    expect(email.html).toContain('Flexbase')
    expect(email.html).toContain('Crushed Concrete')
    expect(email.html).toContain('5 delivery loads')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('max-width:620px')
    expect(email.html).toContain('class="button body"')
  })

  it('omits optional quote sections instead of rendering blank labels', () => {
    const email = renderQuoteReadyEmail({
      customerFirstName: 'John', customerName: 'John Martinez', quoteNumber: 'Q1049',
      createdDate: 'Aug 27, 2026', total: '$640.00',
      materials: [{ name: 'Mason Sand', detail: '20 yd' }],
      quoteUrl: 'https://www.monkeytrucking.llc/quote/secure-token', ...urls,
    })
    expect(email.html).not.toContain('>DELIVERY<')
    expect(email.html).not.toContain('>WORK<')
  })

  it('renders invoice amount and due date and only includes real ticket references', () => {
    const withoutTickets = renderInvoiceReadyEmail({
      customerFirstName: 'John', customerName: 'John Martinez', invoiceNumber: 'INV-1048',
      issuedDate: 'Aug 27, 2026', dueDate: 'Aug 30, 2026', amountDue: '$5,800.00',
      paymentStatus: 'Outstanding', job: { title: 'Driveway reconstruction', detail: 'Kaufman, Texas' },
      ticketNumbers: [], invoiceUrl: 'https://www.monkeytrucking.llc/invoice/secure-token', ...urls,
    })
    expect(withoutTickets.html).toContain('$5,800.00')
    expect(withoutTickets.html).toContain('Due Aug 30, 2026')
    expect(withoutTickets.html).not.toContain('>TICKETS<')
    const withTickets = renderInvoiceReadyEmail({
      customerFirstName: 'John', customerName: 'John Martinez', invoiceNumber: 'INV-1048',
      issuedDate: 'Aug 27, 2026', dueDate: 'Aug 30, 2026', amountDue: '$5,800.00',
      paymentStatus: 'Outstanding', ticketNumbers: ['MT1048', 'MT1049'],
      invoiceUrl: 'https://www.monkeytrucking.llc/invoice/secure-token', ...urls,
    })
    expect(withTickets.html).toContain('MT1048 · MT1049')
  })

  it('renders a payment receipt from the actual payment event', () => {
    const email = renderPaymentReceivedEmail({
      customerFirstName: 'John', customerName: 'John Martinez', invoiceNumber: 'INV-1048',
      amountReceived: '$5,800.00', paymentDate: 'Aug 27, 2026', paymentMethod: 'Zelle',
      job: 'Driveway reconstruction', receiptUrl: 'https://www.monkeytrucking.llc/invoice/secure-token', ...urls,
    })
    expect(email.subject).toBe('Payment received by Monkey Trucking')
    expect(email.html).toContain('background:#78D69A')
    expect(email.html).toContain('View receipt')
    expect(email.html).toContain('Zelle')
  })
})

describe('transactional workflow safety', () => {
  it('uses stable idempotency for initial sends and real payment events', () => {
    expect(customerEmailIdempotencyKey({ template: 'QUOTE_READY', recordId: 'q1' })).toBe('quote-ready:q1:initial')
    expect(customerEmailIdempotencyKey({ template: 'PAYMENT_RECEIVED', recordId: 'p1' })).toBe('payment-received:p1')
    expect(customerEmailIdempotencyKey({ template: 'INVOICE_READY', recordId: 'i1', resend: true, requestId: 'attempt-2' })).toBe('invoice-ready:i1:resend:attempt-2')
  })

  it('only permits approved document and verified payment states', () => {
    expect(quoteCanBeEmailed('DRAFT', false)).toBe(true)
    expect(quoteCanBeEmailed('VOID', true)).toBe(false)
    expect(invoiceCanBeEmailed('DRAFT', false)).toBe(true)
    expect(invoiceCanBeEmailed('PAID', true)).toBe(false)
    expect(verifiedPaymentCanReceiveReceipt({ confirmed_by: 'HUMAN', voided_at: null })).toBe(true)
    expect(verifiedPaymentCanReceiveReceipt({ confirmed_by: 'CUSTOMER_CLAIM', voided_at: null })).toBe(false)
    expect(verifiedPaymentCanReceiveReceipt({ confirmed_by: 'HUMAN', voided_at: '2026-08-27' })).toBe(false)
  })

  it('keeps date-only values on the intended business date', () => {
    expect(formatBusinessDate('2026-08-27')).toBe('Aug 27, 2026')
  })

  it('keeps status finalization after provider acceptance and keeps Resend server-side', () => {
    const edge = source('supabase/functions/customer-document-email/index.ts')
    const appState = source('src/control-center/approved/state/AppState.tsx')
    expect(edge.indexOf('await sendWithResend')).toBeLessThan(edge.indexOf("service.rpc('finalize_customer_email_send'"))
    expect(edge).toContain("Deno.env.get('RESEND_API_KEY')")
    expect(edge).toContain("status: 'failed'")
    expect(appState).not.toContain("await updateQuote(id, { status: 'SENT'")
    expect(source('src/control-center/data.ts')).not.toContain('RESEND_API_KEY')
    expect(source('src/pages/CustomerDocument.tsx')).not.toContain('RESEND_API_KEY')
  })

  it('protects token resolution and quote acceptance behind service-only server functions', () => {
    const migration = source('supabase/migrations/20260827180000_phase06_transactional_customer_email.sql')
    const publicEdge = source('supabase/functions/customer-document/index.ts')
    expect(migration).toContain('revoke all on public.customer_document_tokens from public, anon, authenticated')
    expect(migration).toContain("where token_hash = p_token_hash and document_type = 'QUOTE'")
    expect(migration).toContain("if v_quote.status = 'SENT' then")
    expect(migration).toContain("status = 'ACCEPTED'")
    expect(publicEdge).toContain(".eq('token_hash', hash).eq('document_type', documentType)")
  })

  it('keeps online payment server-authoritative on the secure public invoice', () => {
    const page = source('src/pages/CustomerDocument.tsx')
    expect(page).toContain("supabase.functions.invoke('stripe-checkout', { body: { token } })")
    expect(page).not.toMatch(/body:\s*\{[^}]*amount/i)
    expect(page).not.toMatch(/card number|card form/i)
    expect(page).not.toContain("status: 'PAID'")
  })
})
