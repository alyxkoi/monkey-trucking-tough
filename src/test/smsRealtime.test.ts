import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToCommunicationChanges } from '@/control-center/communicationRealtime'
const mocks=vi.hoisted(()=>({callbacks:[] as Array<()=>void>,remove:vi.fn(async()=>undefined),subscribe:vi.fn()}))
vi.mock('@/integrations/supabase/client',()=>({supabase:{
  channel:()=>{const channel={on:(_kind:string,_filter:unknown,callback:()=>void)=>{mocks.callbacks.push(callback);return channel},subscribe:mocks.subscribe};return channel},
  removeChannel:mocks.remove,
}}))
beforeEach(()=>{
  vi.useFakeTimers();mocks.callbacks.length=0;mocks.remove.mockClear();mocks.subscribe.mockClear()
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
  Object.defineProperty(navigator,'onLine',{configurable:true,value:true})
})
afterEach(()=>vi.useRealTimers())
describe('communications realtime lifecycle',()=>{
  it('coalesces bursts and cleans up the subscription and pending timer',async()=>{
    const refresh=vi.fn(async()=>undefined)
    const stop=subscribeToCommunicationChanges(refresh)
    mocks.callbacks.forEach(callback=>callback())
    await vi.advanceTimersByTimeAsync(300)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(mocks.subscribe).toHaveBeenCalledTimes(1)
    mocks.callbacks[0]()
    stop()
    await vi.advanceTimersByTimeAsync(300)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
  })
  it('performs a trailing refresh for an event during an in-flight refresh',async()=>{
    let finish!:()=>void
    const refresh=vi.fn().mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve})).mockResolvedValue(undefined)
    const stop=subscribeToCommunicationChanges(refresh)
    mocks.callbacks[0]()
    await vi.advanceTimersByTimeAsync(300)
    mocks.callbacks[0]()
    finish()
    await vi.advanceTimersByTimeAsync(300)
    expect(refresh).toHaveBeenCalledTimes(2)
    stop()
  })
})
