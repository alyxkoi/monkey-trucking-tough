export type CustomerEmailTemplate = 'QUOTE_READY' | 'INVOICE_READY' | 'PAYMENT_RECEIVED'

export function customerEmailIdempotencyKey(input: {
  template: CustomerEmailTemplate
  recordId: string
  resend?: boolean
  requestId?: string
}): string {
  if (input.template === 'PAYMENT_RECEIVED') return `payment-received:${input.recordId}`
  const prefix = input.template === 'QUOTE_READY' ? 'quote-ready' : 'invoice-ready'
  if (!input.resend) return `${prefix}:${input.recordId}:initial`
  if (!input.requestId?.trim()) throw new Error('A request ID is required for an intentional resend')
  return `${prefix}:${input.recordId}:resend:${input.requestId.trim()}`
}

export function quoteCanBeEmailed(status: string, resend: boolean): boolean {
  return resend ? status === 'SENT' || status === 'ACCEPTED' : status === 'DRAFT'
}

export function invoiceCanBeEmailed(status: string, resend: boolean): boolean {
  return resend ? status === 'SENT' : status === 'DRAFT'
}

export function verifiedPaymentCanReceiveReceipt(payment: {
  confirmed_by: string
  voided_at: string | null
}): boolean {
  return payment.voided_at === null && (payment.confirmed_by === 'HUMAN' || payment.confirmed_by === 'PROCESSOR')
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there'
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

// Date-only values are deliberately formatted at noon UTC. This prevents the
// prior local-date bug where an ISO date could display as the previous day.
export function formatBusinessDate(value: string | Date): string {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric',
  }).format(date)
}
