// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import {afterEach,describe,expect,it,vi} from 'vitest'
import {simulateConversation} from '../../supabase/functions/_shared/ai-sandbox'
import {resolveConversationQuantity} from '../../supabase/functions/_shared/material-intelligence'
import {lifecycleProposal} from '../../supabase/functions/_shared/lifecycle'

const materials=[{id:'clean',catalog_key:'mat-1',name:'Commercial Crushed Concrete Clean',price_per_yard:20,full_load_price:350,full_load_yards:20},
  {id:'large',catalog_key:'mat-3',name:'3x4 Crushed Concrete',price_per_yard:35,full_load_price:700,full_load_yards:20}]
const c=(body:string)=>({sender_type:'CUSTOMER',body}),a=(body:string)=>({sender_type:'AI',body})
const config={apiKey:'fixture',baseUrl:'https://example.test/v1',model:'unchanged',googleMapsApiKey:'fixture'}
function service(){return {from(table:string){
  const rows:any={materials,app_settings:{company_address:'7653 S FM 148',company_city_state_zip:'Kaufman TX 75142',tax_enabled:true,tax_rate:8.25,tax_applies_to_delivery:false,delivery_tier_1_max_miles:10,delivery_tier_1_fee:100},control_center_settings:{ai_english:true,ai_spanish:true,route_intelligence_enabled:true}}
  if(!(table in rows))throw new Error('Production data access forbidden')
  const chain:any={then:(resolve:any)=>Promise.resolve({data:rows[table],error:null}).then(resolve)}
  for(const method of ['select','eq','limit','single'])chain[method]=()=>chain
  return chain
}}}
const intake=[c('my name is Mike'),c('20 yards of crushed concrete to 123 Oak Road, Kaufman TX 75142'),c('tomorrow at 1pm'),a('Would you like commercial clean crushed concrete?')]
afterEach(()=>vi.unstubAllGlobals())
function onlyRoutes(){
  const fetcher=vi.fn(async(url:string)=>{
    if(!url.includes('routes.googleapis.com'))throw new Error('Model should not be called for direct confirmation')
    return new Response(JSON.stringify({routes:[{distanceMeters:16093.44,duration:'900s'}],geocodingResults:{destination:{geocoderStatus:{},placeId:'fixture-pin'}}}))
  })
  vi.stubGlobal('fetch',fetcher);return fetcher
}
describe('real confirmation failure sequence through the production sandbox',()=>{
  it.each(['yes','yes please','sure','please do','send it','yeah'])('resolves material, displays verified totals, approves once and confirms recipient: %s',async answer=>{
    onlyRoutes()
    const selected=await simulateConversation(service(),{messages:[...intake,c(answer)]},config)
    expect(selected.tool_results.quantity).toMatchObject({status:'RESOLVED',material_id:'clean',yards:20})
    expect(selected.reply).toMatch(/Material \$350.00, delivery \$100.00, tax \$28.88; estimated total \$478.88.*prepare the quote/)
    expect(selected.tool_results.timings.model_attempts).toBe(0)
    const approvedMessages=[...intake,c(answer),a(selected.reply),c(answer)]
    const approved=await simulateConversation(service(),{messages:approvedMessages},config)
    expect(approved.decision.dashboard_proposal.quote_requested).toBe(true)
    expect(approved.reply).toMatch(/what email/)
    expect(approved.decision.missing_facts).not.toContain('explicit quote request')
    // An existing profile email collected earlier is confirmed in one turn.
    const ready=await simulateConversation(service(),{messages:[c('mike@example.com'),...approvedMessages,a('I have mike@example.com. Is that where you want us to send it?'),c(answer)]},config)
    expect(ready.decision.dashboard_proposal).toMatchObject({quote_requested:true,confirmed_email:'mike@example.com',ready:true})
    expect(ready.reply).toContain('ready for review')
    expect(ready.reply).not.toContain('?')
    expect(ready.tool_results.timings.model_attempts).toBe(0)
    expect(ready.send_allowed).toBe(false)
  })
  it('does not choose from two products or turn a recommendation into an order',()=>{
    expect(resolveConversationQuantity([c('20 yards crushed concrete'),a('commercial clean or 3x4?'),c('yes')],materials).status).toBe('NOT_READY')
    expect(resolveConversationQuantity([c('20 yards crushed concrete'),a('I recommend commercial clean. What date works?'),c('yes')],materials).status).toBe('NOT_READY')
  })
  it('keeps the last explicit correction after material acceptance',()=>{
    expect(resolveConversationQuantity([...intake,c('yes'),c('actually make it 40')],materials)).toMatchObject({material_id:'clean',yards:40,status:'RESOLVED'})
  })
  it('does not resurrect an unanswered old quote question for an unrelated yes',()=>{
    const proposal=lifecycleProposal({lead:{},customer:{name:'Mike'},messages:[a('Would you like a quote prepared?'),c('not yet'),c('yes')],lifecycle:{},decision:{},pricing:{}})
    expect(proposal.quote_requested).toBe(false)
  })
})
