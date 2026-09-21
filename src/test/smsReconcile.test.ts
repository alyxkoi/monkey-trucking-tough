// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { reconcileSms, reconcileAcceptedSms } from '../../supabase/functions/_shared/sms-reconcile'

const providerId = '7e335b98-0651-4188-a31d-b18a31a11b63'
function fixture(status?:string) {
  const filters: Array<[string, unknown]> = []
  const audit = vi.fn(async () => ({ error: null }))
  const row = {
    select: () => row,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return row },
    single: async () => ({ data: { provider_message_id: providerId, customer_id: 'customer',delivery_status:status }, error: null }),
  }
  const service = {
    from: (table: string) => ['lead_messages','staff_sms_outbox'].includes(table) ? row : { insert: audit },
    rpc: vi.fn<(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown,error:null}>>(async () => ({ data: { delivery_status: 'FAILED' }, error: null })),
  }
  return { service, filters, audit }
}
const response = (overrides: Record<string, unknown> = {}) => new Response(JSON.stringify({ data: {
  id: providerId, direction: 'OUTBOUND', channel: 'sms', status: 'FAILED',
  events: [{ status: 'SENT', timestamp: '2026-09-13T20:18:46Z', description: 'Sent' },
    { status: 'FAILED', timestamp: '2026-09-13T20:18:48Z', description: 'Provider failure' }], ...overrides,
} }))

describe('operator SMS reconciliation', () => {
  it('reconciles internal receipts without creating a customer timeline or resending',async()=>{
    const {service,filters,audit}=fixture('QUEUED')
    service.rpc.mockImplementation(async(name:string)=>({data:name==='claim_sms_receipt_checks'?[{message_id:'staff-local',internal:true}]:{delivery_status:'DELIVERED'},error:null}))
    const fetcher=vi.fn<typeof fetch>(async()=>response({status:'DELIVERED'}))
    expect(await reconcileAcceptedSms(service,{apiKey:'fixture'},fetcher)).toEqual({checked:1,errors:[]})
    expect(filters).toEqual([['message_id','staff-local']])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({customer_id:null,entity_type:'SYSTEM',entity_id:null,event_type:'STAFF_SMS_RECONCILED'}))
    expect(service.rpc.mock.calls.map(call=>call[0])).toEqual(['claim_sms_receipt_checks','apply_sms_delivery_status'])
  })
  it('does not fill the timeline with unchanged background checks',async()=>{
    const {service,audit}=fixture('FAILED')
    await reconcileSms(service,{apiKey:'fixture'},'local','lead',async()=>response(),true)
    expect(audit).not.toHaveBeenCalled()
  })
  it('checks only claimed receipts and never submits messages',async()=>{
    const {service}=fixture()
    service.rpc.mockImplementation(async(name:string)=>({data:name==='claim_sms_receipt_checks'?[{message_id:'local',lead_id:'lead'}]:{delivery_status:'FAILED'},error:null}))
    const fetcher=vi.fn<typeof fetch>(async()=>response())
    expect(await reconcileAcceptedSms(service,{apiKey:'fixture'},fetcher)).toEqual({checked:1,errors:[]})
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toContain('/messages/')
    expect(service.rpc.mock.calls.map(call=>call[0])).toEqual(['claim_sms_receipt_checks','apply_sms_delivery_status'])
  })
  it('reports receipt lookup failures without breaking incoming-message processing',async()=>{
    const {service}=fixture()
    service.rpc.mockImplementation(async()=>({data:[{message_id:'local',lead_id:'lead'}],error:null}))
    expect(await reconcileAcceptedSms(service,{apiKey:'fixture'},async()=>new Response('{}',{status:503})))
      .toEqual({checked:1,errors:['Provider status lookup failed (503)']})
  })
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
