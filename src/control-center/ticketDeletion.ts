import type { ControlData } from '@/control-center/data'

export type TicketDeleteResult =
  | { status: 'DELETED'; ticket_number: string }
  | { status: 'NOT_FOUND' }
  | { status: 'CONFIRMATION_MISMATCH'; ticket_number: string }
  | {
      status: 'PROTECTED'
      ticket_number: string
      invoice_id: string
      invoice_number: string
      invoice_status: string
      payment_count: number
      message: string
    }

/** Mirrors the server's protected-financial-truth boundary for deterministic QA. */
export function ticketDeleteProtection(data: ControlData, ticketId: string) {
  const invoice = data.invoices
    .filter((entry) =>
      entry.standalone_ticket_id === ticketId
      || data.invoiceTickets.some((link) => link.invoice_id === entry.id && link.ticket_id === ticketId),
    )
    .sort((a, b) => Number(b.status === 'PAID') - Number(a.status === 'PAID') || a.created_at.localeCompare(b.created_at))[0]

  if (!invoice) return null
  const paymentCount = data.payments.filter((payment) => payment.invoice_id === invoice.id && !payment.voided_at).length
  return {
    status: 'PROTECTED' as const,
    ticket_number: data.tickets.find((ticket) => ticket.id === ticketId)?.ticket_number ?? '',
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    invoice_status: invoice.status,
    payment_count: paymentCount,
    message: invoice.status === 'PAID' || paymentCount > 0
      ? 'This Ticket is part of a paid customer record. Void or correct it instead.'
      : `This Ticket is attached to Invoice ${invoice.invoice_number} and cannot be permanently deleted.`,
  }
}
