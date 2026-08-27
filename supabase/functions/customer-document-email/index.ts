/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  customerEmailIdempotencyKey,
  firstName,
  formatBusinessDate,
  formatMoney,
  invoiceCanBeEmailed,
  quoteCanBeEmailed,
  verifiedPaymentCanReceiveReceipt,
  type CustomerEmailTemplate,
} from '../_shared/customer-email-domain.ts'
import {
  renderInvoiceReadyEmail,
  renderPaymentReceivedEmail,
  renderQuoteReadyEmail,
  type EmailRenderResult,
} from '../_shared/customer-email-templates.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}
const SITE_ORIGIN = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://www.monkeytrucking.llc'
const FROM = 'Monkey Trucking <no-reply@notify.monkeytrucking.llc>'
const FROM_EMAIL = 'no-reply@notify.monkeytrucking.llc'
const REPLY_TO = 'contact@monkeytrucking.llc'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function secureToken(): Promise<{ raw: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = bytesToBase64Url(bytes)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))
  return { raw, hash: Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('') }
}

function deliveryName(type: string | null, miles: number | null): string {
  if (type === 'free') return 'Free delivery'
  if (miles != null) return `${miles} miles`
  const labels: Record<string, string> = {
    '0_5': '0 to 5 miles', '5_10': '5 to 10 miles', '10_15': '10 to 15 miles', over_15: 'Over 15 miles',
  }
  return labels[type ?? ''] ?? 'Delivery'
}

function paymentMethodName(method: string): string {
  const labels: Record<string, string> = { ACH: 'ACH', CARD: 'Card', ZELLE: 'Zelle', APPLE_PAY: 'Apple Pay', CHECK: 'Check', OTHER: 'Other' }
  return labels[method] ?? method.replaceAll('_', ' ')
}

async function requireStaff(
  service: any,
  req: Request,
  serviceKey: string,
  template: CustomerEmailTemplate,
  internal: boolean,
) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) throw new ResponseError(401, 'Sign in is required')
  // Stripe's verified webhook may request only the already-idempotent Payment
  // receipt. No other template or arbitrary record operation accepts service auth.
  if (internal && template === 'PAYMENT_RECEIVED' && token === serviceKey) return { id: null }
  const { data: authData, error: authError } = await service.auth.getUser(token)
  if (authError || !authData.user) throw new ResponseError(401, 'Your session is no longer valid')
  const { data: role } = await service.from('user_roles').select('role').eq('user_id', authData.user.id).in('role', ['admin', 'staff']).maybeSingle()
  if (!role) throw new ResponseError(403, 'Admin or staff access is required')
  return authData.user
}

class ResponseError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function makeDocumentToken(service: any, type: 'QUOTE' | 'INVOICE', id: string, actorId: string | null) {
  const token = await secureToken()
  const row = {
    document_type: type,
    quote_id: type === 'QUOTE' ? id : null,
    invoice_id: type === 'INVOICE' ? id : null,
    token_hash: token.hash,
    created_by: actorId,
  }
  const { data, error } = await service.from('customer_document_tokens').insert(row).select('id').single()
  if (error) throw new ResponseError(503, 'Secure customer links are not configured yet')
  return { id: data.id as string, raw: token.raw }
}

async function quoteEmail(service: any, quoteId: string, actorId: string | null, resend: boolean) {
  const { data: quote, error } = await service.from('quotes').select('*').eq('id', quoteId).single()
  if (error || !quote) throw new ResponseError(404, 'Quote not found')
  if (!quoteCanBeEmailed(quote.status, resend)) throw new ResponseError(409, resend ? 'This quote cannot be resent in its current state' : 'Only a draft quote can be sent')
  const [{ data: customer }, { data: items }] = await Promise.all([
    service.from('customers').select('id,name,email').eq('id', quote.customer_id).single(),
    service.from('quote_items').select('*').eq('quote_id', quote.id).order('created_at'),
  ])
  if (!customer?.email) throw new ResponseError(422, 'Add a customer email address before sending this quote')
  const documentToken = await makeDocumentToken(service, 'QUOTE', quote.id, actorId)
  const url = `${SITE_ORIGIN}/quote/${documentToken.raw}`
  const materialItems = (items ?? []).filter((item: any) => item.kind === 'MATERIAL')
  const workItems = (items ?? []).filter((item: any) => item.kind === 'CUSTOM_WORK')
  const email = renderQuoteReadyEmail({
    customerFirstName: firstName(customer.name), customerName: customer.name,
    quoteNumber: quote.quote_number, createdDate: formatBusinessDate(quote.created_at), total: formatMoney(Number(quote.grand_total)),
    materials: materialItems.map((item: any) => ({
      name: item.description,
      detail: [item.yards != null ? `${Number(item.yards)} yd` : '', item.loads != null ? `${item.loads} ${item.is_full_load ? 'full ' : ''}load${item.loads === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '),
    })),
    delivery: quote.delivery_type ? { title: deliveryName(quote.delivery_type, quote.delivery_miles), detail: `${quote.delivery_load_count} delivery load${quote.delivery_load_count === 1 ? '' : 's'}` } : undefined,
    customWork: workItems.map((item: any) => ({ title: item.description })), quoteUrl: url,
    privacyUrl: `${SITE_ORIGIN}/privacy-policy`, termsUrl: `${SITE_ORIGIN}/terms`,
  })
  return { customer, email, documentToken, dueAt: null }
}

async function invoiceEmail(service: any, invoiceId: string, actorId: string | null, resend: boolean) {
  const { data: invoice, error } = await service.from('invoices').select('*').eq('id', invoiceId).single()
  if (error || !invoice) throw new ResponseError(404, 'Invoice not found')
  if (!invoiceCanBeEmailed(invoice.status, resend)) throw new ResponseError(409, resend ? 'This invoice cannot be resent in its current state' : 'Only a draft invoice can be sent')
  if (!Number.isFinite(Number(invoice.amount)) || Number(invoice.amount) <= 0) {
    throw new ResponseError(422, 'Enter and confirm a positive Invoice amount before sending')
  }
  const [{ data: customer }, { data: settings }, { data: job }, { data: links }] = await Promise.all([
    service.from('customers').select('id,name,email').eq('id', invoice.customer_id).single(),
    service.from('control_center_settings').select('default_invoice_due_days').eq('id', 1).maybeSingle(),
    invoice.job_id ? service.from('jobs').select('description,address').eq('id', invoice.job_id).maybeSingle() : Promise.resolve({ data: null }),
    service.from('invoice_tickets').select('ticket_id').eq('invoice_id', invoice.id),
  ])
  if (!customer?.email) throw new ResponseError(422, 'Add a customer email address before sending this invoice')
  const ticketIds = (links ?? []).map((item: any) => item.ticket_id)
  const { data: tickets } = ticketIds.length
    ? await service.from('tickets').select('ticket_number').in('id', ticketIds)
    : { data: [] }
  const issuedAt = invoice.issued_at ?? new Date().toISOString()
  const dueAt = invoice.due_at ?? (() => { const date = new Date(issuedAt); date.setDate(date.getDate() + Number(settings?.default_invoice_due_days ?? 3)); return date.toISOString() })()
  const documentToken = await makeDocumentToken(service, 'INVOICE', invoice.id, actorId)
  const email = renderInvoiceReadyEmail({
    customerFirstName: firstName(customer.name), customerName: customer.name,
    invoiceNumber: invoice.invoice_number, issuedDate: formatBusinessDate(issuedAt), dueDate: formatBusinessDate(dueAt),
    amountDue: formatMoney(Number(invoice.amount)), paymentStatus: 'Outstanding',
    job: job ? { title: job.description, detail: job.address || undefined } : { title: invoice.description },
    ticketNumbers: (tickets ?? []).map((ticket: any) => ticket.ticket_number),
    invoiceUrl: `${SITE_ORIGIN}/invoice/${documentToken.raw}`,
    privacyUrl: `${SITE_ORIGIN}/privacy-policy`, termsUrl: `${SITE_ORIGIN}/terms`,
  })
  return { customer, email, documentToken, dueAt }
}

async function paymentEmail(service: any, paymentId: string, actorId: string | null) {
  const { data: payment, error } = await service.from('payments').select('*').eq('id', paymentId).single()
  if (error || !payment) throw new ResponseError(404, 'Payment not found')
  if (!verifiedPaymentCanReceiveReceipt(payment)) throw new ResponseError(409, 'Only a recorded, verified payment can send a receipt')
  const [{ data: invoice }, { data: customer }] = await Promise.all([
    service.from('invoices').select('*').eq('id', payment.invoice_id).single(),
    service.from('customers').select('id,name,email').eq('id', payment.customer_id).single(),
  ])
  if (!invoice || invoice.status !== 'PAID') throw new ResponseError(409, 'The invoice is not recorded as paid')
  if (!customer?.email) return { skipped: true as const, reason: 'missing_email' }
  const { data: job } = invoice.job_id ? await service.from('jobs').select('description').eq('id', invoice.job_id).maybeSingle() : { data: null }
  const documentToken = await makeDocumentToken(service, 'INVOICE', invoice.id, actorId)
  const email = renderPaymentReceivedEmail({
    customerFirstName: firstName(customer.name), customerName: customer.name,
    invoiceNumber: invoice.invoice_number, amountReceived: formatMoney(Number(payment.amount)),
    paymentDate: formatBusinessDate(payment.received_at), paymentMethod: paymentMethodName(String(payment.method)),
    job: job?.description, receiptUrl: `${SITE_ORIGIN}/invoice/${documentToken.raw}`,
    privacyUrl: `${SITE_ORIGIN}/privacy-policy`, termsUrl: `${SITE_ORIGIN}/terms`,
  })
  return { customer, email, documentToken, dueAt: null }
}

async function reserveLog(service: any, input: {
  template: CustomerEmailTemplate; recordId: string; recipient: string; customerId: string;
  tokenId: string; idempotencyKey: string;
}) {
  const messageId = crypto.randomUUID()
  const row = {
    message_id: messageId, template_name: input.template.toLowerCase(), template_type: input.template,
    recipient_email: input.recipient, customer_id: input.customerId,
    quote_id: input.template === 'QUOTE_READY' ? input.recordId : null,
    invoice_id: input.template === 'INVOICE_READY' ? input.recordId : null,
    payment_id: input.template === 'PAYMENT_RECEIVED' ? input.recordId : null,
    document_token_id: input.tokenId, status: 'pending', idempotency_key: input.idempotencyKey,
    sender_email: FROM_EMAIL, reply_to: REPLY_TO, attempted_at: new Date().toISOString(),
  }
  const { data, error } = await service.from('email_send_log').insert(row).select('*').single()
  if (!error) return data
  if (error.code !== '23505') throw new ResponseError(503, 'Transactional email logging is not configured yet')
  const { data: existing } = await service.from('email_send_log').select('*').eq('idempotency_key', input.idempotencyKey).single()
  if (!existing) throw new ResponseError(503, 'The email send could not be reserved')
  return existing
}

async function sendWithResend(apiKey: string, email: EmailRenderResult, to: string, idempotencyKey: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: FROM, to, reply_to: REPLY_TO, subject: email.subject, html: email.html, text: email.text }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body?.message === 'string' ? body.message : `Resend request failed (${response.status})`)
  if (!body?.id) throw new Error('Resend did not return a provider message ID')
  return body.id as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!url || !serviceKey || !resendKey) return json({ error: 'Transactional email is not configured' }, 503)
  const service = createClient(url, serviceKey)

  try {
    const body = await req.json()
    const template = body?.template as CustomerEmailTemplate
    const recordId = typeof body?.recordId === 'string' ? body.recordId : ''
    const resend = body?.resend === true
    const requestId = typeof body?.requestId === 'string' ? body.requestId : undefined
    const internal = body?.internal === true
    if (!['QUOTE_READY', 'INVOICE_READY', 'PAYMENT_RECEIVED'].includes(template) || !recordId) throw new ResponseError(400, 'A valid template and record are required')
    const user = await requireStaff(service, req, serviceKey, template, internal)
    const idempotencyKey = customerEmailIdempotencyKey({ template, recordId, resend, requestId })

    const { data: completedSend } = await service.from('email_send_log')
      .select('status,provider_message_id').eq('idempotency_key', idempotencyKey).maybeSingle()
    if (completedSend?.status === 'accepted_by_provider') {
      return json({ success: true, idempotent: true, providerMessageId: completedSend.provider_message_id })
    }

    const prepared = template === 'QUOTE_READY'
      ? await quoteEmail(service, recordId, user.id, resend)
      : template === 'INVOICE_READY'
        ? await invoiceEmail(service, recordId, user.id, resend)
        : await paymentEmail(service, recordId, user.id)
    if ('skipped' in prepared) return json(prepared)

    const log = await reserveLog(service, {
      template, recordId, recipient: prepared.customer.email, customerId: prepared.customer.id,
      tokenId: prepared.documentToken.id, idempotencyKey,
    })
    if (log.status === 'accepted_by_provider') return json({ success: true, idempotent: true, providerMessageId: log.provider_message_id })
    if (log.status === 'pending' && log.attempted_at && Date.now() - new Date(log.attempted_at).getTime() < 15_000 && log.document_token_id !== prepared.documentToken.id) {
      return json({ error: 'This email is already being sent' }, 409)
    }
    await service.from('email_send_log').update({
      status: 'pending', attempted_at: new Date().toISOString(), error_message: null,
      document_token_id: prepared.documentToken.id,
    }).eq('id', log.id)

    let providerMessageId: string
    try {
      providerMessageId = await sendWithResend(resendKey, prepared.email, prepared.customer.email, idempotencyKey)
    } catch (error) {
      const summary = error instanceof Error ? error.message : 'Resend request failed'
      await service.from('email_send_log').update({ status: 'failed', error_message: summary.slice(0, 1000) }).eq('id', log.id)
      return json({ error: 'Email delivery request failed. You can retry safely.' }, 502)
    }

    const { error: finalizeError } = await service.rpc('finalize_customer_email_send', {
      p_log_id: log.id, p_provider_message_id: providerMessageId, p_due_at: prepared.dueAt,
    })
    if (finalizeError) {
      await service.from('email_send_log').update({ status: 'provider_accepted_finalize_failed', provider_message_id: providerMessageId, error_message: finalizeError.message.slice(0, 1000) }).eq('id', log.id)
      return json({ error: 'The provider accepted the email, but the record could not be finalized. Retry safely.' }, 500)
    }
    return json({ success: true, providerMessageId })
  } catch (error) {
    if (error instanceof ResponseError) return json({ error: error.message }, error.status)
    console.error('customer-document-email failed', error)
    return json({ error: 'Transactional email could not be sent' }, 500)
  }
})
