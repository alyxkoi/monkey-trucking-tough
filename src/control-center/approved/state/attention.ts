/**
 * Needs Attention.
 *
 * A prioritised exception queue derived from the real records, not a list anyone
 * maintains by hand. That is what makes "resolved items disappear automatically"
 * true: handle the underlying thing and the item stops being generated.
 *
 * Routine work the AI handled correctly never appears here.
 */

import type { Invoice } from './moneyData'
import { invoiceStatus } from './moneyData'
import type { Job } from './jobsData'
import type { Customer, Lead, Quote } from './salesData'
import { quoteTotals } from './salesData'

export type Priority = 'NOW' | 'TODAY' | 'FOLLOW_UP'

/**
 * The order from the Master Context:
 * 1 today's work blocked, 2 customer waiting for a human, 3 new lead not handled,
 * 4 accepted work needs scheduling, 5 overdue money, 6 quote follow up,
 * 7 general lead follow up. Manual payment verification slots under overdue money.
 */
export const ATTENTION_RANK = {
  work_blocked: 10,
  customer_waiting: 20,
  ai_failure: 25,
  new_lead: 30,
  needs_scheduling: 40,
  money_overdue: 50,
  payment_verify: 55,
  quote_follow_up: 60,
  lead_follow_up: 70,
} as const

export type AttentionKind = keyof typeof ATTENTION_RANK

/**
 * Which control on the destination screen actually answers this item.
 *
 * Presentation only. It names a control that already exists on that screen so the
 * guided entry can point at it, and it never creates a second button or changes
 * what resolves the underlying issue.
 *
 * `contact`  the customer has to be spoken to, so Call and Text
 * `reply`    a conversation is waiting on a human answer
 * `schedule` agreed work has no date
 * `payment`  money is claimed or owed and has to be verified or recorded
 */
export type RecommendedAction = 'contact' | 'reply' | 'schedule' | 'payment' | 'none'

export type AttentionItem = {
  id: string
  priority: Priority
  kind: AttentionKind
  title: string
  context: string
  since: number
  /** Dollar amount is a tie breaker only, never the sole priority. */
  amount?: number
  action: { label: string; to: string }
  /** The existing control to emphasise once the record opens. */
  recommend: RecommendedAction
}

/**
 * What the destination screen is handed when this item is opened.
 *
 * Only the four things a record needs to explain itself and point somewhere. The
 * item itself is not passed along, because the queue is derived and the item may
 * legitimately stop existing while the screen is still open.
 */
export function toEntry(item: AttentionItem) {
  return {
    id: item.id,
    priority: item.priority,
    title: item.title,
    context: item.context,
    recommend: item.recommend,
  }
}

const PRIORITY_WEIGHT: Record<Priority, number> = { NOW: 0, TODAY: 1, FOLLOW_UP: 2 }

export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const priority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    if (priority !== 0) return priority
    const rank = ATTENTION_RANK[a.kind] - ATTENTION_RANK[b.kind]
    if (rank !== 0) return rank
    if (a.since !== b.since) return a.since - b.since
    return (b.amount ?? 0) - (a.amount ?? 0)
  })
}

const DAY = 24 * 60 * 60 * 1000

export function deriveAttention(input: {
  leads: Lead[]
  quotes: Quote[]
  jobs: Job[]
  invoices: Invoice[]
  customers: Customer[]
  aiFailures?: { id: string; customerId?: string; automationRuleId?: string; at: number; error: string }[]
  today: string
  at?: number
}): AttentionItem[] {
  const at = input.at ?? Date.now()
  const name = (customerId: string) =>
    input.customers.find((customer) => customer.id === customerId)?.name ?? 'Unknown'
  const items: AttentionItem[] = []

  input.aiFailures?.forEach((failure) => {
    items.push({
      id: `ai-failure:${failure.id}`,
      priority: 'TODAY',
      kind: 'ai_failure',
      title: 'Automation draft needs manual attention',
      context: failure.error || 'OpenAI could not produce a safe structured draft.',
      since: failure.at,
      action: { label: 'Review AI setup', to: '/admin/settings/communication' },
      recommend: 'none',
    })
  })

  // 1. Today's work is blocked.
  input.jobs
    .filter((job) => job.blocked && job.date === input.today && job.status !== 'CANCELLED')
    .forEach((job) => {
      items.push({
        id: `blocked:${job.id}`,
        priority: 'NOW',
        kind: 'work_blocked',
        title: job.blocked as string,
        context: `${name(job.customerId)}, today's work cannot go ahead`,
        since: job.blockedAt ?? at,
        action: { label: 'Open Job', to: `/admin/jobs/${job.id}` },
        // Blocked work is almost always missing information only the customer has.
        recommend: 'contact',
      })
    })

  // 2. A customer is waiting on a human.
  input.leads
    .filter((lead) => lead.needsSalvador)
    .forEach((lead) => {
      items.push({
        id: `waiting:${lead.id}`,
        priority: 'NOW',
        kind: 'customer_waiting',
        title: `${name(lead.customerId)} is waiting on your answer`,
        context: 'The AI escalated instead of guessing.',
        since: lead.lastActivityAt,
        action: { label: 'Reply', to: `/admin/leads/${lead.id}` },
        recommend: 'reply',
      })
    })

  input.invoices
    .filter((invoice) => invoice.disputed && invoiceStatus(invoice, at) !== 'VOID')
    .forEach((invoice) => {
      items.push({
        id: `dispute:${invoice.id}`,
        priority: 'NOW',
        kind: 'customer_waiting',
        title: 'Invoice amount is being disputed',
        context: `${name(invoice.customerId)}. Chasing is paused until you settle it.`,
        since: invoice.issuedAt ?? invoice.createdAt,
        amount: invoice.amount,
        action: { label: 'Open Invoice', to: `/admin/money/invoices/${invoice.id}` },
        // A disputed amount is settled by talking to them, never by chasing.
        recommend: 'contact',
      })
    })

  // 3. A new lead nobody has handled.
  input.leads
    .filter(
      (lead) =>
        lead.status === 'NEW' && !lead.messages.some((message) => message.actor === 'salvador'),
    )
    .forEach((lead) => {
      items.push({
        id: `newlead:${lead.id}`,
        priority: 'TODAY',
        kind: 'new_lead',
        title: 'New lead has not been handled',
        context: `${name(lead.customerId)}, ${lead.need.toLowerCase()}, from ${lead.source}`,
        since: lead.createdAt,
        action: { label: 'Reply', to: `/admin/leads/${lead.id}` },
        recommend: 'reply',
      })
    })

  // 4. Accepted work with no date agreed. It stays off the calendar until there is one.
  input.quotes
    .filter(
      (quote) =>
        quote.status === 'ACCEPTED' && !input.jobs.some((job) => job.quoteId === quote.id),
    )
    .forEach((quote) => {
      items.push({
        id: `schedule:${quote.id}`,
        priority: 'TODAY',
        kind: 'needs_scheduling',
        title: 'Accepted quote still needs a work date',
        context: `${name(quote.customerId)}, ${quote.description.toLowerCase()}`,
        since: quote.acceptedAt ?? quote.createdAt,
        amount: quoteTotals(quote).total,
        action: { label: 'Schedule Job', to: '/admin/jobs' },
        recommend: 'schedule',
      })
    })

  // 5. Overdue money where the automated reminders are finished.
  input.invoices
    .filter(
      (invoice) =>
        invoiceStatus(invoice, at) === 'OVERDUE' &&
        !invoice.disputed &&
        !invoice.claimedPaid &&
        invoice.followUps.length >= 3,
    )
    .forEach((invoice) => {
      items.push({
        id: `overdue:${invoice.id}`,
        priority: 'TODAY',
        kind: 'money_overdue',
        title: 'Invoice is overdue and the follow ups are finished',
        context: `${name(invoice.customerId)}, invoice ${invoice.number}`,
        since: invoice.dueAt ?? invoice.createdAt,
        amount: invoice.amount,
        action: { label: 'Open Invoice', to: `/admin/money/invoices/${invoice.id}` },
        // The automated reminders are spent, so a person has to make contact.
        recommend: 'contact',
      })
    })

  // 5b. Someone says they paid. A claim is never a payment.
  input.invoices
    .filter((invoice) => invoice.claimedPaid && invoiceStatus(invoice, at) !== 'PAID')
    .forEach((invoice) => {
      items.push({
        id: `verify:${invoice.id}`,
        priority: 'TODAY',
        kind: 'payment_verify',
        title: 'Customer says the money was sent',
        context: `${name(invoice.customerId)}. Verify it landed before anything is marked paid.`,
        since: invoice.claimedPaid?.at ?? at,
        amount: invoice.amount,
        action: { label: 'Verify Payment', to: `/admin/money/invoices/${invoice.id}` },
        recommend: 'payment',
      })
    })

  // 6. Quote follow up.
  input.quotes
    .filter((quote) => quote.status === 'SENT' && at - (quote.sentAt ?? at) > 2 * DAY)
    .forEach((quote) => {
      items.push({
        id: `quotefu:${quote.id}`,
        priority: 'FOLLOW_UP',
        kind: 'quote_follow_up',
        title: 'Quote follow up is due',
        context: `${name(quote.customerId)}, ${quote.description.toLowerCase()}`,
        since: quote.sentAt ?? quote.createdAt,
        amount: quoteTotals(quote).total,
        action: { label: 'Open Quote', to: `/admin/quotes/${quote.id}` },
        recommend: 'contact',
      })
    })

  // 7. A lead that went quiet.
  input.leads
    .filter(
      (lead) =>
        lead.status === 'TALKING' &&
        !lead.needsSalvador &&
        at - lead.lastActivityAt > 2 * DAY &&
        !lead.quoteId,
    )
    .forEach((lead) => {
      items.push({
        id: `leadfu:${lead.id}`,
        priority: 'FOLLOW_UP',
        kind: 'lead_follow_up',
        title: 'Lead went quiet after the first reply',
        context: `${name(lead.customerId)}, ${lead.need.toLowerCase()}`,
        since: lead.lastActivityAt,
        action: { label: 'Open Lead', to: `/admin/leads/${lead.id}` },
        recommend: 'reply',
      })
    })

  return sortAttention(items)
}
