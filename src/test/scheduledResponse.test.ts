import {describe,expect,it} from 'vitest'
import {scheduledResponse,type FollowupContext} from '../../supabase/functions/_shared/scheduled-response'
const base:FollowupContext={rule:'invoice-follow-up',step:0,spanish:false,timezone:'America/Chicago',
  invoice:{amount:'123.45',invoice_number:'1001',status:'SENT',due_at:'2026-09-15T15:00:00Z'}}
describe('contextual scheduled responses',()=>{
  it.each([0,1,2])('renders verified amount and local due date at step %s',step=>{
    const text=scheduledResponse({...base,step})
    expect(text).toContain('$123.45');expect(text).toContain('Sep 15, 2026');expect(text.length).toBeLessThan(420)
    expect(text).not.toMatch(/[—–]/)
  })
  it.each(['PAID','VOID','DRAFT'])('refuses invoice status %s',status=>{
    expect(()=>scheduledResponse({...base,invoice:{...base.invoice,status}})).toThrow()
  })
  it('localizes reminders and does not claim payment or schedule changes',()=>{
    expect(scheduledResponse({...base,spanish:true})).toContain('si ya pagó')
    expect(()=>scheduledResponse({...base,invoice:{...base.invoice,amount:'NaN'}})).toThrow()
  })
  it('uses real work type for neutral reviews and rejects missing links or incomplete work',()=>{
    const context={...base,rule:'review-request',invoice:{...base.invoice,status:'PAID'},job:{category:'DRIVEWAY',status:'COMPLETED'},reviewUrl:'https://example.com/review'}
    expect(scheduledResponse(context)).toContain('driveway project')
    expect(scheduledResponse(context)).not.toContain('happy')
    expect(()=>scheduledResponse({...context,reviewUrl:null})).toThrow()
    expect(()=>scheduledResponse({...context,job:{...context.job,status:'SCHEDULED'}})).toThrow()
  })
  it('has no active SMS reactivation response',()=>{
    expect(()=>scheduledResponse({...base,rule:'reactivation',spanish:true,invoice:{...base.invoice,status:'PAID'},job:{category:'MATERIAL_DELIVERY',status:'COMPLETED'}})).toThrow('No verified trigger')
  })
})
