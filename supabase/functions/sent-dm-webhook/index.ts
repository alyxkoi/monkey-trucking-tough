/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  complianceKeyword,
  normalizeSentDmStatus,
  normalizeUsE164,
  sentDmEventKey,
  type SentDmStatus,
} from '../_shared/sent-dm-domain.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

class ResponseError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function base64Bytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

async function verifySignature(req: Request, rawBody: string, secret: string): Promise<boolean> {
  const webhookId = req.headers.get('X-Webhook-ID')
  const timestamp = req.headers.get('X-Webhook-Timestamp')
  const signatureHeader = req.headers.get('X-Webhook-Signature')
  if (!webhookId || !timestamp || !signatureHeader) throw new ResponseError(400, 'Missing webhook signature headers')
  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false

  const keyBytes = base64Bytes(secret.replace(/^whsec_/, ''))
  if (!keyBytes) return false
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = new Uint8Array(await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${webhookId}.${timestamp}.${rawBody}`),
  ))
  const candidates = signatureHeader.split(' ').flatMap((part) => part.split(','))
    .map((part) => part.trim()).filter((part) => part && part !== 'v1')
  return candidates.some((candidate) => {
    const actual = base64Bytes(candidate)
    return actual ? equalBytes(expected, actual) : false
  })
}

async function beginEvent(service: any, eventKey: string, messageId: string, eventType: string, status: SentDmStatus) {
  const row = {
    event_key: eventKey,
    provider_message_id: messageId,
    event_type: eventType,
    message_status: status,
    processing_status: 'PROCESSING',
    updated_at: new Date().toISOString(),
  }
  const { error } = await service.from('sms_webhook_events').insert(row)
  if (!error) return 'PROCESS'
  if (error.code !== '23505') throw new ResponseError(503, 'Webhook event could not be reserved')
  const { data: existing } = await service.from('sms_webhook_events')
    .select('processing_status').eq('event_key', eventKey).single()
  if (existing?.processing_status === 'PROCESSED' || existing?.processing_status === 'IGNORED') return 'DONE'
  if (existing?.processing_status === 'PROCESSING') throw new ResponseError(409, 'Webhook event is already processing')
  const { data: retried, error: retryError } = await service.from('sms_webhook_events').update({
    processing_status: 'PROCESSING', error_message: null, updated_at: new Date().toISOString(),
  }).eq('event_key', eventKey).eq('processing_status', 'FAILED')
    .select('event_key').maybeSingle()
  if (retryError) throw new ResponseError(503, 'Webhook event could not be retried')
  if (!retried) throw new ResponseError(409, 'Webhook event is already processing')
  return 'PROCESS'
}

async function finishEvent(service: any, eventKey: string, status: 'PROCESSED' | 'IGNORED') {
  const { error } = await service.from('sms_webhook_events').update({
    processing_status: status,
    processed_at: new Date().toISOString(),
    error_message: null,
    updated_at: new Date().toISOString(),
  }).eq('event_key', eventKey)
  if (error) throw new ResponseError(503, 'Webhook event could not be finalized')
}

async function failEvent(service: any, eventKey: string, message: string) {
  await service.from('sms_webhook_events').update({
    processing_status: 'FAILED',
    error_message: message.slice(0, 1000),
    updated_at: new Date().toISOString(),
  }).eq('event_key', eventKey)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const webhookSecret = Deno.env.get('SENT_DM_WEBHOOK_SECRET')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Webhook database access is not configured' }, 503)
  if (!webhookSecret) return json({ error: 'No sent.DM signing secret is configured' }, 503)

  const rawBody = await req.text()
  try {
    if (!await verifySignature(req, rawBody, webhookSecret)) return json({ error: 'Invalid webhook signature' }, 401)
  } catch (error) {
    if (error instanceof ResponseError) return json({ error: error.message }, error.status)
    return json({ error: 'Webhook signature verification failed' }, 401)
  }

  const service = createClient(supabaseUrl, serviceKey)
  let eventKey: string | null = null
  let eventReserved = false
  try {
    const envelope = JSON.parse(rawBody)
    const payload = envelope?.payload
    const eventType = String(envelope?.event ?? envelope?.sub_type ?? req.headers.get('X-Webhook-Event-Type') ?? '')
    const messageId = typeof payload?.message_id === 'string' ? payload.message_id : ''
    const suffix = eventType.startsWith('message.') ? eventType.slice('message.'.length) : ''
    const status = normalizeSentDmStatus(payload?.message_status ?? suffix)
    const isInbound = status === 'RECEIVED' || eventType === 'message.received'
    if (envelope?.field !== 'message' || !messageId || !status) return json({ received: true, ignored: true })
    if (String(payload?.channel ?? '').toLowerCase() !== 'sms') {
      return json({ received: true, ignored: true })
    }

    eventKey = sentDmEventKey(messageId, status)
    if (await beginEvent(service, eventKey, messageId, eventType, status) === 'DONE') {
      return json({ received: true, duplicate: true })
    }
    eventReserved = true

    const { data: settings, error: settingsError } = await service.from('control_center_settings')
      .select('business_number').eq('id', 1).single()
    if (settingsError) throw new ResponseError(503, 'SMS settings could not be loaded')
    const configuredNumber = normalizeUsE164(settings?.business_number)
    if (configuredNumber !== '+19453750877') {
      await finishEvent(service, eventKey, 'IGNORED')
      return json({ received: true, ignored: true })
    }

    // For inbound events sent.DM calls the provisioned business number
    // `outbound_number`. For outbound status events that field is the customer
    // recipient, so the local provider message ID is the correct ownership gate.
    const eventNumber = normalizeUsE164(payload?.outbound_number)
    if (isInbound && eventNumber !== configuredNumber) {
      await finishEvent(service, eventKey, 'IGNORED')
      return json({ received: true, ignored: true })
    }

    if (isInbound) {
      const inboundNumber = normalizeUsE164(payload?.inbound_number)
      if (!inboundNumber) throw new ResponseError(422, 'Inbound sender number is invalid')
      const text = typeof payload?.text === 'string' && payload.text.trim()
        ? payload.text.trim().slice(0, 1600)
        : '[Non-text SMS received]'
      const keyword = complianceKeyword(text)
      const { data: recorded, error: recordError } = await service.rpc('record_inbound_sms', {
        p_provider_message_id: messageId,
        p_phone: inboundNumber,
        p_body: text,
        p_keyword: keyword,
        p_received_at: payload?.received_at ?? envelope?.timestamp ?? new Date().toISOString(),
      })
      if (recordError || !recorded?.message_id) throw new ResponseError(503, 'Inbound SMS could not be saved')
    } else {
      const { data: updated, error: updateError } = await service.rpc('apply_sms_delivery_status', {
        p_provider_message_id: messageId,
        p_provider_status: status,
        p_error_message: null,
      })
      if (updateError) throw new ResponseError(503, 'SMS delivery status could not be applied')
      if (!updated?.message_id) throw new ResponseError(503, 'Outbound SMS has not been linked yet')
    }

    await finishEvent(service, eventKey, 'PROCESSED')
    return json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    if (eventKey && eventReserved) await failEvent(service, eventKey, message)
    if (error instanceof ResponseError) return json({ error: message }, error.status)
    console.error('sent-dm-webhook failed', error)
    return json({ error: 'Webhook processing failed' }, 500)
  }
})
