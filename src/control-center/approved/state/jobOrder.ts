import type { Job } from './jobsData'
import type { Quote } from './salesData'
import { deliveryFeePerLoad, type DeliverySelection } from './pricing'

/** The accepted quote is the order snapshot; never reprice from today's catalog. */
export function jobOrder(job:Job,quote?:Quote) {
  if(!quote||quote.id!==job.quoteId||quote.customerId!==job.customerId||quote.status!=='ACCEPTED')return null
  const fee=quote.snapshotTotals?.deliveryPerLoad
  const delivery:DeliverySelection=Number.isFinite(fee)&&fee!==deliveryFeePerLoad(quote.delivery)?{mode:'CUSTOM',customFee:fee,miles:quote.delivery.miles}:{...quote.delivery}
  return {materialLines:quote.materialLines.map(line=>({...line})),delivery,deliveryLoads:quote.deliveryLoads,
    customerId:job.customerId,jobId:job.id,address:job.address||quote.address,
    notes:[job.notes,quote.notes].filter((value,index,all)=>value&&all.indexOf(value)===index).join('\n')}
}
