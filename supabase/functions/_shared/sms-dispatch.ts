/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeSentDmStatus, sentDmIdempotencyKey } from './sent-dm-domain.ts'

export type SmsProviderConfig = { apiKey: string; profileId?: string }

/** The only place that submits SMS. Both immediate sends and cron use it. */
export async function dispatchSms(service: any, config: SmsProviderConfig, messageId?: string, fetcher: typeof fetch = fetch) {
  const started=Date.now()
  const timing:Record<string,number|string|null>={dispatch_started_at:new Date(started).toISOString()}
  const claim = await service.rpc('claim_sms', { p_message_id: messageId ?? null })
  if (claim.error) throw new Error('SMS queue could not be claimed')
  if (!claim.data) return { dispatched: false }
  const { message_id, lease_token } = claim.data
  const authorization = await service.rpc('authorize_sms_dispatch', { p_message_id: message_id, p_lease_token: lease_token })
  if (authorization.error) throw new Error('SMS dispatch authorization failed')
  if (!authorization.data) return { dispatched: false, cancelled: true }
  const reservation = authorization.data
  timing.dispatch_authorization_ms=Date.now()-started
  try {
    const headers: Record<string, string> = {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': sentDmIdempotencyKey(message_id),
    }
    if (config.profileId) headers['x-profile-id'] = config.profileId
    const providerStarted=Date.now()
    const response = await fetcher('https://api.sent.dm/v3/messages', {
      method: 'POST', headers, body: JSON.stringify(reservation.payload),
      signal: AbortSignal.timeout(20_000),
    })
    const body = await response.json().catch(() => null)
    timing.provider_submit_ms=Date.now()-providerStarted
    timing.provider_response_at=new Date().toISOString()
    if (!response.ok) {
      const retryable = [408, 409, 429].includes(response.status) || response.status >= 500
      const failed = await service.rpc('fail_sms_dispatch', {
        p_message_id: message_id, p_lease_token: lease_token, p_retryable: retryable,
        p_error: `sent.DM HTTP ${response.status}. ${retryable ? 'Submission unconfirmed; same operation will be reconciled.' : 'Request rejected; no automatic resend.'}`,
      })
      if (failed.error) throw new Error('Dispatch result could not be recorded')
      return { dispatched: true, accepted: false, retryable, timing }
    }
    const recipient = body?.data?.recipients?.[0]
    if (typeof recipient?.message_id !== 'string' || !recipient.message_id) throw new Error('Provider acceptance did not include a message ID')
    const status = normalizeSentDmStatus(recipient.status ?? body?.data?.status)
    const commitStarted=Date.now()
    const completed = await service.rpc('complete_sms_dispatch', {
      p_message_id: message_id, p_lease_token: lease_token, p_provider_message_id: recipient.message_id,
      p_status: status && status !== 'RECEIVED' ? status : 'QUEUED',
    })
    if (completed.error) throw new Error('Provider acceptance could not be linked')
    timing.dispatch_commit_ms=Date.now()-commitStarted
    timing.dispatch_total_ms=Date.now()-started
    return { dispatched: true, accepted: true, status: completed.data?.delivery_status ?? 'QUEUED', timing }
  } catch {
    // Timeout, malformed success and database-link failure are ALL ambiguous.
    const failed = await service.rpc('fail_sms_dispatch', {
      p_message_id: message_id, p_lease_token: lease_token, p_retryable: true,
      p_error: 'Provider submission is unconfirmed. Reconcile using the same immutable operation.',
    })
    if (failed.error) throw new Error('Unconfirmed SMS remains leased for reconciliation')
    timing.dispatch_total_ms=Date.now()-started
    return { dispatched: true, accepted: false, retryable: true, timing }
  }
}
