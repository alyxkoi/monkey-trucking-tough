export type CheckoutInvoice = {
  status: string
  amount: string | number
  paid: string | number
  disputed: boolean
  voidedAt?: string | null
}

export function dollarsToCents(value: string | number): number {
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Money must have no more than two decimal places')
  const [whole, fraction = ''] = raw.split('.')
  const cents = (BigInt(whole) * 100n) + BigInt((fraction + '00').slice(0, 2))
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Payment amount is outside the supported range')
  return Number(cents)
}

export function outstandingCents(invoice: CheckoutInvoice): number {
  const amount = dollarsToCents(invoice.amount)
  const paidRaw = String(invoice.paid).trim()
  const paid = paidRaw === '0' || paidRaw === '0.00' ? 0 : dollarsToCents(paidRaw)
  return amount - paid
}

export function checkoutBlockReason(invoice: CheckoutInvoice): string | null {
  if (invoice.status === 'PAID') return 'Invoice is already paid'
  if (invoice.status === 'VOID' || invoice.voidedAt) return 'Invoice is void'
  if (invoice.status !== 'SENT') return 'Invoice is not payable yet'
  if (invoice.disputed) return 'Invoice payment is paused while the amount is reviewed'
  if (outstandingCents(invoice) <= 0) return 'Invoice has no outstanding balance'
  return null
}

export function isAuthoritativePaidCheckoutEvent(eventType: string, paymentStatus: string): boolean {
  return (eventType === 'checkout.session.completed' && paymentStatus === 'paid')
    || eventType === 'checkout.session.async_payment_succeeded'
}

export function isTerminalUnpaidCheckoutEvent(eventType: string): 'EXPIRED' | 'FAILED' | null {
  if (eventType === 'checkout.session.expired') return 'EXPIRED'
  if (eventType === 'checkout.session.async_payment_failed') return 'FAILED'
  return null
}
