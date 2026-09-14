// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  complianceKeyword,
  isTerminalFailure,
  normalizeSentDmStatus,
  normalizeUsE164,
  sentDmEventKey,
  sentDmIdempotencyKey,
} from '../../supabase/functions/_shared/sent-dm-domain'

const root = resolve(process.cwd())
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('sent.DM SMS domain', () => {
  it('normalizes only supported US numbers to E.164', () => {
    expect(normalizeUsE164('(945) 375-0877')).toBe('+19453750877')
    expect(normalizeUsE164('+1 945 375 0877')).toBe('+19453750877')
    expect(normalizeUsE164('555')).toBeNull()
  })

  it('classifies all protected compliance keywords exactly and case-insensitively', () => {
    for (const keyword of ['STOP', 'cancel', 'Unsubscribe', 'quit', 'end']) expect(complianceKeyword(keyword)).toBe('STOP')
    for (const keyword of ['START', 'unstop', 'Subscribe']) expect(complianceKeyword(keyword)).toBe('START')
    for (const keyword of ['HELP', 'info']) expect(complianceKeyword(keyword)).toBe('HELP')
    expect(complianceKeyword('please stop by tomorrow')).toBeNull()
  })

  it('preserves sent.DM status and idempotency identities', () => {
    expect(normalizeSentDmStatus('delivered')).toBe('DELIVERED')
    expect(normalizeSentDmStatus('filtered')).toBe('FILTERED')
    expect(normalizeSentDmStatus('unknown')).toBeNull()
    expect(sentDmEventKey('provider-1', 'DELIVERED')).toBe('provider-1:DELIVERED')
    expect(sentDmIdempotencyKey('5ba79d03-12f5-4c1a-8a16-e091708196a1')).toBe('sms_5ba79d03_12f5_4c1a_8a16_e091708196a1')
    expect(isTerminalFailure('BLOCKED')).toBe(true)
    expect(isTerminalFailure('SENT')).toBe(false)
  })
})

describe('sent.DM transport contracts', () => {
  it('keeps the approved number recorded but readiness gated', () => {
    const migration = source('supabase/migrations/20260913090000_sent_dm_sms_transport.sql')
    expect(migration).toContain("business_number = '+19453750877'")
    expect(migration).toContain("sms_status = 'SETUP_REQUIRED'")
    expect(migration).toContain("calling_status = 'SETUP_REQUIRED'")
    expect(migration).toContain('sms_double_opt_in_at timestamptz')
    expect(migration).toContain('create table if not exists public.sms_consent_events')
    expect(migration).toContain("event_type in ('OPT_IN','OPT_OUT','HELP')")
    expect(migration).toContain('lead_messages_provider_message_unique')
    expect(migration).toContain('lead_messages_idempotency_unique')
    expect(migration).toContain('Recheck after the per-lead lock')
    expect(migration).toContain('drop policy if exists control_center_insert on public.lead_messages')
    expect(migration).toContain('revoke insert, update, delete on public.lead_messages from authenticated, anon')
    expect(migration).toContain('resolve_inbound_sms_conversation')
    expect(migration).toContain('record_inbound_sms')
    expect(migration).toContain('apply_sms_delivery_status')
  })

  it('sends from a server function with staff auth, SMS pinning, and provider idempotency', () => {
    const sender = source('supabase/functions/send-sms/index.ts') + source('supabase/functions/_shared/staff-auth.ts') + source('supabase/functions/_shared/sms-dispatch.ts')
    expect(sender).toContain("Deno.env.get('SENT_DM_API_KEY')")
    expect(sender).toContain("Deno.env.get('SENT_DM_PROFILE_ID')")
    expect(sender).toContain("Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID')")
    expect(sender).toContain(".in('role', ['admin', 'staff'])")
    expect(source('supabase/migrations/20260913170000_durable_sms_pipeline.sql')).toContain("'channel',jsonb_build_array('sms')")
    expect(sender).toContain("'Idempotency-Key': sentDmIdempotencyKey(message_id)")
    expect(sender.indexOf("service.rpc('enqueue_sms'")).toBeLessThan(sender.indexOf("await dispatchSms("))
    expect(sender).toContain('Please reply YES to confirm you want texts about your request and service.')
    expect(sender).not.toContain('texts from Monkey Trucking about your request and service.')
    expect(sender).not.toContain('Reply STOP to opt out or HELP for help.')
    expect(sender).not.toContain("sms_status: 'READY'")
  })

  it('verifies raw signed webhooks and commits events in a single transaction', () => {
    const webhook = source('supabase/functions/sent-dm-webhook/index.ts')
    const signature = source('supabase/functions/_shared/sms-signature.ts')
    const sql = source('supabase/migrations/20260913171000_sms_consent_and_inbox.sql')
    expect(webhook).toContain('const rawBody = await req.text()')
    expect(signature).toContain('X-Webhook-Signature')
    expect(signature).toContain("{ name: 'HMAC', hash: 'SHA-256' }")
    expect(webhook.indexOf('await verifySignature(')).toBeLessThan(webhook.indexOf("service.rpc('ingest_sms_event'"))
    expect(webhook).toContain("toLowerCase() !== 'sms'")
    expect(webhook).toContain("businessNumber !== '+19453750877'")
    expect(webhook).toContain("reason: timestampSkewSeconds === null || timestampSkewSeconds > 300 ? 'stale_timestamp' : 'invalid_signature'")
    expect(webhook).toContain("signatureVersion: req.headers.get('X-Webhook-Signature')?.split(',')[0] ?? null")
    expect(webhook).not.toContain('runtimeCredentialLength')
    expect(webhook).not.toContain('runtimeCredentialFingerprint')
    expect(webhook).not.toContain('alternativeSignatureMatches')
    const diagnostic = webhook.slice(
      webhook.indexOf("console.warn('sent.DM webhook rejected'"),
      webhook.indexOf("return json({ error: 'Invalid webhook signature'"),
    )
    expect(diagnostic).not.toContain('rawBody')
    expect(diagnostic).not.toContain('secret')
    expect(webhook).toContain("result.data?.result?.job_id")
    expect(webhook).toContain('kickCommunications(url, key, { jobId })')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain("then 'UNMATCHED' else 'PROCESSED'")
    expect(sql).toContain('public.record_inbound_sms(')
    expect(sql).toContain('public.apply_sms_delivery_status(')
  })

  it('targets immediate processing while keeping the minute worker as fallback', () => {
    const processor = source('supabase/functions/process-communications/index.ts')
    const worker = source('supabase/functions/_shared/communication-worker.ts')
    const kick = source('supabase/functions/_shared/communication-kick.ts')
    expect(processor).toContain('exactMessageId=messageId??job.messageId??null')
    expect(worker).toContain("service.rpc('claim_communication_job_by_id'")
    expect(kick).toContain('EdgeRuntime.waitUntil(task)')
    expect(kick).toContain('/functions/v1/process-communications')
  })

  it('routes dashboard replies through the provider instead of inserting fake pending messages', () => {
    const appState = source('src/control-center/approved/state/AppState.tsx')
    expect(appState).toContain('await sendLeadSms({ leadId: id, body: text, requestId })')
    expect(appState).toContain('smsRequestIdentity(id, text, smsRequestIds.current)')
    expect(appState).toContain('clearSmsRequestIdentity(requestKey, smsRequestIds.current)')
    expect(appState).not.toContain('await addLeadMessage(')
    expect(source('src/control-center/data.ts')).toContain('supabase.functions.invoke("send-sms"')
  })

  it('keeps automation sending blocked until double opt-in is confirmed', () => {
    const dryRun = source('src/control-center/ai/automationDryRun.ts')
    const ai = source('supabase/functions/_shared/ai-engine.ts')
    expect(dryRun).toContain('customer.sms_double_opt_in_at')
    expect(dryRun).toContain('Customer has not completed SMS double opt in.')
    expect(ai).toContain('Compliance keyword is handled by sent.DM and must not receive an AI reply.')
  })
})
