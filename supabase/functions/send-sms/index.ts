import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { dispatchSms } from '../_shared/sms-dispatch.ts'
import { reconcileSms } from '../_shared/sms-reconcile.ts'
import { HttpError, requireStaff, UUID_PATTERN } from '../_shared/staff-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'SMS database access is not configured' }, 503)
  const service = createClient(url, key)
  try {
    const actor = await requireStaff(service, req)
    const input = await req.json().catch(() => null)
    if (input?.action === 'staff-test') {
      if (!UUID_PATTERN.test(input?.requestId ?? '')) throw new HttpError(400,'Stable request ID required')
      const apiKey=Deno.env.get('SENT_DM_API_KEY')
      if (!apiKey) throw new HttpError(503,'SMS provider credentials missing')
      const queued=await service.rpc('queue_staff_sms_test',{p_request_id:input.requestId,p_actor_id:actor.id})
      if(queued.error) throw new HttpError(409,queued.error.message)
      await dispatchSms(service,{apiKey,profileId:Deno.env.get('SENT_DM_PROFILE_ID'),internal:true,templateId:Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID')},queued.data)
      const status=await service.from('staff_sms_outbox').select('message_id,state,delivery_status,last_error').eq('message_id',queued.data).single()
      if(status.error)throw new HttpError(503,'Reserved. Retry with the same request ID.')
      return json(status.data)
    }
    if (!UUID_PATTERN.test(input?.leadId ?? '')) throw new HttpError(400, 'A valid lead is required')
    if (input?.action === 'reconcile') {
      if (!UUID_PATTERN.test(input?.messageId ?? '')) throw new HttpError(400,'A valid message is required')
      const apiKey=Deno.env.get('SENT_DM_API_KEY')
      if (!apiKey) throw new HttpError(503,'sent.DM credentials are missing')
      return json(await reconcileSms(service,{apiKey,profileId:Deno.env.get('SENT_DM_PROFILE_ID')},input.messageId,input.leadId))
    }
    if (input?.action === 'resume-ai') {
      const result = await service.rpc('resume_conversation_ai', { p_lead_id: input.leadId, p_actor_id: actor.id })
      if (result.error) throw new HttpError(409, 'AI could not be resumed')
      return json({ success: true, resumed: true })
    }
    if (!UUID_PATTERN.test(input?.requestId ?? '')) throw new HttpError(400, 'A stable request ID is required')
    const optIn = input?.action === 'request-opt-in'
    const text = optIn
      ? 'Please reply YES to confirm you want texts about your request and service. Message frequency varies. Message and data rates may apply. Reply HELP for help.'
      : typeof input?.body === 'string' ? input.body.trim() : ''
    if (!text || text.length > 1600) throw new HttpError(400, 'Enter a message between 1 and 1600 characters')
    const apiKey = Deno.env.get('SENT_DM_API_KEY')
    if (!apiKey) throw new HttpError(503, 'sent.DM API credentials are not configured')
    const reservation = await service.rpc('enqueue_sms', {
      p_lead_id: input.leadId, p_body: text, p_operation_key: `manual_${input.requestId.replaceAll('-', '_')}`,
      p_origin: optIn ? 'OPT_IN' : 'HUMAN', p_actor_id: actor.id,
      p_template_id: Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID') ?? null,
    })
    if (reservation.error || !reservation.data?.id) throw new HttpError(409, reservation.error?.message ?? 'SMS could not be reserved')
    const messageId = reservation.data.id
    await dispatchSms(service, { apiKey, profileId: Deno.env.get('SENT_DM_PROFILE_ID') }, messageId).catch(() => undefined)
    const result = await service.from('lead_messages').select('id,provider_message_id,delivery_status,provider_status,send_error').eq('id', messageId).single()
    const outbox = await service.from('sms_outbox').select('state').eq('message_id', messageId).single()
    if (result.error || outbox.error) throw new HttpError(503, 'SMS is reserved. Retry with the same request ID to check its status.')
    return json({ success: true, messageId, providerMessageId: result.data.provider_message_id,
      status: result.data.delivery_status, queueState: outbox.data.state, error: result.data.send_error })
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    return json({ error: 'SMS request could not be completed. Keep the same request ID when retrying.' }, 500)
  }
})
