import type { LeadStatus } from './salesData'

export type LeadFilter = 'ALL' | LeadStatus

export const ACTIVE_LEAD_FILTERS: {value:LeadFilter;label:string}[]=[
  {value:'ALL',label:'All'},
  {value:'NEW',label:'New'},
  {value:'QUOTED',label:'Quoted'},
  {value:'WON',label:'Won'},
  {value:'LOST',label:'Lost'},
]

export function countLeadsForFilter(leads:{status:LeadStatus}[],value:LeadFilter){
  return value==='ALL'?leads.length:leads.filter((lead)=>lead.status===value).length
}
