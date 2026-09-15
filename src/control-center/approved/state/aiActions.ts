import type { Activity } from '@/control-center/data'
export const AI_ACTION_LABELS: Record<string,string> = {
  QUOTE_READY:'Quote ready to send',CUSTOM_WORK:'Custom work needs pricing',HUMAN_REQUEST:'Customer requested Salvador',
  SCHEDULE_CHANGE:'Schedule change requested',ORDER_CHANGE:'Order change needs review',ADDRESS_CHANGE:'Address change affects delivery',
  PAYMENT_CLAIM:'Customer says they paid',COMPLAINT:'Customer complaint',NEW_WORK:'Returning customer wants new work',CONTACT_REVIEW:'Contact information needs review',
}
export function aiActionDetails(entry:Activity) {
  const m=entry.metadata&&typeof entry.metadata==='object'&&!Array.isArray(entry.metadata)?entry.metadata:{}
  const text=(key:string)=>typeof m[key]==='string'?m[key] as string:''
  const kind=text('kind'),quoteId=text('quote_id'),jobId=text('job_id'),invoiceId=text('invoice_id')
  return {kind,title:AI_ACTION_LABELS[kind]??'Customer request needs review',
    context:[text('request'),text('email'),text('date'),text('time'),text('requested_date'),text('requested_time')].filter(Boolean).join(' · '),
    to:kind==='QUOTE_READY'&&quoteId?`/admin/quotes/${quoteId}`:invoiceId&&kind==='PAYMENT_CLAIM'?`/admin/money/invoices/${invoiceId}`:jobId&&kind==='SCHEDULE_CHANGE'?`/admin/jobs/${jobId}`:`/admin/leads/${entry.entity_id}`,
    label:kind==='QUOTE_READY'?'Review & Send':'Review request'}
}
