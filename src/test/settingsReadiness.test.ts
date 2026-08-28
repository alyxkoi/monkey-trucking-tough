import { describe, expect, it } from 'vitest'
import { createQaFixtureData } from '@/control-center/demo/qaFixtures'
import { deriveSettingsReadiness } from '@/control-center/readiness'

const fixture = () => createQaFixtureData(new Date('2026-08-27T12:00:00-05:00'))

describe('Settings readiness is derived from managed configuration', () => {
  it('separates real blockers from capabilities that are already ready', () => {
    const readiness = deriveSettingsReadiness(fixture())
    expect(readiness.categories.business.status).toBe('READY')
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

  it('never requires a custom-work tax decision', () => {
    const data = fixture()
    data.appSettings!.tax_enabled = false
    data.appSettings!.tax_rate = 0
    data.controlSettings!.custom_work_tax_rule = 'PENDING'
    const readiness = deriveSettingsReadiness(data)
    expect(readiness.categories.business.status).toBe('READY')
    expect(readiness.categories.business.reason).not.toMatch(/custom work tax/i)
    expect(readiness.blockers.some((blocker) => blocker.key === 'business')).toBe(false)
    data.appSettings!.tax_enabled = true
    data.appSettings!.tax_rate = 8.25
    expect(deriveSettingsReadiness(data).categories.business.status).toBe('READY')
  })

  it('detects catalog drift and optional integration errors without hiding them', () => {
    const data = fixture()
    data.materials[0] = { ...data.materials[0], full_load_price: 999 }
    data.aiIntegration = { status: 'ERROR', message: 'AI service failed its authenticated check.' }
    const readiness = deriveSettingsReadiness(data)
    expect(readiness.categories.materials.status).toBe('ERROR')
    expect(readiness.categories.materials.reason).toContain('20-yard full-load rate is $999; expected $350')
    expect(readiness.categories.materials.reason).not.toContain('Reconcile the 10 approved')
    expect(readiness.capabilities.ai).toMatchObject({ status: 'ERROR', reason: 'AI service failed its authenticated check.' })
    expect(readiness.categories.communication.status).toBe('ERROR')
  })

  it('does not mark an extra active test material as the approved ten-item catalog', () => {
    const data = fixture()
    data.materials.push({ ...data.materials[0], id: 'material-extra', name: 'Test Material' })
    expect(deriveSettingsReadiness(data).categories.materials.status).toBe('ERROR')
    expect(deriveSettingsReadiness(data).categories.materials.reason).toContain('Unexpected active material: Test Material')
  })

  it('ignores inactive test materials when the approved active catalog is correct', () => {
    const data = fixture()
    data.materials.push({ ...data.materials[0], id: 'material-inactive-test', name: 'Old Test Material', is_active: false })
    expect(deriveSettingsReadiness(data).categories.materials.status).toBe('READY')
  })

  it('uses enabled tax and processing-fee settings without requiring a fixed zero rate', () => {
    const data = fixture()
    data.appSettings!.tax_enabled = true
    data.appSettings!.tax_rate = 8.25
    data.controlSettings!.custom_work_tax_rule = 'TAXED'
    data.controlSettings!.processing_fee_enabled = true
    data.controlSettings!.processing_fee_rate = 3
    const readiness = deriveSettingsReadiness(data)
    expect(readiness.categories.business.status).toBe('READY')
    expect(readiness.categories.business.reason).toContain('Tax is 8.25%')
    expect(readiness.categories.business.reason).toContain('processing fee is 3%')
  })

  it('removes completed blockers when verified configuration changes', () => {
    const data = fixture()
    data.controlSettings = {
      ...data.controlSettings!,
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
