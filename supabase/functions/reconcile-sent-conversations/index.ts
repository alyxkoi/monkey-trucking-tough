import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { kickCommunications } from '../_shared/communication-kick.ts'
import { sentDmInboundMessages } from '../_shared/sent-dm-conversations.ts'
import { complianceKeyword } from '../_shared/sent-dm-domain.ts'
import { workerAuthorized } from '../_shared/worker-auth.ts'

const BUSINESS_NUMBER = '+19453750877'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiKey = Deno.env.get('SENT_DM_API_KEY')
  const workerSecret = Deno.env.get('COMMUNICATIONS_WORKER_SECRET')
  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!url || !key || !apiKey || !token) return json({ error: 'Unauthorized' }, 401)

  const service = createClient(url, key)
  if (!await workerAuthorized(service, token, key, workerSecret)) return json({ error: 'Unauthorized' }, 401)

  const claim = await service.rpc('claim_sent_dm_reconciliation')
  if (claim.error) return json({ error: 'Reconciliation lease unavailable' }, 503)
  const leaseToken = typeof claim.data === 'string' ? claim.data : null
  if (!leaseToken) return json({ skipped: true, reason: 'already_running' })

  let failure: string | null = null
  try {
    const headers: Record<string, string> = { 'x-api-key': apiKey, Accept: 'application/json' }
    const profileId = Deno.env.get('SENT_DM_PROFILE_ID')
    if (profileId) headers['x-profile-id'] = profileId
    const response = await fetch('https://api.sent.dm/v3/conversations?page=1&page_size=100', {
      method: 'GET', headers, signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`sent.DM conversation reconciliation returned HTTP ${response.status}`)
    const messages = sentDmInboundMessages(await response.json())
    if (messages.length === 0) return json({ inspected: 0, ingested: 0, queued: 0 })

    const ids = messages.map((message) => message.messageId)
    const existing = await service
      .from('lead_messages')
      .select('provider_message_id')
      .eq('provider', 'SENT_DM')
      .in('provider_message_id', ids)
    if (existing.error) throw new Error('Existing provider messages could not be reconciled')
    const known = new Set((existing.data ?? []).map((row) => row.provider_message_id))

    let ingested = 0
    let queued = 0
    for (const message of messages) {
      if (known.has(message.messageId)) continue
      const result = await service.rpc('ingest_sms_event', {
        p_message_id: message.messageId,
        p_event_type: 'message.received',
        p_status: 'RECEIVED',
        p_inbound: true,
        p_business_number: BUSINESS_NUMBER,
        p_phone: message.phone,
        p_body: message.body,
        p_keyword: complianceKeyword(message.body),
        p_occurred_at: message.occurredAt,
        p_error: null,
      })
      if (result.error) throw new Error('A provider message could not be committed')
      ingested++
      const jobId = typeof result.data?.result?.job_id === 'string' ? result.data.result.job_id : null
      if (jobId) {
        queued++
        kickCommunications(url, key, { jobId })
      }
    }
    return json({ inspected: messages.length, ingested, queued })
  } catch (error) {
    failure = error instanceof Error ? error.message.slice(0, 500) : 'Conversation reconciliation failed'
    return json({ error: failure }, 503)
  } finally {
    const released = await service.rpc('finish_sent_dm_reconciliation', {
      p_lease_token: leaseToken,
      p_error: failure,
    })
    if (released.error) console.error('sent.DM reconciliation lease could not be released')
  }
})
