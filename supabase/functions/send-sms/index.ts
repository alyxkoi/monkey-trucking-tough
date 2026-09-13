/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  normalizeSentDmStatus,
  normalizeUsE164,
  sentDmIdempotencyKey,
} from '../_shared/sent-dm-domain.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

class ResponseError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function requireStaff(service: any, req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) throw new ResponseError(401, 'Sign in is required')
  const { data: authData, error: authError } = await service.auth.getUser(token)
  if (authError || !authData.user) throw new ResponseError(401, 'Your session is no longer valid')
  const { data: role } = await service.from('user_roles')
    .select('role').eq('user_id', authData.user.id).in('role', ['admin', 'staff']).maybeSingle()
  if (!role) throw new ResponseError(403, 'Admin or staff access is required')
  return authData.user
}

function requestId(value: unknown): string {
  if (typeof value === 'string' && UUID_PATTERN.test(value)) return value
  return crypto.randomUUID()
}

function providerError(body: any, status: number): string {
  const message = body?.error?.message ?? body?.message ?? body?.error
  return typeof message === 'string' && message.trim()
    ? message.trim().slice(0, 1000)
    : `sent.DM request failed (${status})`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const sentDmApiKey = Deno.env.get('SENT_DM_API_KEY')
  const sentDmProfileId = Deno.env.get('SENT_DM_PROFILE_ID')
  const firstContactTemplateId = Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID')
  if (!supabaseUrl || !serviceKey) return json({ error: 'SMS database access is not configured' }, 503)
  if (!sentDmApiKey) return json({ error: 'sent.DM API credentials are not configured' }, 503)

  const service = createClient(supabaseUrl, serviceKey)
  let reservedMessageId: string | null = null

  try {
    const actor = await requireStaff(service, req)
    const body = await req.json().catch(() => null)
    const leadId = typeof body?.leadId === 'string' ? body.leadId : ''
    const messageBody = typeof body?.body === 'string' ? body.body.trim() : ''
    if (!UUID_PATTERN.test(leadId)) throw new ResponseError(400, 'A valid lead is required')
    if (!messageBody || messageBody.length > 1600) throw new ResponseError(400, 'Enter a message between 1 and 1600 characters')

    const [{ data: settings, error: settingsError }, { data: lead, error: leadError }] = await Promise.all([
      service.from('control_center_settings').select('business_number,sms_status').eq('id', 1).single(),
      service.from('leads').select('id,customer_id').eq('id', leadId).single(),
    ])
    if (settingsError || !settings) throw new ResponseError(503, 'SMS settings could not be loaded')
    if (!['READY', 'TESTING'].includes(settings.sms_status)) throw new ResponseError(409, 'SMS is not ready for provider traffic')
    if (normalizeUsE164(settings.business_number) !== '+19453750877') {
      throw new ResponseError(503, 'The approved sent.DM business number is not configured')
    }
    if (leadError || !lead) throw new ResponseError(404, 'Lead not found')

    const [{ data: customer, error: customerError }, { data: inbound }] = await Promise.all([
      service.from('customers')
        .select('id,phone,sms_consent_at,sms_opted_out_at')
        .eq('id', lead.customer_id).single(),
      service.from('lead_messages').select('id')
        .eq('customer_id', lead.customer_id)
        .eq('sender_type', 'CUSTOMER')
        .eq('delivery_status', 'RECEIVED')
        .eq('message_kind', 'INBOUND')
        .limit(1),
    ])
    if (customerError || !customer) throw new ResponseError(404, 'Customer not found')
    if (customer.sms_opted_out_at) throw new ResponseError(409, 'Customer has opted out of SMS')
    const destination = normalizeUsE164(customer.phone)
    if (!destination) throw new ResponseError(422, 'Add a valid US mobile number before sending SMS')

    const hasInbound = Boolean(inbound?.length)
    if (!hasInbound && !customer.sms_consent_at) throw new ResponseError(409, 'Customer SMS consent is not recorded')
    if (!hasInbound && !firstContactTemplateId) {
      throw new ResponseError(503, 'The approved sent.DM first-contact template is not configured')
    }

    const messageKind = hasInbound ? 'FREEFORM' : 'TEMPLATE'
    const templateId = hasInbound ? null : firstContactTemplateId!
    const reservationKey = `manual_${requestId(body?.requestId).replaceAll('-', '_')}`
    const { data: reserved, error: reserveError } = await service.rpc('reserve_manual_sms', {
      p_lead_id: leadId,
      p_body: messageBody,
      p_idempotency_key: reservationKey,
      p_actor_id: actor.id,
      p_message_kind: messageKind,
      p_template_id: templateId,
    })
    if (reserveError || !reserved?.id) {
      const reason = reserveError?.message ?? 'SMS could not be reserved'
      throw new ResponseError(/opted out|consent|not ready/i.test(reason) ? 409 : 503, reason)
    }
    reservedMessageId = reserved.id
    if (reserved.provider_message_id) {
      return json({
        success: true,
        idempotent: true,
        messageId: reserved.id,
        providerMessageId: reserved.provider_message_id,
        status: reserved.delivery_status,
      })
    }

    const providerPayload = hasInbound
      ? { to: [destination], channel: ['sms'], text: messageBody }
      : {
          to: [destination],
          channel: ['sms'],
          template: { id: templateId, parameters: { message: messageBody } },
        }
    const headers: Record<string, string> = {
      'x-api-key': sentDmApiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': sentDmIdempotencyKey(reserved.id),
    }
    if (sentDmProfileId) headers['x-profile-id'] = sentDmProfileId

    const providerResponse = await fetch('https://api.sent.dm/v3/messages', {
      method: 'POST', headers, body: JSON.stringify(providerPayload),
    })
    const providerBody = await providerResponse.json().catch(() => ({}))
    if (!providerResponse.ok) {
      const reason = providerError(providerBody, providerResponse.status)
      await service.from('lead_messages').update({
        delivery_status: 'FAILED', provider_status: 'REQUEST_FAILED',
        send_error: reason, failed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', reserved.id).is('provider_message_id', null)
      throw new ResponseError(502, 'sent.DM rejected the SMS request. It is safe to retry.')
    }

    const recipient = providerBody?.data?.recipients?.[0]
    const providerMessageId = typeof recipient?.message_id === 'string' ? recipient.message_id : ''
    if (!providerMessageId) throw new ResponseError(502, 'sent.DM accepted the request without a message ID')
    const providerStatus = normalizeSentDmStatus(recipient?.status ?? providerBody?.data?.status) ?? 'QUEUED'
    const { error: finalizeError } = await service.from('lead_messages').update({
      provider_message_id: providerMessageId,
      provider_status: providerStatus,
      delivery_status: providerStatus,
      send_error: null,
      failed_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', reserved.id)
    if (finalizeError) {
      throw new ResponseError(500, 'sent.DM accepted the SMS, but its message ID could not be saved. Retry safely.')
    }

    return json({
      success: true,
      messageId: reserved.id,
      providerMessageId,
      status: providerStatus,
    })
  } catch (error) {
    if (error instanceof ResponseError) return json({ error: error.message, messageId: reservedMessageId }, error.status)
    console.error('send-sms failed', error)
    return json({ error: 'SMS could not be sent. It is safe to retry.', messageId: reservedMessageId }, 500)
  }
})
