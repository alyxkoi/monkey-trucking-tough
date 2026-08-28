import { describe, expect, it } from 'vitest'
import { createQaFixtureData } from '@/control-center/demo/qaFixtures'
import { deriveSettingsReadiness } from '@/control-center/readiness'

const fixture = () => createQaFixtureData(new Date('2026-08-27T12:00:00-05:00'))

describe('Settings readiness is derived from managed configuration', () => {
  it('separates real blockers from capabilities that are already ready', () => {
    const readiness = deriveSettingsReadiness(fixture())
    expect(readiness.categories.business.status).toBe('NEEDS_INFO')
    expect(readiness.categories.materials.status).toBe('READY')
    expect(readiness.categories.workers.status).toBe('READY')
    expect(readiness.categories.communication).toMatchObject({ status: 'WAITING', label: 'Waiting on number' })
    expect(readiness.categories.tracking.status).toBe('READY')
    expect(readiness.categories.users.status).toBe('READY')
    expect(readiness.categories.printing.status).toBe('READY')
    expect(readiness.capabilities.automations.label).toBe('Dry run ready')
    expect(readiness.capabilities.payments.status).toBe('TEST_REQUIRED')
  })

  it('lists exact missing business and crew data instead of a generic badge', () => {
    const data = fixture()
    data.appSettings!.company_phone = ''
    data.controlSettings!.company_email = null
    data.workers = []
    const readiness = deriveSettingsReadiness(data)
    expect(readiness.categories.business.reason).toContain('public business phone')
    expect(readiness.categories.business.reason).toContain('business email')
    expect(readiness.categories.workers.reason).toContain('real crew and pay information')
  })

  it('detects catalog drift and optional integration errors without hiding them', () => {
    const data = fixture()
    data.materials[0] = { ...data.materials[0], full_load_price: 999 }
    data.aiIntegration = { status: 'ERROR', message: 'AI service failed its authenticated check.' }
    const readiness = deriveSettingsReadiness(data)
    expect(readiness.categories.materials.status).toBe('ERROR')
    expect(readiness.capabilities.ai).toMatchObject({ status: 'ERROR', reason: 'AI service failed its authenticated check.' })
    expect(readiness.categories.communication.status).toBe('ERROR')
  })

  it('removes completed blockers when verified configuration changes', () => {
    const data = fixture()
    data.controlSettings = {
      ...data.controlSettings!,
      custom_work_tax_rule: 'EXEMPT',
      business_number: '+19725550100',
      sms_status: 'READY',
      calling_status: 'READY',
      ai_status: 'READY',
      email_status: 'READY',
      payment_processor_status: 'READY',
    }
    const readiness = deriveSettingsReadiness(data)
    expect(readiness.categories.business.status).toBe('READY')
    expect(readiness.categories.communication.status).toBe('READY')
    expect(readiness.capabilities.payments.status).toBe('READY')
    expect(readiness.blockers).toHaveLength(0)
  })
})
