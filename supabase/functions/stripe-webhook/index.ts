/* eslint-disable @typescript-eslint/no-explicit-any */
import Stripe from 'npm:stripe@20.4.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isAuthoritativePaidCheckoutEvent, isTerminalUnpaidCheckoutEvent } from '../_shared/stripe-domain.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

async function markEvent(service: any, event: any, values: Record<string, unknown>) {
  const object = event.data?.object ?? {}
  await service.from('stripe_webhook_events').upsert({
    provider_event_id: event.id,
    event_type: event.type,
    stripe_session_id: object.object === 'checkout.session' ? object.id : null,
    stripe_payment_intent_id: typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id ?? null,
    livemode: event.livemode,
    ...values,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider_event_id' })
}

async function paymentMethodType(stripe: Stripe, paymentIntentId: string | null): Promise<string> {
  if (!paymentIntentId) return 'unknown'
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge.payment_method_details'] })
    const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge as Stripe.Charge : null
    return charge?.payment_method_details?.type ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!supabaseUrl || !serviceKey || !stripeSecretKey || !webhookSecret) return json({ error: 'Webhook is not configured' }, 503)

  const signature = req.headers.get('stripe-signature')
  if (!signature) return json({ error: 'Missing Stripe signature' }, 400)
  const rawBody = await req.text()
  const stripe = new Stripe(stripeSecretKey, { httpClient: Stripe.createFetchHttpClient() })
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch (error) {
    console.error('Stripe webhook signature rejected', error)
    return json({ error: 'Invalid signature' }, 400)
  }

  const service = createClient(supabaseUrl, serviceKey)
  const object = event.data.object as any
  try {
    const terminal = isTerminalUnpaidCheckoutEvent(event.type)
    if (terminal && object.object === 'checkout.session') {
      const { error } = await service.rpc('mark_stripe_checkout_terminal', {
        p_event_id: event.id, p_event_type: event.type, p_stripe_session_id: object.id,
        p_status: terminal, p_livemode: event.livemode,
      })
      if (error) throw new Error(error.message)
      return json({ received: true })
    }

    if (object.object === 'checkout.session' && isAuthoritativePaidCheckoutEvent(event.type, object.payment_status)) {
      const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id ?? ''
      const methodType = await paymentMethodType(stripe, paymentIntentId)
      const { data, error } = await service.rpc('process_stripe_checkout_payment', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_stripe_session_id: object.id,
        p_stripe_payment_intent_id: paymentIntentId,
        p_amount_cents: object.amount_total,
        p_currency: object.currency,
        p_livemode: event.livemode,
        p_provider_payment_method_type: methodType,
        p_paid_at: new Date(event.created * 1000).toISOString(),
      })
      if (error) throw new Error(error.message)
      const result = Array.isArray(data) ? data[0] : data
      if (result?.result_status === 'RECONCILIATION_REQUIRED') return json({ received: true, reconciliationRequired: true })
      if (!result?.payment_id) throw new Error('Verified payment did not return a Payment record')

      const receiptResponse = await fetch(`${supabaseUrl}/functions/v1/customer-document-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template: 'PAYMENT_RECEIVED', recordId: result.payment_id, internal: true }),
      })
      const receipt = await receiptResponse.json().catch(() => ({}))
      if (!receiptResponse.ok) {
        await service.from('stripe_webhook_events').update({
          status: 'FAILED',
          receipt_email_status: 'RETRY_REQUIRED',
          error_message: typeof receipt?.error === 'string' ? receipt.error.slice(0, 1000) : 'Receipt email request failed',
          updated_at: new Date().toISOString(),
        }).eq('provider_event_id', event.id)
        return json({ error: 'Payment recorded; receipt email will retry' }, 500)
      }
      await service.from('stripe_webhook_events').update({
        status: 'PROCESSED',
        receipt_email_status: receipt?.skipped ? 'SKIPPED_NO_EMAIL' : 'ACCEPTED',
        error_message: null, updated_at: new Date().toISOString(),
      }).eq('provider_event_id', event.id)
      return json({ received: true, paymentId: result.payment_id })
    }

    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id ?? null
      const { data: payment } = paymentIntentId
        ? await service.from('payments').select('id,invoice_id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
        : { data: null }
      await markEvent(service, event, {
        stripe_payment_intent_id: paymentIntentId,
        invoice_id: payment?.invoice_id ?? null,
        payment_id: payment?.id ?? null,
        status: 'RECONCILIATION_REQUIRED',
        error_message: event.type === 'charge.refunded'
          ? 'Stripe refund requires manual financial-history review'
          : 'Stripe dispute requires manual review',
      })
      return json({ received: true, reconciliationRequired: true })
    }

    await markEvent(service, event, { status: 'IGNORED', processed_at: new Date().toISOString() })
    return json({ received: true })
  } catch (error) {
    const summary = error instanceof Error ? error.message : 'Webhook processing failed'
    console.error('stripe-webhook processing failed', event.id, summary)
    await markEvent(service, event, { status: 'FAILED', error_message: summary.slice(0, 1000) })
    return json({ error: 'Webhook processing will retry' }, 500)
  }
})
