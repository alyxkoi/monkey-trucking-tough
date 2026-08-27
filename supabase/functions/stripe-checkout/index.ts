/* eslint-disable @typescript-eslint/no-explicit-any */
import Stripe from 'npm:stripe@20.4.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { checkoutBlockReason, outstandingCents } from '../_shared/stripe-domain.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})
const SITE_ORIGIN = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://www.monkeytrucking.llc').replace(/\/$/, '')

async function tokenHash(raw: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function publicError(message = 'Online payment is temporarily unavailable. Please try again later.'): Response {
  return json({ available: false, error: message }, 503)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!supabaseUrl || !serviceKey || !stripeSecretKey) return publicError()

  let reservationId: string | null = null
  let stripeClient: Stripe | null = null
  let createdStripeSessionId: string | null = null
  const service = createClient(supabaseUrl, serviceKey)
  try {
    const body = await req.json()
    const rawToken = typeof body?.token === 'string' ? body.token.trim() : ''
    if (rawToken.length < 40 || rawToken.length > 128) return json({ available: false, error: 'This invoice link is not valid.' }, 404)

    const hash = await tokenHash(rawToken)
    const { data: documentToken } = await service.from('customer_document_tokens')
      .select('id,invoice_id,revoked_at')
      .eq('token_hash', hash).eq('document_type', 'INVOICE').maybeSingle()
    if (!documentToken || documentToken.revoked_at) return json({ available: false, error: 'This invoice link is no longer available.' }, 404)

    const [{ data: invoice }, { data: payments }] = await Promise.all([
      service.from('invoices').select('id,invoice_number,customer_id,status,amount,disputed,voided_at').eq('id', documentToken.invoice_id).maybeSingle(),
      service.from('payments').select('amount').eq('invoice_id', documentToken.invoice_id).is('voided_at', null),
    ])
    if (!invoice) return json({ available: false, error: 'This invoice is no longer available.' }, 404)
    const paid = (payments ?? []).reduce((sum: number, payment: any) => sum + Number(payment.amount), 0)
    const block = checkoutBlockReason({ status: invoice.status, amount: invoice.amount, paid, disputed: invoice.disputed, voidedAt: invoice.voided_at })
    if (block) return json({ available: false, error: block }, 409)
    const amountCents = outstandingCents({ status: invoice.status, amount: invoice.amount, paid, disputed: invoice.disputed, voidedAt: invoice.voided_at })

    const { data: reserved, error: reserveError } = await service.rpc('reserve_stripe_checkout_session', {
      p_invoice_id: invoice.id,
      p_document_token_id: documentToken.id,
      p_amount_cents: amountCents,
    })
    if (reserveError) return json({ available: false, error: reserveError.message.includes('disputed') ? 'Online payment is paused while this invoice is being reviewed.' : 'This invoice is not payable right now.' }, 409)
    const reservation = Array.isArray(reserved) ? reserved[0] : reserved
    if (!reservation?.id) throw new Error('Checkout reservation was not created')
    reservationId = reservation.id
    if (reservation.status === 'OPEN' && reservation.checkout_url && (!reservation.expires_at || new Date(reservation.expires_at).getTime() > Date.now())) {
      return json({ available: true, checkoutUrl: reservation.checkout_url, reused: true })
    }

    const { data: customer } = await service.from('customers').select('email').eq('id', invoice.customer_id).maybeSingle()
    const stripe = new Stripe(stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() })
    stripeClient = stripe
    const encodedToken = encodeURIComponent(rawToken)
    const environment = Deno.env.get('STRIPE_ENVIRONMENT') ?? (stripeSecretKey.startsWith('sk_live_') ? 'live' : 'test')
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: invoice.id,
      customer_email: customer?.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: `Monkey Trucking Invoice ${invoice.invoice_number}` },
        },
      }],
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_id: invoice.customer_id,
        document_token_id: documentToken.id,
        environment,
      },
      payment_intent_data: { metadata: { invoice_id: invoice.id, checkout_reservation_id: reservation.id } },
      success_url: `${SITE_ORIGIN}/invoice/${encodedToken}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_ORIGIN}/invoice/${encodedToken}?checkout=cancelled`,
    }, { idempotencyKey: `mt-checkout-${reservation.id}` })
    createdStripeSessionId = session.id

    if (!session.url) throw new Error('Stripe did not return a Checkout URL')
    const { error: activateError } = await service.rpc('activate_stripe_checkout_session', {
      p_reservation_id: reservation.id,
      p_stripe_session_id: session.id,
      p_checkout_url: session.url,
      p_expires_at: new Date(session.expires_at * 1000).toISOString(),
      p_livemode: session.livemode,
    })
    if (activateError) throw new Error(activateError.message)
    await service.from('activity_history').insert({
      customer_id: invoice.customer_id,
      entity_type: 'INVOICE', entity_id: invoice.id, event_type: 'STRIPE_CHECKOUT_CREATED',
      summary: `Secure Checkout prepared for invoice ${invoice.invoice_number}`,
      metadata: { amount_cents: amountCents, environment }, actor_label: 'Stripe payment service',
    })
    return json({ available: true, checkoutUrl: session.url, reused: false })
  } catch (error) {
    const summary = error instanceof Error ? error.message : 'Checkout creation failed'
    console.error('stripe-checkout failed', summary)
    if (stripeClient && createdStripeSessionId) {
      await stripeClient.checkout.sessions.expire(createdStripeSessionId).catch(() => undefined)
    }
    if (reservationId) await service.rpc('fail_stripe_checkout_session', { p_reservation_id: reservationId, p_reason: summary })
    return publicError()
  }
})
