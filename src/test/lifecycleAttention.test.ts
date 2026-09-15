import { describe,it,expect } from 'vitest'
import { deriveAttention } from '../control-center/approved/state/attention'
import { aiActionDetails } from '../control-center/approved/state/aiActions'
import type { Activity } from '../control-center/data'

const action:Activity={id:'request',customer_id:'customer',entity_type:'LEAD',entity_id:'lead',event_type:'AI_ACTION_OPEN',summary:'Ready',actor_id:null,actor_label:'AI',created_at:'2026-09-15T20:00:00Z',metadata:{kind:'QUOTE_READY',quote_id:'quote',email:'mike@example.test',date:'2026-09-17',time:'09:00'}}
const base={leads:[],quotes:[],jobs:[],invoices:[],customers:[],today:'2026-09-15'}
describe('existing Overview lifecycle integration',()=>{
 it('shows actionable quote readiness with confirmed details and manual send destination',()=>{
  const items=deriveAttention({...base,staffActions:[action]})
  expect(items).toHaveLength(1);expect(items[0]).toMatchObject({kind:'customer_waiting',priority:'TODAY',action:{label:'Review & Send',to:'/admin/quotes/quote'}})
  expect(items[0].context).toContain('mike@example.test')
 })
 it('removes handled events when refreshed server actions no longer include them',()=>{
  expect(deriveAttention({...base,staffActions:[]})).toHaveLength(0)
 })
 it('links scheduling and payment requests to the existing record screens',()=>{
  expect(aiActionDetails({...action,metadata:{kind:'SCHEDULE_CHANGE',job_id:'job'}}).to).toBe('/admin/jobs/job')
  expect(aiActionDetails({...action,metadata:{kind:'PAYMENT_CLAIM',invoice_id:'invoice'}}).to).toBe('/admin/money/invoices/invoice')
 })
})
