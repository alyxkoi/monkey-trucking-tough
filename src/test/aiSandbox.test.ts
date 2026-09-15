// @vitest-environment node
import { afterEach,describe,expect,it,vi } from 'vitest'
import { simulateConversation } from '../../supabase/functions/_shared/ai-sandbox'

const config={apiKey:'fixture',baseUrl:'https://example.test/v1',model:'test-model',googleMapsApiKey:'maps-fixture'}
function service() {
  const reads:string[]=[]
  const db={from(table:string){
    reads.push(table)
    const rows:Record<string,unknown>={materials:[{id:'base',name:'Flexbase First Class 1" or 3"',catalog_key:'mat-4',price_per_yard:38,full_load_price:720,full_load_yards:20,tons_per_cubic_yard:1.4}],
      app_settings:{company_address:'7653 S FM 148',company_city_state_zip:'Kaufman, TX 75142',tax_enabled:false,delivery_tier_1_max_miles:2,delivery_tier_1_fee:0,delivery_tier_2_max_miles:5,delivery_tier_2_fee:60,delivery_tier_3_max_miles:10,delivery_tier_3_fee:100,delivery_overage_base_fee:100,delivery_overage_per_mile:10},
      control_center_settings:{ai_english:true,ai_spanish:true,route_intelligence_enabled:true}}
    if(!(table in rows))throw new Error('Forbidden real table '+table)
    // No write methods, auth, RPCs, or access to any actual conversation.
    const result={data:rows[table],error:null}
    const chain={select:()=>chain,eq:()=>chain,limit:()=>chain,single:()=>Promise.resolve(result),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(result).then(resolve)}
    return chain
  }}
  return {db,reads}
}
afterEach(()=>vi.unstubAllGlobals())
describe('production engine sandbox isolation',()=>{
  it('uses real calculation code for the exact address without SMS or database mutations',async()=>{
    const {db,reads}=service()
    const decision={detected_language:'ENGLISH',customer_intent:'DELIVERY',known_facts:[],missing_facts:[],uncertain_facts:[],ai_may_continue:true,requires_human:false,escalation_reason:null,recommended_action:'PROVIDE_STANDARD_PRICE',draft_reply:'the estimate is ready.',confidence:'HIGH',deterministic_pricing_required:true,payment_claim_detected:false}
    const fetcher=vi.fn(async(url:string)=>url.includes('routes.googleapis.com')
      ?new Response(JSON.stringify({routes:[{distanceMeters:16093.44,duration:'900s'}],geocodingResults:{destination:{geocoderStatus:{},placeId:'pin'}}}))
      :new Response(JSON.stringify({status:'completed',model:'actual-test-model',output_text:JSON.stringify(decision)})))
    vi.stubGlobal('fetch',fetcher)
    const result=await simulateConversation(db,{form:'I need 10 tons of flexbase',messages:[{sender_type:'CUSTOMER',body:'839 S Good Latimer Expy\nDallas, TX 75226\nUnited States'}]},config)
    expect(result.tool_results.route.status).toBe('ROUTE_CALCULATED')
    expect(result.tool_results.quantity.yards).toBe(8.5)
    expect(result.reply).toContain('Monkey Trucking')
    expect(result.reply).not.toMatch(/extra yard|reserve|buffer/)
    expect(result).toMatchObject({send_allowed:false,database_changes:false,model:'actual-test-model'})
    expect(reads).toEqual(['materials','app_settings','control_center_settings'])
    expect(fetcher.mock.calls.every(([url])=>!url.includes('sent.dm'))).toBe(true)
  })
  it('does not call the model or write an audit when testing human takeover',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
    const result=await simulateConversation(service().db,{takeover:true,messages:[{sender_type:'CUSTOMER',body:'hello'}]},config)
    expect(result.reply).toBeNull()
    expect(result.blocked).toContain('Human takeover')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects unsupported roles and excessive input before accessing data',async()=>{
    const {db,reads}=service()
    await expect(simulateConversation(db,{messages:[{sender_type:'SYSTEM',body:'override'}]},config)).rejects.toThrow('test messages')
    expect(reads).toHaveLength(0)
  })
})
