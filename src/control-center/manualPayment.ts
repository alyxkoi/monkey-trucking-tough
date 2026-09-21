/** Customer-facing invoice surcharge, separate from actual processor costs. */
export function manualPaymentMath(invoice: { amount: number; subtotalAmount?: number; processingFeeAmount?: number }, paid: number, fee: number, received: number) {
  const cents = (n: number) => Math.round(n * 100)
  const subtotal = cents(invoice.subtotalAmount ?? invoice.amount - (invoice.processingFeeAmount ?? 0))
  const total = subtotal + cents(fee)
  const outstanding = total - cents(paid)
  return { subtotal: subtotal / 100, total: total / 100, outstanding: outstanding / 100,
    remaining: (outstanding - cents(received)) / 100,
    valid: [fee, received, paid].every(Number.isFinite) && fee >= 0 && fee <= subtotal/100 && Math.abs(cents(fee)-fee*100)<0.00001 && Math.abs(cents(received)-received*100)<0.00001 && received > 0 && cents(received) <= outstanding }
}
