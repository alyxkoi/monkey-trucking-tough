import type { ControlData } from '@/control-center/data'
import { detectLanguage } from './decision'
import type { AiLanguage, AutomationPreview } from './types'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

function languageFor(data: ControlData, customerId: string, leadId?: string | null): AiLanguage {
  const messages = data.messages.filter((message) => message.customer_id === customerId && (!leadId || message.lead_id === leadId))
  return detectLanguage([...messages].reverse().find((message) => message.sender_type === 'CUSTOMER')?.body ?? '')
}

function customerName(data: ControlData, customerId: string | null) {
  return data.customers.find((customer) => customer.id === customerId)?.name ?? 'No current candidate'
}

function base(ruleId: string, ruleName: string): AutomationPreview {
  return {
    ruleId,
    ruleName,
    eligible: false,
    customerId: null,
    customerName: 'No current candidate',
    subjectType: null,
    subjectId: null,
    dueAt: null,
    reason: 'No record currently meets the trigger.',
    blockedReason: 'No eligible record found.',
    language: 'ENGLISH',
    draft: '',
    stopConditions: [],
    humanTakeoverBlocking: false,
    channel: 'SMS',
    transport: 'SETUP_REQUIRED',
  }
}

function localDateTime(date: string, time: string | null) {
  return new Date(`${date}T${time?.slice(0, 5) || '09:00'}:00`).getTime()
}

export function buildAutomationPreviews(data: ControlData, now = Date.now()): AutomationPreview[] {
  const previews: AutomationPreview[] = []

  const newLead = data.leads.find((lead) => lead.status === 'NEW')
  const newLeadPreview = base('new-lead', 'New lead follow up')
  newLeadPreview.stopConditions = ['Customer replied', 'Human takeover', 'Quote sent', 'Lead won or lost', 'Opt out']
  if (newLead) {
    const messages = data.messages.filter((message) => message.lead_id === newLead.id)
    const quoteSent = data.quotes.some((quote) => quote.lead_id === newLead.id && quote.status !== 'DRAFT' && quote.status !== 'VOID')
    const blocked = newLead.human_takeover || quoteSent || messages.some((message) => message.sender_type === 'CUSTOMER')
    Object.assign(newLeadPreview, {
      eligible: !blocked,
      customerId: newLead.customer_id,
      customerName: customerName(data, newLead.customer_id),
      subjectType: 'LEAD',
      subjectId: newLead.id,
      dueAt: newLead.created_at,
      reason: blocked ? 'A stop condition is active.' : 'New lead has no reply, takeover or quote.',
      blockedReason: blocked ? newLead.human_takeover ? 'Human takeover is active.' : quoteSent ? 'A quote has already progressed.' : 'The customer has already replied.' : null,
      language: languageFor(data, newLead.customer_id, newLead.id),
      draft: 'hey, thanks for reaching out. what is the next detail you want us to help with.',
      humanTakeoverBlocking: newLead.human_takeover,
    })
  }
  previews.push(newLeadPreview)

  const missed = base('missed-call', 'Missed call recovery')
  missed.stopConditions = ['Caller calls back', 'Customer replies', 'Human takeover']
  missed.reason = 'Calling is disconnected and no missed call event exists in the current data model.'
  missed.blockedReason = 'No missed call event is available.'
  previews.push(missed)

  const sentQuote = [...data.quotes]
    .filter((quote) => quote.status === 'SENT')
    .sort((a, b) => (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at))[0]
  const quotePreview = base('quote-follow-up', 'Quote follow up')
  quotePreview.stopConditions = ['Customer replied after quote', 'Accepted', 'Declined', 'Human takeover', 'Lead lost', 'Opt out']
  if (sentQuote) {
    const lead = data.leads.find((item) => item.id === sentQuote.lead_id)
    const messages = data.messages.filter((message) => message.lead_id === sentQuote.lead_id)
    const lastCustomer = [...messages].reverse().find((message) => message.sender_type === 'CUSTOMER')
    const lastHuman = [...messages].reverse().find((message) => message.sender_type === 'HUMAN')
    const spouse = messages.some((message) => /\b(wife|husband|spouse|esposa|esposo)\b/i.test(message.body))
    const sentAt = new Date(sentQuote.sent_at ?? sentQuote.created_at).getTime()
    const dueAt = sentAt + DAY
    const humanBlocks = Boolean(lead?.human_takeover && (!lastHuman || new Date(lastHuman.created_at).getTime() > sentAt))
    const blocked = Boolean(humanBlocks || (lastCustomer && new Date(lastCustomer.created_at).getTime() > sentAt))
    const language = languageFor(data, sentQuote.customer_id, sentQuote.lead_id)
    Object.assign(quotePreview, {
      eligible: !blocked && now >= dueAt,
      customerId: sentQuote.customer_id,
      customerName: customerName(data, sentQuote.customer_id),
      subjectType: 'QUOTE',
      subjectId: sentQuote.id,
      dueAt: new Date(dueAt).toISOString(),
      reason: blocked ? 'A stop condition is active.' : now >= dueAt ? 'The quote is open and its next follow up is due.' : 'The quote is open but the next follow up is not due yet.',
      blockedReason: blocked ? humanBlocks ? 'Human takeover is active on the post quote conversation.' : 'The customer replied after the quote.' : now < dueAt ? 'Waiting for the next cadence point.' : null,
      language,
      draft: spouse ? 'hey, just checking in after you had a chance to talk it over with your wife. let us know if any questions came up.' : 'hey, just checking in on the quote. let us know if any questions came up.',
      humanTakeoverBlocking: humanBlocks,
    })
  }
  previews.push(quotePreview)

  const scheduled = data.jobs
    .filter((job) => job.status === 'SCHEDULED')
    .map((job) => ({ job, scheduledAt: localDateTime(job.scheduled_date, job.scheduled_time) }))
    .filter(({ scheduledAt }) => scheduledAt > now)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0]
  const jobPreview = base('job-reminder', 'Job reminder')
  jobPreview.stopConditions = ['Cancelled', 'Completed', 'Rescheduled']
  if (scheduled) {
    const createdAt = new Date(scheduled.job.created_at).getTime()
    const dueAt = scheduled.scheduledAt - DAY
    const shortNotice = scheduled.scheduledAt - createdAt < DAY
    Object.assign(jobPreview, {
      eligible: !shortNotice && now >= dueAt,
      customerId: scheduled.job.customer_id,
      customerName: customerName(data, scheduled.job.customer_id),
      subjectType: 'JOB',
      subjectId: scheduled.job.id,
      dueAt: new Date(dueAt).toISOString(),
      reason: shortNotice ? 'Job was created less than 24 hours before work.' : now >= dueAt ? 'Scheduled work is within the reminder window.' : 'The reminder window has not opened.',
      blockedReason: shortNotice ? 'Short notice jobs skip the 24 hour reminder.' : now < dueAt ? 'Not due yet.' : null,
      language: languageFor(data, scheduled.job.customer_id),
      draft: `quick reminder, we are scheduled for ${new Date(scheduled.scheduledAt).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()} at ${new Date(scheduled.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}.`,
    })
  }
  previews.push(jobPreview)

  const invoice = [...data.invoices]
    .filter((item) => item.status === 'SENT')
    .sort((a, b) => (a.due_at ?? a.created_at).localeCompare(b.due_at ?? b.created_at))[0]
  const invoicePreview = base('invoice-follow-up', 'Invoice follow up')
  invoicePreview.stopConditions = ['Paid', 'Voided', 'Disputed', 'Due date changed', 'Human takeover', 'Opt out']
  if (invoice) {
    const dueAt = new Date(invoice.due_at ?? invoice.created_at).getTime()
    const completedFollowUps = data.activities.filter((activity) => activity.entity_type === 'INVOICE' && activity.entity_id === invoice.id && /follow.?up/i.test(activity.event_type)).length
    const sequenceComplete = completedFollowUps >= 3
    const blocked = invoice.disputed || Boolean(invoice.payment_claimed_at) || sequenceComplete
    Object.assign(invoicePreview, {
      eligible: !blocked && now >= dueAt,
      customerId: invoice.customer_id,
      customerName: customerName(data, invoice.customer_id),
      subjectType: 'INVOICE',
      subjectId: invoice.id,
      dueAt: new Date(dueAt).toISOString(),
      reason: invoice.disputed ? 'Invoice follow up is paused during a dispute.' : invoice.payment_claimed_at ? 'Customer says payment was sent and human verification is required.' : sequenceComplete ? 'The final automated reminder is complete and the invoice belongs in Needs Attention.' : now >= dueAt ? 'The due date cadence is active.' : 'The invoice is open but not due yet.',
      blockedReason: blocked ? invoice.disputed ? 'Invoice is disputed.' : invoice.payment_claimed_at ? 'Payment claim requires verification.' : 'Automated reminder sequence is complete.' : now < dueAt ? 'Not due yet.' : null,
      language: languageFor(data, invoice.customer_id),
      draft: `hey, a quick reminder that invoice ${invoice.invoice_number} is due. let us know if you need anything from us.`,
    })
  }
  previews.push(invoicePreview)

  const reviewJob = data.jobs
    .filter((job) => job.status === 'COMPLETED' && data.invoices.some((invoice) => invoice.job_id === job.id && invoice.status === 'PAID'))
    .sort((a, b) => {
      const aPaid = data.invoices.find((invoice) => invoice.job_id === a.id && invoice.status === 'PAID')?.paid_at ?? ''
      const bPaid = data.invoices.find((invoice) => invoice.job_id === b.id && invoice.status === 'PAID')?.paid_at ?? ''
      return bPaid.localeCompare(aPaid)
    })[0]
  const reviewPreview = base('review-request', 'Review request')
  reviewPreview.stopConditions = ['Complaint', 'Dispute', 'Opt out', 'Request already logged']
  if (reviewJob) {
    const paidInvoice = data.invoices.find((invoice) => invoice.job_id === reviewJob.id && invoice.status === 'PAID')!
    const dueAt = new Date(paidInvoice.paid_at ?? paidInvoice.updated_at).getTime() + DAY
    const already = data.activities.some((activity) => activity.entity_type === 'JOB' && activity.entity_id === reviewJob.id && /review/i.test(activity.event_type))
    Object.assign(reviewPreview, {
      eligible: !already && now >= dueAt && !paidInvoice.disputed,
      customerId: reviewJob.customer_id,
      customerName: customerName(data, reviewJob.customer_id),
      subjectType: 'JOB',
      subjectId: reviewJob.id,
      dueAt: new Date(dueAt).toISOString(),
      reason: already ? 'A review request was already logged.' : now >= dueAt ? 'Completed work is paid and the appreciation window is open.' : 'Waiting until roughly 24 hours after payment.',
      blockedReason: already ? 'Exactly one review request is allowed.' : now < dueAt ? 'Not due yet.' : null,
      language: languageFor(data, reviewJob.customer_id),
      draft: 'hey, we hope everything came out great. we appreciate you trusting us with the work. if you are happy with it, we would be grateful for a review.',
    })
  }
  previews.push(reviewPreview)

  const reactivationCustomer = data.customers.find((customer) => {
    const paid = data.invoices.filter((invoice) => invoice.customer_id === customer.id && invoice.status === 'PAID').sort((a, b) => (b.paid_at ?? '').localeCompare(a.paid_at ?? ''))[0]
    if (!paid?.paid_at || now - new Date(paid.paid_at).getTime() < 60 * DAY) return false
    const activeLead = data.leads.some((lead) => lead.customer_id === customer.id && !['WON', 'LOST'].includes(lead.status))
    const activeQuote = data.quotes.some((quote) => quote.customer_id === customer.id && ['DRAFT', 'SENT', 'ACCEPTED'].includes(quote.status))
    const activeJob = data.jobs.some((job) => job.customer_id === customer.id && !['COMPLETED', 'CANCELLED'].includes(job.status))
    return !activeLead && !activeQuote && !activeJob
  })
  const reactivate = base('reactivation', '60 day reactivation')
  reactivate.stopConditions = ['Active lead, quote or job', 'Payment problem', 'Complaint', 'Opt out', 'Customer returned', 'Already sent']
  if (reactivationCustomer) {
    const paid = data.invoices.filter((invoice) => invoice.customer_id === reactivationCustomer.id && invoice.status === 'PAID').sort((a, b) => (b.paid_at ?? '').localeCompare(a.paid_at ?? ''))[0]
    const dueAt = new Date(paid.paid_at!).getTime() + 60 * DAY
    const language = languageFor(data, reactivationCustomer.id)
    Object.assign(reactivate, {
      eligible: now >= dueAt,
      customerId: reactivationCustomer.id,
      customerName: reactivationCustomer.name,
      subjectType: 'CUSTOMER',
      subjectId: reactivationCustomer.id,
      dueAt: new Date(dueAt).toISOString(),
      reason: 'Completed and paid work is past the one time reactivation point with no active work.',
      blockedReason: null,
      language,
      draft: language === 'SPANISH' ? 'hola, nomás queríamos ver cómo siguen. si necesitan algo, aquí estamos a sus órdenes.' : 'hey, just checking in. if you need material or help with another project, we are here for you.',
    })
  }
  previews.push(reactivate)

  return previews.map((preview) => {
    if (!preview.customerId) return preview
    const customer = data.customers.find((item) => item.id === preview.customerId)
    if (customer?.sms_opted_out_at) {
      return { ...preview, eligible: false, blockedReason: 'Customer opted out of SMS.', reason: 'Opt out is an immediate stop condition.' }
    }
    if (!customer?.sms_consent_at) {
      return { ...preview, eligible: false, blockedReason: 'Customer SMS consent is not recorded.', reason: 'Dry run will not treat unknown consent as permission.' }
    }
    return preview
  })
}
