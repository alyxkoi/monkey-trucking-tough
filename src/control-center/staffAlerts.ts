export const STAFF_ALERT_GROUPS = [
  {title:'Action required',items:[['QUOTE_READY','Quote ready for review'],['SALVADOR_NEEDED','Salvador needed'],['CUSTOM_WORK','Custom work needs pricing'],['SCHEDULE_CHANGE','Schedule change requested'],['ORDER_CHANGE','Order change requested'],['ADDRESS_CHANGE','Address/pricing change'],['PAYMENT_ISSUE','Payment issue'],['COMMUNICATION_FAILURE','Communication failure']]},
  {title:'Business updates',items:[['NEW_LEAD','New Lead'],['QUOTE_ACCEPTED','Quote accepted'],['PAYMENT_RECEIVED','Payment received'],['JOB_SCHEDULED','Job scheduled']]},
] as const
export type StaffAlertType=typeof STAFF_ALERT_GROUPS[number]['items'][number][0]
export const defaultStaffPreferences:Record<StaffAlertType,boolean>={QUOTE_READY:true,SALVADOR_NEEDED:true,CUSTOM_WORK:true,SCHEDULE_CHANGE:true,ORDER_CHANGE:true,ADDRESS_CHANGE:true,PAYMENT_ISSUE:true,COMMUNICATION_FAILURE:true,NEW_LEAD:true,QUOTE_ACCEPTED:true,PAYMENT_RECEIVED:false,JOB_SCHEDULED:false}
