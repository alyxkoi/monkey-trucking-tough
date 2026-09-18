import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { complianceKeyword, normalizeSentDmStatus, normalizeUsE164 } from '../_shared/sent-dm-domain.ts'
import { verifySignature } from '../_shared/sms-signature.ts'
import { HttpError } from '../_shared/staff-auth.ts'
import { kickCommunications } from '../_shared/communication-kick.ts'
import { dispatchSms } from '../_shared/sms-dispatch.ts'
import { recordInboundTiming } from '../_shared/inbound-timing.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  const requestStarted=Date.now()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const secret = Deno.env.get('SENT_DM_WEBHOOK_SECRET')
  if (!url || !key || !secret) return json({ error: 'Webhook configuration is incomplete' }, 503)
  if (Number(req.headers.get('Content-Length') ?? 0) > 65536) return json({ error: 'Payload too large' }, 413)
  const rawBody = await req.text()
  if (rawBody.length > 65536) return json({ error: 'Payload too large' }, 413)
  try {
    if (!await verifySignature(req, rawBody, secret)) {
      const timestamp = Number(req.headers.get('X-Webhook-Timestamp'))
      const timestampSkewSeconds = Number.isFinite(timestamp)
        ? Math.round(Math.abs(Date.now() / 1000 - timestamp))
        : null
      console.warn('sent.DM webhook rejected', {
        reason: timestampSkewSeconds === null || timestampSkewSeconds > 300 ? 'stale_timestamp' : 'invalid_signature',
        timestampSkewSeconds,
        hasWebhookId: Boolean(req.headers.get('X-Webhook-ID')),
        signatureVersion: req.headers.get('X-Webhook-Signature')?.split(',')[0] ?? null,
      })
      return json({ error: 'Invalid webhook signature' }, 401)
    }
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
  const ingestStarted=Date.now()
  const result = await service.rpc('ingest_sms_event', {
    p_message_id: messageId, p_event_type: eventType, p_status: status, p_inbound: isInbound,
    p_business_number: businessNumber, p_phone: inboundNumber, p_body: isInbound ? text : null,
    p_keyword: isInbound ? complianceKeyword(text) : null, p_occurred_at: occurredAt,
    p_error: null,
  })
  if (result.error) return json({ error: 'Webhook could not be committed; retry required' }, 503)
  if(isInbound&&!result.data?.duplicate)await recordInboundTiming(service,messageId,'WEBHOOK',requestStarted,ingestStarted,occurredAt)
  let inboundResult = result.data?.result
  // sent.DM retries are normally acknowledged as duplicates. If the first
  // attempt committed the inbound before the opt-in reservation completed,
  // recover that durable context so the retry can finish the consent handoff.
  if (isInbound && !inboundResult && result.data?.duplicate === true) {
    const saved = await service.from('lead_messages')
      .select('id,lead_id,customer_id,customers!inner(sms_double_opt_in_at,sms_opted_out_at)')
      .eq('provider', 'SENT_DM')
      .eq('provider_message_id', messageId)
      .maybeSingle()
    const customer = Array.isArray(saved.data?.customers) ? saved.data.customers[0] : saved.data?.customers
    if (saved.data && !customer?.sms_double_opt_in_at && !customer?.sms_opted_out_at) {
      inboundResult = {
        message_id: saved.data.id,
        lead_id: saved.data.lead_id,
        customer_id: saved.data.customer_id,
        needs_opt_in: true,
      }
    }
  }
  const jobId = typeof inboundResult?.job_id === 'string' ? inboundResult.job_id : null
  if (jobId) kickCommunications(url, key, { jobId })
  if(isInbound&&inboundResult?.needs_opt_in===true) {
    const templateId=Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID')
    const apiKey=Deno.env.get('SENT_DM_API_KEY')
    if(!templateId||!apiKey)return json({error:'Inbound was saved, but the approved opt-in template is not configured'},503)
    const reserved=await service.rpc('reserve_inbound_opt_in',{p_lead_id:inboundResult.lead_id,p_source_message_id:inboundResult.message_id,p_template_id:templateId})
    if(reserved.error)return json({error:'Inbound was saved, but the opt-in request could not be reserved'},503)
    if(reserved.data?.id)await dispatchSms(service,{apiKey,profileId:Deno.env.get('SENT_DM_PROFILE_ID')},reserved.data.id).catch(()=>undefined)
  }
  if(isInbound)console.info('sent.DM inbound timing',{
    messageId,jobId,
    provider_to_webhook_ms:Math.max(0,requestStarted-Date.parse(occurredAt)),
    verify_parse_ms:ingestStarted-requestStarted,
    ingest_ms:Date.now()-ingestStarted,
    webhook_total_ms:Date.now()-requestStarted,
  })
  return json(result.data)
})
