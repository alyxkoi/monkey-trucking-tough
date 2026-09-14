import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { complianceKeyword, normalizeSentDmStatus, normalizeUsE164 } from '../_shared/sent-dm-domain.ts'
import { verifySignature } from '../_shared/sms-signature.ts'
import { HttpError } from '../_shared/staff-auth.ts'
import { kickCommunications } from '../_shared/communication-kick.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const secret = Deno.env.get('SENT_DM_WEBHOOK_SECRET')
  if (!url || !key || !secret) return json({ error: 'Webhook configuration is incomplete' }, 503)
  if (Number(req.headers.get('Content-Length') ?? 0) > 65536) return json({ error: 'Payload too large' }, 413)
  const rawBody = await req.text()
  if (rawBody.length > 65536) return json({ error: 'Payload too large' }, 413)
  try {
    if (!await verifySignature(req, rawBody, secret)) return json({ error: 'Invalid webhook signature' }, 401)
  } catch (error) {
    return json({ error: 'Webhook signature verification failed' }, error instanceof HttpError ? error.status : 401)
  }
  let envelope
  try { envelope = JSON.parse(rawBody) } catch { return json({ error: 'Invalid JSON' }, 400) }
  const payload = envelope?.payload
  const eventType = String(envelope?.event ?? envelope?.sub_type ?? req.headers.get('X-Webhook-Event-Type') ?? '')
  const messageId = typeof payload?.message_id === 'string' ? payload.message_id : ''
  const suffix = eventType.startsWith('message.') ? eventType.slice('message.'.length) : ''
  const status = normalizeSentDmStatus(payload?.message_status ?? suffix)
  if (envelope?.field !== 'message' || !messageId || !status || String(payload?.channel ?? '').toLowerCase() !== 'sms') {
    return json({ received: true, ignored: true })
  }
  const isInbound = status === 'RECEIVED' || eventType === 'message.received'
  const occurredAt = payload?.received_at ?? envelope?.timestamp
  if (typeof occurredAt !== 'string' || !Number.isFinite(Date.parse(occurredAt))) return json({ error: 'Invalid event timestamp' }, 422)
  const inboundNumber = normalizeUsE164(payload?.inbound_number)
  const businessNumber = normalizeUsE164(payload?.outbound_number)
  if (isInbound && (!inboundNumber || businessNumber !== '+19453750877')) return json({ received: true, ignored: true })
  const text = typeof payload?.text === 'string' && payload.text.trim() ? payload.text.trim().slice(0, 1600) : '[Non-text SMS received]'
  const service = createClient(url, key)
  const result = await service.rpc('ingest_sms_event', {
    p_message_id: messageId, p_event_type: eventType, p_status: status, p_inbound: isInbound,
    p_business_number: businessNumber, p_phone: inboundNumber, p_body: isInbound ? text : null,
    p_keyword: isInbound ? complianceKeyword(text) : null, p_occurred_at: occurredAt,
    p_error: null,
  })
  if (result.error) return json({ error: 'Webhook could not be committed; retry required' }, 503)
  const jobId = typeof result.data?.job_id === 'string' ? result.data.job_id : null
  if (jobId) kickCommunications(url, key, { jobId })
  return json(result.data)
})
