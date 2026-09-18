import { describe,it,expect,vi } from 'vitest'
import { recordInboundTiming } from '../../supabase/functions/_shared/inbound-timing'

describe('inbound acquisition diagnostics',()=>{
  it.each(['WEBHOOK','RECONCILIATION'] as const)('records %s without overwriting first acquisition',async source=>{
    const chain={eq:vi.fn(),is:vi.fn().mockResolvedValue({error:null})}
    chain.eq.mockReturnValue(chain)
    const update=vi.fn().mockReturnValue(chain)
    const service={from:vi.fn().mockReturnValue({update})}
    const start=Date.now()-100
    await recordInboundTiming(service,'provider-id',source,start,start+20,new Date(start-5000).toISOString())
    const timing=update.mock.calls[0][0].ingress_timings
    expect(timing.ingress_source).toBe(source)
    expect(timing.provider_to_ingress_ms).toBe(5000)
    expect(timing.provider_to_webhook_ms).toBe(source==='WEBHOOK'?5000:undefined)
    expect(timing.ingestion_ms).toBeGreaterThanOrEqual(80)
    expect(chain.is).toHaveBeenCalledWith('ingress_timings',null)
  })
  it('never converts telemetry failure into a failed or retried inbound',async()=>{
    const warning=vi.spyOn(console,'warn').mockImplementation(()=>{})
    await expect(recordInboundTiming({from:()=>{throw new Error('Unavailable')}},'id','WEBHOOK',Date.now(),Date.now(),new Date().toISOString())).resolves.toBeUndefined()
    expect(warning).toHaveBeenCalledOnce()
    warning.mockRestore()
  })
})
