// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { reconcileSms } from '../../supabase/functions/_shared/sms-reconcile'

const providerId = '7e335b98-0651-4188-a31d-b18a31a11b63'
function fixture() {
  const filters: Array<[string, unknown]> = []
  const audit = vi.fn(async () => ({ error: null }))
  const row = {
    select: () => row,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return row },
    single: async () => ({ data: { provider_message_id: providerId, customer_id: 'customer' }, error: null }),
  }
  const service = {
    from: (table: string) => table === 'lead_messages' ? row : { insert: audit },
    rpc: vi.fn(async () => ({ data: { delivery_status: 'FAILED' }, error: null })),
  }
  return { service, filters, audit }
}
const response = (overrides: Record<string, unknown> = {}) => new Response(JSON.stringify({ data: {
  id: providerId, direction: 'OUTBOUND', channel: 'sms', status: 'FAILED',
  events: [{ status: 'SENT', timestamp: '2026-09-13T20:18:46Z', description: 'Sent' },
    { status: 'FAILED', timestamp: '2026-09-13T20:18:48Z', description: 'Provider failure' }], ...overrides,
} }))

describe('operator SMS reconciliation', () => {
  it('reads the linked provider ID and updates the same local message without sending again', async () => {
    const { service, filters, audit } = fixture()
    const fetcher = vi.fn(async () => response())
    expect(await reconcileSms(service, { apiKey: 'fixture-key' }, 'local-message', 'lead', fetcher))
      .toMatchObject({ success: true, messageId: 'local-message', status: 'FAILED' })
    expect(filters).toEqual([['id', 'local-message'], ['lead_id', 'lead'], ['provider', 'SENT_DM']])
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://api.sent.dm/v3/messages/${providerId}`,
      expect.objectContaining({ headers: { 'x-api-key': 'fixture-key' } }))
    expect(service.rpc).toHaveBeenCalledExactlyOnceWith('apply_sms_delivery_status', {
      p_provider_message_id: providerId, p_provider_status: 'FAILED', p_error_message: 'Provider failure',
    })
    expect(audit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ event_type: 'SMS_RECONCILED' }))
  })
  it.each([{ id: 'different' }, { direction: 'INBOUND' }, { channel: 'whatsapp' }, { status: 'RECEIVED' }])('rejects mismatched provider evidence before any write: %j', async (overrides) => {
      const { service, audit } = fixture()
      await expect(reconcileSms(service, { apiKey: 'fixture' }, 'local', 'lead', async () => response(overrides)))
        .rejects.toThrow('did not match')
      expect(service.rpc).not.toHaveBeenCalled()
      expect(audit).not.toHaveBeenCalled()
    })
  it('does not change local status when provider lookup fails', async () => {
    const { service, audit } = fixture()
    await expect(reconcileSms(service, { apiKey: 'fixture' }, 'local', 'lead', async () => new Response('{}', { status: 503 })))
      .rejects.toThrow('503')
    expect(service.rpc).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })
})
