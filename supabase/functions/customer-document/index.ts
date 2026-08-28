/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

async function tokenHash(raw: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function unavailable(message = 'This link is no longer available.') {
  return json({ available: false, message }, 404)
}

async function resolveQuote(service: any, token: any) {
  const { data: quote } = await service.from('quotes').select('*').eq('id', token.quote_id).maybeSingle()
  if (!quote || quote.status === 'VOID' || quote.status === 'DECLINED') return unavailable()
  const [{ data: customer }, { data: items }] = await Promise.all([
    service.from('customers').select('name').eq('id', quote.customer_id).single(),
    service.from('quote_items').select('id,kind,description,loads,yards,is_full_load,rate_used,line_total').eq('quote_id', quote.id).order('created_at'),
  ])
  return json({
    available: true,
    document: {
      type: 'QUOTE', number: quote.quote_number, status: quote.status,
      createdAt: quote.created_at, acceptedAt: quote.accepted_at,
      customerName: customer?.name ?? 'Customer', description: quote.description,
      address: quote.address, items: items ?? [],
      delivery: quote.delivery_type ? {
        type: quote.delivery_type, miles: quote.delivery_miles,
        loads: quote.delivery_load_count, feePerLoad: quote.delivery_fee_per_load,
        total: quote.delivery_total,
      } : null,
      totals: {
        materials: quote.materials_subtotal, customWork: quote.custom_work_subtotal,
        taxRate: quote.tax_rate, tax: quote.tax_amount, total: quote.grand_total,
      },
      notes: quote.notes,
    },
  })
}

async function invoiceBreakdown(service: any, invoice: any) {
  if (invoice.quote_id) {
    const [{ data: quote }, { data: items }] = await Promise.all([
      service.from('quotes').select('delivery_type,delivery_miles,delivery_load_count,delivery_total,materials_subtotal,custom_work_subtotal,tax_rate,tax_amount,grand_total').eq('id', invoice.quote_id).maybeSingle(),
      service.from('quote_items').select('id,kind,description,loads,yards,is_full_load,rate_used,line_total').eq('quote_id', invoice.quote_id).order('created_at'),
    ])
    return { items: items ?? [], sourceTotals: quote, source: 'QUOTE' }
  }
  if (invoice.standalone_ticket_id) {
    const [{ data: ticket }, { data: items }] = await Promise.all([
      service.from('tickets').select('delivery_type,delivery_miles,load_count,delivery_total,materials_subtotal,tax_rate,tax_amount,grand_total').eq('id', invoice.standalone_ticket_id).maybeSingle(),
      service.from('ticket_items').select('id,material_name,loads,yards,is_full_load,rate_used,line_total').eq('ticket_id', invoice.standalone_ticket_id).is('superseded_at', null).order('created_at'),
    ])
    return {
      items: (items ?? []).map((item: any) => ({ ...item, kind: 'MATERIAL', description: item.material_name })),
      sourceTotals: ticket ? { ...ticket, delivery_load_count: ticket.load_count, custom_work_subtotal: 0 } : null,
      source: 'TICKET',
    }
  }
  return { items: [{ id: invoice.id, kind: 'WORK', description: invoice.description, line_total: invoice.subtotal_amount ?? invoice.amount }], sourceTotals: null, source: 'JOB' }
}

async function resolveInvoice(service: any, token: any) {
  const { data: invoice } = await service.from('invoices').select('*').eq('id', token.invoice_id).maybeSingle()
  if (!invoice || !['SENT', 'PAID'].includes(invoice.status)) return unavailable()
  const [{ data: customer }, { data: job }, { data: links }, { data: payments }, breakdown] = await Promise.all([
    service.from('customers').select('name').eq('id', invoice.customer_id).single(),
    invoice.job_id ? service.from('jobs').select('description,address').eq('id', invoice.job_id).maybeSingle() : Promise.resolve({ data: null }),
    service.from('invoice_tickets').select('ticket_id').eq('invoice_id', invoice.id),
    service.from('payments').select('id,amount,method,received_at,voided_at').eq('invoice_id', invoice.id).is('voided_at', null).order('received_at'),
    invoiceBreakdown(service, invoice),
  ])
  const ticketIds = (links ?? []).map((item: any) => item.ticket_id)
  const { data: tickets } = ticketIds.length ? await service.from('tickets').select('ticket_number').in('id', ticketIds) : { data: [] }
  const paid = (payments ?? []).reduce((sum: number, payment: any) => sum + Number(payment.amount), 0)
  return json({
    available: true,
    document: {
      type: 'INVOICE', number: invoice.invoice_number, status: invoice.status,
      issuedAt: invoice.issued_at, dueAt: invoice.due_at, paidAt: invoice.paid_at,
      customerName: customer?.name ?? 'Customer', description: invoice.description,
      job: job ?? null, ticketNumbers: (tickets ?? []).map((ticket: any) => ticket.ticket_number),
      items: breakdown.items, sourceTotals: breakdown.sourceTotals, amountSource: breakdown.source,
      subtotalAmount: invoice.subtotal_amount ?? invoice.amount,
      processingFeeRate: invoice.processing_fee_rate ?? 0,
      processingFeeAmount: invoice.processing_fee_amount ?? 0,
      amount: invoice.amount, amountPaid: paid, amountDue: Math.max(0, Number(invoice.amount) - paid),
      payments: payments ?? [], disputed: invoice.disputed,
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ available: false, message: 'This document is temporarily unavailable. Please try again.' }, 503)
  const service = createClient(url, serviceKey)

  try {
    const body = await req.json()
    const rawToken = typeof body?.token === 'string' ? body.token.trim() : ''
    const documentType = body?.documentType === 'INVOICE' ? 'INVOICE' : body?.documentType === 'QUOTE' ? 'QUOTE' : null
    const action = body?.action === 'ACCEPT' ? 'ACCEPT' : 'VIEW'
    if (!documentType || rawToken.length < 40 || rawToken.length > 128) return unavailable()
    const hash = await tokenHash(rawToken)
    const { data: token } = await service.from('customer_document_tokens').select('*').eq('token_hash', hash).eq('document_type', documentType).maybeSingle()
    if (!token || token.revoked_at) return unavailable()

    if (action === 'ACCEPT') {
      if (documentType !== 'QUOTE') return json({ error: 'Only quotes can be accepted' }, 400)
      const { data, error } = await service.rpc('accept_public_quote', { p_token_hash: hash })
      if (error) return json({ error: error.message.includes('available') ? error.message : 'This quote cannot be accepted right now.' }, 409)
      return json({ success: true, quote: data?.[0] ?? data })
    }

    const viewedAt = new Date().toISOString()
    await service.from('customer_document_tokens').update({
      first_viewed_at: token.first_viewed_at ?? viewedAt,
      latest_viewed_at: viewedAt,
    }).eq('id', token.id)
    return documentType === 'QUOTE' ? resolveQuote(service, token) : resolveInvoice(service, token)
  } catch (error) {
    console.error('customer-document failed', error)
    return json({ available: false, message: 'This document is temporarily unavailable. Please try again.' }, 500)
  }
})
