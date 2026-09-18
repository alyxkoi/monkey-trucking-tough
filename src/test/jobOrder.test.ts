import {describe,it,expect} from 'vitest'
import {jobOrder} from '@/control-center/approved/state/jobOrder'
import type {Job} from '@/control-center/approved/state/jobsData'
import type {Quote} from '@/control-center/approved/state/salesData'
const job={id:'job',customerId:'customer',quoteId:'quote',address:'456 Updated Road',notes:'Use the side gate'} as Job
const line={id:'item',materialId:'flex',materialName:'Flexbase First Class 1" or 3"',yards:25,loads:null,isFullLoad:false,rateUsed:38,lineTotal:950}
const quote={id:'quote',customerId:'customer',status:'ACCEPTED',address:'123 Old Road',materialLines:[line],delivery:{mode:'OVER_10',miles:15},deliveryLoads:2} as Quote
describe('accepted quote → job → ticket source of truth',()=>{
 it('carries exact material, yards, delivery, customer/job and current job address',()=>{
   expect(jobOrder(job,quote)).toMatchObject({materialLines:[line],customerId:'customer',jobId:'job',address:'456 Updated Road',delivery:{mode:'OVER_10',miles:15},deliveryLoads:2,notes:'Use the side gate'})
 })
 it('carries multiple material lines and loads without collapsing them',()=>{
   const second={...line,id:'second',materialName:'Sand',yards:40,loads:2,isFullLoad:true}
   expect(jobOrder(job,{...quote,materialLines:[line,second],deliveryLoads:4})?.materialLines).toEqual([line,second])
 })
 it('keeps editable copies without changing accepted or historical data',()=>{
   const before=structuredClone(quote),prefill=jobOrder(job,quote)!
   prefill.materialLines[0].yards=30;prefill.delivery.miles=18;prefill.address='789 New Road'
   expect(quote).toEqual(before);expect(job.address).toBe('456 Updated Road')
 })
 it('never pulls an unrelated or unaccepted quote into a job',()=>{
   expect(jobOrder(job,{...quote,status:'DRAFT'})).toBeNull()
   expect(jobOrder(job,{...quote,customerId:'other'})).toBeNull()
   expect(jobOrder(job,{...quote,id:'other'})).toBeNull()
   expect(jobOrder(job)).toBeNull()
 })
 it('preserves an accepted delivery fee when current settings differ',()=>{
   expect(jobOrder(job,{...quote,snapshotTotals:{deliveryPerLoad:125} as Quote['snapshotTotals']})?.delivery).toMatchObject({mode:'CUSTOM',customFee:125,miles:15})
 })
})
