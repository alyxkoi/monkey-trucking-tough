// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('customer communications launch contracts', () => {
  it('records the expanded website SMS disclosure without backfilling old consent', () => {
    const migration = read('supabase/migrations/20260915020000_website_promotional_sms_consent.sql')
    expect(migration).toContain('sms_marketing_consent boolean not null default false')
    expect(migration).toContain('email_marketing_consent boolean not null default false')
    expect(migration).toContain('contact_submissions_sms_marketing_consent_at_check')
    expect(migration).toContain('sms_marketing_consent_at = case')
    expect(migration).toContain("when new.sms_marketing_consent then coalesce(sms_marketing_consent_at")
    expect(migration).toContain("when new.email_marketing_consent then coalesce(email_marketing_consent_at")
    expect(migration).toContain('Existing customer-care submissions are intentionally not backfilled.')
    expect(migration).not.toMatch(/update\s+public\.customers\s+c[\s\S]*from\s*\([\s\S]*contact_submissions/i)
  })

  it('keeps quotes yard-first and ton conversion deterministic', () => {
    const engine = read('supabase/functions/_shared/ai-engine.ts')
    const material = read('supabase/functions/_shared/material-intelligence.ts')
    expect(engine).toContain('Speak, clarify, quote, and confirm material quantities in yards by default.')
    expect(engine).toContain('ask how many yards the customer needs')
    expect(engine).toContain('continue the order in yards after the customer accepts it')
    expect(material).toContain('const COVERAGE_BUFFER_YARDS = 1')
    expect(material).toContain('roundUpToWholeYard(rawYards + COVERAGE_BUFFER_YARDS)')
  })

  it('activates only covered transactional rules from a fresh timestamp', () => {
    const activation = read('supabase/activate_transactional_communications.sql')
    expect(activation).toContain("v_sms_status is distinct from 'READY'")
    expect(activation).toContain("'19453750877'")
    expect(activation).toContain("jobname=''process-communications-minute'' and active")
    expect(activation).toContain('activated_at=clock_timestamp()')
    expect(activation).toContain('marketing_approved=false')
    expect(activation).toContain("id in ('new-lead','quote-follow-up','human-takeover','job-reminder') then 'ON'")
    expect(activation).toContain("id in ('missed-call','invoice-follow-up','review-request','reactivation') then 'SETUP_REQUIRED'")
    expect(activation).toContain("raise exception 'Fresh activation unexpectedly found % due candidate(s)' ".trim())
  })

  it('has a recoverable scheduled-send pause that preserves evidence', () => {
    const pause = read('supabase/pause_transactional_communications.sql')
    expect(pause).toContain('scheduled_sending_enabled=false')
    expect(pause).toContain("kind='AUTOMATION'")
    expect(pause).toContain("o.origin='AUTOMATION'")
    expect(pause).not.toMatch(/delete\s+from/i)
    expect(pause).not.toContain('ai_sending_enabled=false')
  })

  it('never schedules a second immediate first reply', () => {
    const migration = read('supabase/migrations/20260915021000_transactional_followup_alignment.sql')
    expect(migration).toContain('generate_series(1,3) as x(step)')
    expect(migration).not.toContain('generate_series(0,3) as x(step)')
    expect(migration).toContain("message_kind='INBOUND')<=1")
  })
})
