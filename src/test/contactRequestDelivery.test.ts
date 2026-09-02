// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderRequestReceivedEmail } from '../../supabase/functions/_shared/request-received-email'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('website request confirmation safety', () => {
  it('renders the approved request-received template with escaped customer values', () => {
    const rendered = renderRequestReceivedEmail({
      customerName: '<Alicia & Family>',
      requestType: 'Material Delivery',
      serviceLocation: 'Kaufman, TX',
      submittedAt: 'Aug 30, 2026, 1:30 PM',
      privacyUrl: 'https://www.monkeytrucking.llc/privacy-policy',
      termsUrl: 'https://www.monkeytrucking.llc/terms',
    })
    expect(rendered.subject).toBe('Monkey Trucking received your request')
    expect(rendered.html).toContain('REQUEST RECEIVED')
    expect(rendered.html).toContain('sms:+12146778466')
    expect(rendered.html).toContain('&lt;Alicia &amp; Family&gt;')
    expect(rendered.html).not.toMatch(/{{[A-Z_]+}}/)
  })

  it('stores first, queues both emails idempotently, and does not fail the stored request on email trouble', () => {
    const edge = read('supabase/functions/send-contact-email/index.ts')
    const worker = read('supabase/functions/process-email-queue/index.ts')
    expect(edge).toContain(".rpc('create_website_contact_submission'")
    expect(edge).toContain('contact-form:${submissionId}')
    expect(edge).toContain('request-received:${submissionId}')
    expect(edge).toContain('idempotency_key: input.idempotencyKey')
    expect(edge).toContain('emailWarnings.push')
    expect(edge).toContain('JSON.stringify({ success: true, submissionId')
    expect(worker).toContain(".eq('idempotency_key', payload.idempotency_key)")
    expect(worker).toContain("status: 'sent'")
  })

  it('accepts phone-first campaign leads without requiring an email address', () => {
    const edge = read('supabase/functions/send-contact-email/index.ts')
    expect(edge).toContain('if (!name || !phone)')
    expect(edge).not.toContain('if (!name || !phone || !email)')
    expect(edge).toContain("email: email?.trim() || ''")
    expect(edge).toContain('replyTo: email?.trim() || REPLY_TO')
    expect(edge).toContain("if (email?.trim())")
  })

  it('locks request identity before the lead-producing insert and never rewrites existing contacts', () => {
    const migration = read('supabase/migrations/20260830130000_public_request_confirmation_and_customer_contact.sql')
    const lock = migration.indexOf("pg_advisory_xact_lock(hashtextextended('website-contact:'")
    const insert = migration.indexOf('insert into public.contact_submissions')
    expect(lock).toBeGreaterThan(-1)
    expect(insert).toBeGreaterThan(lock)
    expect(migration).toContain("'created', false")
    expect(migration).not.toMatch(/update\s+public\.contact_submissions/i)
    expect(migration).toContain("'rate_limited'")
  })

  it('protects customer identity from duplicate phone and email updates', () => {
    const migration = read('supabase/migrations/20260830130000_public_request_confirmation_and_customer_contact.sql')
    const screen = read('src/control-center/approved/screens/CustomerDetail.tsx')
    const data = read('src/control-center/data.ts')
    expect(migration).toContain("'status', 'DUPLICATE', 'field', 'PHONE'")
    expect(migration).toContain("'status', 'DUPLICATE', 'field', 'EMAIL'")
    expect(migration).toContain("'CONTACT_UPDATED'")
    expect(migration).toContain('if v_phone is null and v_email is null')
    expect(screen).toContain('Edit Contact')
    expect(screen).toContain('No records were changed.')
    expect(data).toContain('"update_customer_contact"')
  })
})
