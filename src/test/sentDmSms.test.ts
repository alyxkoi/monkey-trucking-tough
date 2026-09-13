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
    const sender = source('supabase/functions/send-sms/index.ts')
    expect(sender).toContain("Deno.env.get('SENT_DM_API_KEY')")
    expect(sender).toContain("Deno.env.get('SENT_DM_PROFILE_ID')")
    expect(sender).toContain("Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID')")
    expect(sender).toContain(".in('role', ['admin', 'staff'])")
    expect(sender).toContain("channel: ['sms']")
    expect(sender).toContain(".eq('message_kind', 'INBOUND')")
    expect(sender).toContain("'Idempotency-Key': sentDmIdempotencyKey(reserved.id)")
    expect(sender.indexOf("service.rpc('reserve_manual_sms'")).toBeLessThan(sender.indexOf("fetch('https://api.sent.dm/v3/messages'"))
    expect(sender).not.toContain("sms_status: 'READY'")
  })

  it('verifies raw signed webhooks and deduplicates before changing records', () => {
    const webhook = source('supabase/functions/sent-dm-webhook/index.ts')
    expect(webhook).toContain('const rawBody = await req.text()')
    expect(webhook).toContain('X-Webhook-Signature')
    expect(webhook).toContain("{ name: 'HMAC', hash: 'SHA-256' }")
    expect(webhook).toContain('sentDmEventKey(messageId, status)')
    expect(webhook).toContain("processing_status: 'FAILED'")
    expect(webhook).toContain(".eq('processing_status', 'FAILED')")
    expect(webhook).toContain('eventKey && eventReserved')
    expect(webhook).toContain("toLowerCase() !== 'sms'")
    expect(webhook).toContain('eventNumber !== configuredNumber')
    expect(webhook).toContain("service.rpc('record_inbound_sms'")
    expect(webhook).toContain("service.rpc('apply_sms_delivery_status'")
    expect(source('supabase/migrations/20260913090000_sent_dm_sms_transport.sql')).toContain("sms_opt_out_source = 'SENT_DM_STOP'")
    expect(source('supabase/migrations/20260913090000_sent_dm_sms_transport.sql')).toContain("message_kind = 'INBOUND'")
    expect(source('supabase/migrations/20260913090000_sent_dm_sms_transport.sql')).toContain("'inserted', false")
  })

  it('routes dashboard replies through the provider instead of inserting fake pending messages', () => {
    const appState = source('src/control-center/approved/state/AppState.tsx')
    expect(appState).toContain('await sendLeadSms({ leadId: id, body: text, requestId })')
    expect(appState).toContain('smsRequestIds.current.get(requestKey)')
    expect(appState).toContain('smsRequestIds.current.delete(requestKey)')
    expect(appState).not.toContain('await addLeadMessage(')
    expect(source('src/control-center/data.ts')).toContain('supabase.functions.invoke("send-sms"')
  })

  it('keeps automation sending blocked until double opt-in is confirmed', () => {
    const dryRun = source('src/control-center/ai/automationDryRun.ts')
    const ai = source('supabase/functions/ai-draft/index.ts')
    expect(dryRun).toContain('customer.sms_double_opt_in_at')
    expect(dryRun).toContain('Customer has not completed SMS double opt in.')
    expect(ai).toContain('Compliance keyword is handled by sent.DM and must not receive an AI reply.')
  })
})
