// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'
import { ACTIVE_LEAD_FILTERS,countLeadsForFilter } from '@/control-center/approved/state/leadWorkflow'
import { ACTIVE_LEAD_WORKFLOW,LEADS } from '@/control-center/approved/state/salesData'
import { deriveAttention } from '@/control-center/approved/state/attention'
import { createQaFixtureData } from '@/control-center/demo/qaFixtures'
import { mapLeads } from '@/control-center/approved/state/databaseMap'

const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8')

describe('simplified active lead workflow',()=>{
  it('exposes only New, Quoted, Won and Lost filters with correct counts',()=>{
    expect(ACTIVE_LEAD_WORKFLOW).toEqual(['NEW','QUOTED','WON','LOST'])
    expect(ACTIVE_LEAD_FILTERS.map((entry)=>entry.value)).toEqual(['ALL','NEW','QUOTED','WON','LOST'])
    const leads=ACTIVE_LEAD_WORKFLOW.map((status,index)=>({...LEADS[0],id:String(index),status}))
    expect(countLeadsForFilter(leads,'ALL')).toBe(4)
    expect(countLeadsForFilter(leads,'NEW')).toBe(1)
    expect(countLeadsForFilter(leads,'QUOTED')).toBe(1)
  })

  it('maps historical ACTIVE rows without exposing a conversation status',()=>{
    const data=createQaFixtureData(new Date('2026-09-16T12:00:00-05:00'))
    const historical=data.leads.filter((lead)=>lead.status==='ACTIVE')
    expect(historical.length).toBeGreaterThan(0)
    const mapped=mapLeads(data).filter((lead)=>historical.some((row)=>row.id===lead.id))
    expect(mapped.every((lead)=>lead.status==='NEW'||lead.status==='QUOTED')).toBe(true)
  })

  it('derives quiet follow-up from message activity while the lead remains New',()=>{
    const at=Date.now()
    const lead={...LEADS[0],status:'NEW' as const,lastActivityAt:at-3*24*60*60*1000,messages:[{id:'ai-reply',actor:'ai' as const,at:at-3*24*60*60*1000,text:'How many yards do you need?'}]}
    const items=deriveAttention({leads:[lead],quotes:[],jobs:[],invoices:[],customers:[{id:lead.customerId,name:'Customer',phone:'',source:'Other',notes:'',createdAt:at}],today:'2026-09-16',at})
    expect(items.map((item)=>item.id)).toContain(`leadfu:${lead.id}`)
    expect(items.map((item)=>item.id)).not.toContain(`newlead:${lead.id}`)
  })

  it('keeps automation eligibility and new server transitions independent of the retired status',()=>{
    expect(read('src/control-center/approved/components/automation/FollowUpState.tsx')).not.toMatch(/TALKING/)
    const migration=read('supabase/migrations/20260916190000_simplify_lead_status.sql')
    expect(migration).toContain("''NEW'',p_received_at")
    expect(migration).toContain("left(m.body,1000),''NEW''")
  })
})
