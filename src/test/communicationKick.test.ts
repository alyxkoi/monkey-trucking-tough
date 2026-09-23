// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest'
import {kickCommunications} from '../../supabase/functions/_shared/communication-kick'
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
describe('non-blocking message coalescing',()=>{
 it('returns immediately and wakes a targeted reply worker after 3.1 seconds',async()=>{
  vi.useFakeTimers()
  const waitUntil=vi.fn(),fetcher=vi.fn().mockResolvedValue(new Response('{}'))
  vi.stubGlobal('EdgeRuntime',{waitUntil});vi.stubGlobal('fetch',fetcher)
  expect(kickCommunications('https://fixture.test','not-a-secret',{jobId:'latest-job'})).toBeUndefined()
  expect(waitUntil).toHaveBeenCalledOnce();expect(fetcher).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(3099);expect(fetcher).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1);expect(fetcher).toHaveBeenCalledOnce()
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({jobId:'latest-job'})
 })
 it('does not delay already-reserved outbound dispatch',async()=>{
  const waitUntil=vi.fn(),fetcher=vi.fn().mockResolvedValue(new Response('{}'))
  vi.stubGlobal('EdgeRuntime',{waitUntil});vi.stubGlobal('fetch',fetcher)
  kickCommunications('https://fixture.test','not-a-secret',{messageId:'reserved'})
  await waitUntil.mock.calls[0][0]
  expect(fetcher).toHaveBeenCalledOnce()
 })
})
