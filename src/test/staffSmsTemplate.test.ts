// @vitest-environment node
import { describe,expect,it,vi } from 'vitest'
import { ensureStaffSmsTemplate,STAFF_TEMPLATE } from '../../supabase/functions/_shared/staff-sms-template'

function fixture(overrides={}) {
 const state={enabled:true,opted_out_at:null,staff_template_id:null,staff_template_ready:false,...overrides}
 const service={from:()=>({select:()=>({eq:()=>({single:async()=>({data:state})})}),update:(patch:object)=>({eq:async()=>{Object.assign(state,patch);return {error:null}}})})}
 return {state,service}
}
const accepted=()=>new Response(JSON.stringify({data:{id:'fixture-template',status:'APPROVED',is_published:true,channels:['sms']}}),{status:200})
describe('dedicated internal staff template',()=>{
 it('creates once with a stable operation key, confirms approval, and reuses setup',async()=>{
   const {state,service}=fixture(),fetcher=vi.fn().mockImplementation(accepted)
   await ensureStaffSmsTemplate(service,{apiKey:'test'},fetcher)
   expect(state.staff_template_ready).toBe(true)
   expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe('mt_internal_staff_alert_layout_v2')
   expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(STAFF_TEMPLATE)
   await ensureStaffSmsTemplate(service,{apiKey:'test'},fetcher)
   expect(fetcher).toHaveBeenCalledTimes(2)
 })
 it('does not mark a pending template ready or recreate it on retry',async()=>{
   const {state,service}=fixture(),fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{id:'pending'}}),{status:201}))
   fetcher.mockImplementationOnce(accepted).mockImplementation(()=>new Response(JSON.stringify({data:{status:'PENDING',is_published:false,channels:['sms']}})))
   await expect(ensureStaffSmsTemplate(service,{apiKey:'test'},fetcher)).rejects.toThrow(/status PENDING/)
   expect(state.staff_template_ready).toBe(false)
   await expect(ensureStaffSmsTemplate(service,{apiKey:'test'},fetcher)).rejects.toThrow(/status PENDING/)
   expect(fetcher.mock.calls.filter(call=>call[1].method==='POST')).toHaveLength(1)
 })
 it('never provisions for opted-out or disabled staff',async()=>{
   const fetcher=vi.fn()
   for(const override of [{enabled:false},{opted_out_at:'2026-09-23'}])await expect(ensureStaffSmsTemplate(fixture(override).service,{apiKey:'test'},fetcher)).rejects.toThrow(/disabled or opted out/)
   expect(fetcher).not.toHaveBeenCalled()
 })
 it('places line breaks in the template, never sample variable values',()=>{
   const content=STAFF_TEMPLATE.definition.body.multiChannel.template
   expect(content).toContain('\n')
   expect(content).not.toMatch(/\}\}\s+\{\{/)
   expect(content.replace(/\{\{.*?\}\}/g,'').trim().split(/\s+/).length).toBeGreaterThanOrEqual(9)
   for(const variable of STAFF_TEMPLATE.definition.body.multiChannel.variables)expect(variable.props.sample).not.toMatch(/[\n\r\t]| {5}/)
 })
})
