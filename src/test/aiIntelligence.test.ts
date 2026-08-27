// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildAutomationPreviews } from '@/control-center/ai/automationDryRun'
import { evaluateConversation, validateCustomerDraft } from '@/control-center/ai/decision'
import { createQaFixtureData } from '@/control-center/demo/qaFixtures'
import { classifyAiIntegrationResults } from '@/control-center/data'

const reference = new Date('2026-08-26T12:00:00-05:00')
const customer = (body: string) => ({ sender_type: 'CUSTOMER' as const, body })
const human = (body: string) => ({ sender_type: 'HUMAN' as const, body })
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('Phase 06 OpenAI intelligence safety contracts', () => {
  it('extracts known material delivery facts and asks only for the missing address', () => {
    const data = createQaFixtureData(reference)
    const { decision, toolResults } = evaluateConversation({
      messages: [customer("hey i just called but you didn't pick up. how much for 40 yards of mason sand delivered to my home here in kaufman")],
      materials: data.materials,
      appSettings: data.appSettings,
    })
    expect(decision.known_facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'material', value: 'Mason Sand' }),
      expect.objectContaining({ key: 'quantity_yards', value: '40' }),
      expect.objectContaining({ key: 'delivery_requested', value: 'yes' }),
      expect.objectContaining({ key: 'city', value: 'Kaufman' }),
    ]))
    expect(decision.missing_facts).toEqual(['delivery address'])
    expect(decision.draft_reply).toMatch(/exact delivery address/i)
    expect(decision.draft_reply).not.toMatch(/how many|what material|what city/i)
    expect(toolResults.pricing).toMatchObject({ status: 'MATERIAL_CALCULATED', material_total: 1640 })
  })

  it('never invents a price when official pricing is unavailable', () => {
    const { decision, toolResults } = evaluateConversation({
      messages: [customer('how much for 40 yards of mason sand delivered in kaufman')],
      materials: [],
      appSettings: null,
    })
    expect(toolResults.pricing).toMatchObject({ status: 'UNAVAILABLE' })
    expect(decision.draft_reply).not.toMatch(/\$|1640|1,640/)
  })

  it('responds naturally in Spanish and Spanglish', () => {
    const spanish = evaluateConversation({ messages: [customer('hola, necesito dos cargas de base con entrega cerca de kaufman')] }).decision
    const spanglish = evaluateConversation({ messages: [customer('hey necesito 40 yards de mason sand para kaufman')] }).decision
    expect(spanish.detected_language).toBe('SPANISH')
    expect(spanish.draft_reply).toMatch(/dirección|comparte|claro/)
    expect(spanglish.detected_language).toBe('SPANGLISH')
    expect(spanglish.known_facts).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'quantity_yards', value: '40' })]))
  })

  it('escalates custom driveway pricing and negotiation without inventing a number', () => {
    const driveway = evaluateConversation({ messages: [customer('my driveway gets really muddy every time it rains, how much to fix the whole thing')] }).decision
    const negotiation = evaluateConversation({ messages: [customer('can you do it for 4200 if i pay today')] }).decision
    expect(driveway).toMatchObject({ requires_human: true, ai_may_continue: false, recommended_action: 'HOLD_FOR_SALVADOR' })
    expect(driveway.draft_reply).not.toContain('4200')
    expect(negotiation).toMatchObject({ requires_human: true, ai_may_continue: false })
  })

  it('does not ask for an address already supplied earlier', () => {
    const decision = evaluateConversation({
      messages: [customer('deliver it to 123 Oak Road'), human('got it'), customer('how much for 40 yards of mason sand')],
    }).decision
    expect(decision.known_facts).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'delivery_address' })]))
    expect(decision.missing_facts).not.toContain('delivery address')
  })

  it('treats a Zelle claim as unverified and requires a human', () => {
    const decision = evaluateConversation({ messages: [customer('i sent the zelle')] }).decision
    expect(decision).toMatchObject({ payment_claim_detected: true, requires_human: true, recommended_action: 'VERIFY_PAYMENT' })
    expect(decision.draft_reply).toMatch(/verify|salvador/)
  })

  it('stops conversational AI during human takeover', () => {
    const decision = evaluateConversation({ messages: [customer('can you help me'), human('i have this one')], humanTakeover: true }).decision
    expect(decision.ai_may_continue).toBe(false)
    expect(decision.draft_reply).toBe('')
    expect(decision.recommended_action).toBe('MANUAL_REPLY')
  })

  it('builds all seven dry runs and preserves spouse context', () => {
    const previews = buildAutomationPreviews(createQaFixtureData(reference), reference.getTime())
    expect(previews.map((item) => item.ruleId)).toEqual([
      'new-lead', 'missed-call', 'quote-follow-up', 'job-reminder',
      'invoice-follow-up', 'review-request', 'reactivation',
    ])
    expect(previews.find((item) => item.ruleId === 'quote-follow-up')?.draft).toMatch(/wife/i)
    expect(previews.every((item) => item.transport === 'SETUP_REQUIRED')).toBe(true)
  })

  it('enforces draft-only server and database boundaries', () => {
    const edge = read('supabase/functions/ai-draft/index.ts')
    const migration = read('supabase/migrations/20260827143000_phase06_ai_draft_dry_run.sql')
    expect(edge).toContain("send_allowed: false")
    expect(edge).toContain("store: false")
    expect(edge).not.toContain("from('lead_messages').insert")
    expect(edge).not.toContain("from('payments').insert")
    expect(migration).toContain("status in ('DRAFT','DISCARDED')")
    expect(migration).not.toMatch(/update\s+public\.(tickets|ticket_items|app_settings)/i)
  })

  it('isolates missing AI schema from the strict Control Center boot path', () => {
    const missing = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.ai_drafts' in the schema cache" } }
    const result = classifyAiIntegrationResults({
      conversationStates: missing,
      auditLogs: missing,
      drafts: missing,
    })
    expect(result.integration.status).toBe('SETUP_REQUIRED')
    expect(result.conversationStates).toEqual([])
    expect(result.auditLogs).toEqual([])
    expect(result.drafts).toEqual([])

    const loader = read('src/control-center/data.ts')
    expect(loader).toContain('const optionalAiPromise = loadOptionalAiData()')
    expect(loader).not.toContain('unwrap(aiConversationStates')
    expect(loader).not.toContain('unwrap(aiAuditLogs')
    expect(loader).not.toContain('unwrap(aiDrafts')
  })

  it('surfaces non-schema AI errors without converting them into setup state', () => {
    const denied = { data: null, error: { code: '42501', message: 'permission denied' } }
    const result = classifyAiIntegrationResults({ conversationStates: denied, auditLogs: denied, drafts: denied })
    expect(result.integration.status).toBe('ERROR')
    expect(result.integration.message).toMatch(/permission denied/)
  })

  it('rejects unsafe customer draft output', () => {
    const decision = evaluateConversation({ messages: [customer('i need gravel delivered')] }).decision
    expect(validateCustomerDraft({ ...decision, draft_reply: 'Hello—there' })).toMatch(/dash/i)
    expect(validateCustomerDraft(decision)).toBeNull()
  })
})
