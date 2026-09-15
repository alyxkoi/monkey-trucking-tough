// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { simulateConversation } from '../../supabase/functions/_shared/ai-sandbox'
import { forcedEscalation } from '../../supabase/functions/_shared/ai-engine'
import { materialCandidates, resolveConversationQuantity } from '../../supabase/functions/_shared/material-intelligence'
import { composeConversationResponse } from '../../supabase/functions/_shared/conversation-response'

const materials=[
  {id:'uuid-commercial',catalog_key:'mat-1',name:'Commercial Crushed Concrete Clean',price_per_yard:40,full_load_price:750,full_load_yards:20,tons_per_cubic_yard:1.4},
  {id:'uuid-large',catalog_key:'mat-3',name:'3x4 Crushed Concrete',price_per_yard:35,full_load_price:650,full_load_yards:20,tons_per_cubic_yard:1.4},
  {id:'uuid-flex',catalog_key:'mat-4',name:'Flexbase First Class',price_per_yard:38,full_load_price:720,full_load_yards:20,tons_per_cubic_yard:1.4},
]
const config={apiKey:'fixture',baseUrl:'https://example.test/v1',model:'test-model',googleMapsApiKey:'fixture'}
type Message={sender_type:string;body:string}
const customer=(body:string):Message=>({sender_type:'CUSTOMER',body})
const ai=(body:string):Message=>({sender_type:'AI',body})
const plan=(overrides:Record<string,unknown>={})=>({objective:'COLLECT',answers:[],comparison_keys:[],acknowledgement:'',next_question:'What is the delivery address?',required_tools:[],escalation_scope:'NONE',escalation_category:'NONE',...overrides})
const decision=(overrides:Record<string,unknown>={})=>({detected_language:'ENGLISH',customer_intent:'MATERIAL_DELIVERY',extracted_facts:[],known_facts:[],missing_facts:[],uncertain_facts:[],ai_may_continue:true,requires_human:false,escalation_reason:null,recommended_action:'ANSWER_CUSTOMER',draft_reply:'answer the customer.',confidence:'HIGH',deterministic_pricing_required:false,payment_claim_detected:false,response_plan:plan(),...overrides})
function service(tax=false) {
  const reads:string[]=[]
  const db={from(table:string){
    reads.push(table)
    const rows:Record<string,unknown>={materials,app_settings:{company_address:'7653 S FM 148',company_city_state_zip:'Kaufman, TX 75142',tax_enabled:tax,tax_rate:8.25,tax_applies_to_delivery:false,delivery_tier_1_max_miles:2,delivery_tier_1_fee:0,delivery_tier_2_max_miles:5,delivery_tier_2_fee:60,delivery_tier_3_max_miles:10,delivery_tier_3_fee:100,delivery_overage_base_fee:100,delivery_overage_per_mile:10},control_center_settings:{ai_english:true,ai_spanish:true,route_intelligence_enabled:true}}
    if(!(table in rows))throw new Error('Real customer or write access: '+table)
    const chain={select:()=>chain,eq:()=>chain,limit:()=>chain,single:()=>chain,then:(r:(x:unknown)=>unknown)=>Promise.resolve({data:rows[table],error:null}).then(r)}
    return chain
  }}
  return {db,reads}
}
function mockModel(answer:ReturnType<typeof decision>, meters=16093.44) {
  const contexts:Record<string,unknown>[]=[]
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
    if(url.includes('routes.googleapis.com'))return new Response(JSON.stringify({routes:[{distanceMeters:meters,duration:'900s'}],geocodingResults:{destination:{geocoderStatus:{},placeId:'fixture-pin'}}}))
    contexts.push(JSON.parse(JSON.parse(String(init.body)).input[0].content[0].text))
    return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(answer)}))
  }))
  return contexts
}
async function run(messages:Message[],responsePlan:Record<string,unknown>,overrides:Record<string,unknown>={},tax=false) {
  const contexts=mockModel(decision({...overrides,response_plan:plan(responsePlan)}))
  const {db,reads}=service(tax)
  const result=await simulateConversation(db,{messages},config)
  expect(reads).toEqual(['materials','app_settings','control_center_settings'])
  expect(result).toMatchObject({send_allowed:false,database_changes:false})
  return {...result,contexts}
}
afterEach(()=>vi.unstubAllGlobals())

describe('canonical corrections before business tools',()=>{
  it.each(['commercial','commercial clean','commercial crushed concrete'])('resolves %s after a catalog rename',alias=>{
    const result=resolveConversationQuantity([customer(`18 yards of ${alias}`)],[{...materials[0],name:'Updated Display Name'},...materials.slice(1)])
    expect(result).toMatchObject({status:'RESOLVED',material_id:'uuid-commercial',material_catalog_key:'mat-1',yards:18})
  })
  it.each([['3x4','uuid-large'],['flexbase','uuid-flex']])('resolves %s to a UUID', (alias,id)=>{
    expect(resolveConversationQuantity([customer(`18 yards ${alias}`)],materials).material_id).toBe(id)
  })
  it('keeps an ambiguous family unresolved and lists only its catalog candidates',()=>{
    const result=resolveConversationQuantity([customer('18 yards crushed concrete')],materials)
    expect(result).toMatchObject({status:'NOT_READY',yards:18})
    expect(result.material_candidates?.map(m=>m.id)).toEqual(['uuid-commercial','uuid-large'])
  })
  it('applies repeated unitless corrections without reading a ZIP as quantity',()=>{
    const messages=[customer('20 yards flexbase'),customer('actually make it 30 yards'),customer('sorry make that 25'),customer('actually make it 28'),customer('75149')]
    expect(resolveConversationQuantity(messages,materials)).toMatchObject({yards:28,input_unit:'YARDS'})
  })
  it('uses the asked unit for a first bare quantity answer',()=>{
    expect(resolveConversationQuantity([customer('commercial'),ai('how many yards?'),customer('18')],materials)).toMatchObject({yards:18,material_id:'uuid-commercial'})
  })
  it('does not change a chosen material just because two alternatives are compared',()=>{
    const result=resolveConversationQuantity([customer('20 yards commercial'),customer('what is the difference between flexbase and 3x4?')],materials)
    expect(result.material_id).toBe('uuid-commercial')
    expect(materialCandidates('commercial vs 3x4',materials)).toHaveLength(2)
  })
  it('keeps an explicit material correction and recomputes ton volume for it',()=>{
    expect(resolveConversationQuantity([customer('10 tons flexbase'),customer('no, commercial instead')],[{...materials[0],tons_per_cubic_yard:2},...materials.slice(1)])).toMatchObject({material_id:'uuid-commercial',yards:6,input_unit:'TONS'})
  })
  it('does not use negated quantities or an earlier selection in the same correction',()=>{
    expect(resolveConversationQuantity([customer("I don't want commercial, use flexbase, 25 yards not 30 yards")],materials)).toMatchObject({material_id:'uuid-flex',yards:25})
  })
  it('resolves material and quantity corrections independently within one message',()=>{
    expect(resolveConversationQuantity([customer('18 yards crushed concrete'),customer('commercial instead, actually make it 30 yards')],materials)).toMatchObject({material_id:'uuid-commercial',yards:30})
  })
  it('resolves a unitless correction before a second question/address in the same message',async()=>{
    const result=await run([customer('30 yards commercial'),customer("sorry make that 28. what's the price for that delivered to 424 kent dr 75149?")],{answers:['PRICE'],objective:'ANSWER',next_question:''})
    expect(result.tool_results.quantity.yards).toBe(28)
    expect(result.tool_results.pricing).toMatchObject({yards:28,delivery_loads:2,material_total:1070})
    expect(result.tool_results.route.destination).toBe('424 kent dr 75149')
  })
  it('keeps a correction in conversational yards after the AI proposed a ton conversion',()=>{
    expect(resolveConversationQuantity([customer('10 tons flexbase'),ai('I recommend approximately 8.5 yards. What address?'),customer('make that 10, please')],materials)).toMatchObject({yards:10,input_unit:'YARDS',coverage_buffer_yards:0})
  })
})

describe('shared production conversation orchestration',()=>{
  it('answers the secondary service intent while qualifying and scopes the handoff',async()=>{
    const result=await run([customer('my name is Mike, I need 18 yards crushed concrete delivered and my driveway needs to be redone. Do you do that too?')],{objective:'ANSWER',answers:['SERVICE_SCOPE'],next_question:'Would you like commercial clean or 3x4?',escalation_scope:'SUBTASK',escalation_category:'CUSTOM_WORK'})
    expect(result.blocked).toBeNull()
    expect(result.reply).toContain('yes, we do driveways')
    expect(result.reply).toContain('commercial clean or 3x4?')
    expect(result.decision).toMatchObject({ai_may_continue:true,requires_human:false})
    expect(result.decision.subtask_escalations).toHaveLength(1)
    expect(result.decision.known_facts).toContainEqual({key:'customer_name',value:'Mike',source:'CONVERSATION'})
  })
  it('refreshes material, load and route pricing for quantity plus address corrections',async()=>{
    const result=await run([customer('20 yards flexbase'),ai('what address?'),customer('actually make it 30 yards'),customer('sorry make that 28'),customer('what is that delivered to 424 kent dr 75149?')],{objective:'ANSWER',answers:['PRICE'],next_question:'',required_tools:['MATERIAL','ROUTE'],escalation_category:'TOOL_REFRESH',escalation_scope:'CONVERSATION'},{requires_human:true,ai_may_continue:false,recommended_action:'MANUAL_REPLY',escalation_reason:'Updated deterministic pricing required.',uncertain_facts:['stale pricing result']})
    expect(result.blocked).toBeNull()
    expect(result.tool_results.quantity.yards).toBe(28)
    expect(result.tool_results.pricing).toMatchObject({material_total:1024,delivery_total:200,grand_total:1224,delivery_loads:2})
    expect(result.reply).toContain('$1224.00')
    expect(result.contexts[0].deterministic_pricing_result).toMatchObject({yards:28})
  })
  it('compares verified same-quantity prices without replaying a quote or selecting another product',async()=>{
    const result=await run([customer('18 yards commercial'),ai('what address?'),customer('what is the price difference with 3x4?')],{objective:'COMPARE',answers:['PRICE'],comparison_keys:['mat-1','mat-3'],next_question:''})
    expect(result.reply).toContain('difference for 18 yards is $90.00')
    expect(result.reply).not.toContain('estimated total')
    expect(result.tool_results.quantity.material_id).toBe('uuid-commercial')
  })
  it('explains delivery using verified miles and loads, ignoring a customer supplied amount',async()=>{
    const result=await run([customer('28 yards commercial to 424 Kent Dr 75149'),ai('the estimate is ready.'),customer('why is delivery $999?')],{objective:'EXPLAIN',answers:['DELIVERY'],next_question:''})
    expect(result.reply).toContain('delivery is $200.00')
    expect(result.reply).toContain('10 miles')
    expect(result.reply).toContain('2 loads')
    expect(result.reply).not.toMatch(/999|estimated total|Monkey Trucking/)
  })
  it('does not duplicate product guidance or add prices to a uses/recommendation question',async()=>{
    const result=await run([customer('18 yards crushed concrete for a driveway'),ai('commercial clean or 3x4?'),customer('what is the difference and which do you recommend?')],{objective:'COMPARE',answers:['PRODUCT_OPTIONS','RECOMMENDATION'],comparison_keys:['mat-1','mat-3'],recommendation_key:'mat-1',next_question:'Which would you like?'})
    expect(result.reply).toContain("I'd start with commercial clean")
    expect(result.reply?.match(/3x4 crushed concrete:/g)).toHaveLength(1)
    expect(result.reply).not.toContain('$')
  })
  it('explains the material rate/load breakdown without model arithmetic',async()=>{
    const result=await run([customer('28 yards flexbase'),ai('material is $1024.00'),customer('how did you calculate the material cost?')],{objective:'EXPLAIN',answers:['PRICE'],next_question:''})
    expect(result.reply).toContain('1 full loads at $720.00 plus 8 yards at $38.00 per yard: $1024.00')
  })
  it('answers installation scope while keeping standard conversation active',async()=>{
    const result=await run([customer('25 yards commercial'),customer('does that include driveway installation?')],{objective:'ANSWER',answers:['INSTALLATION_SCOPE'],escalation_scope:'CONVERSATION',escalation_category:'CUSTOM_WORK'},{requires_human:true,ai_may_continue:false,recommended_action:'MANUAL_REPLY'})
    expect(result.blocked).toBeNull()
    expect(result.reply).toContain('not installation work')
    expect(result.decision.subtask_escalations).toHaveLength(1)
  })
  it('summarizes the latest canonical state without old amounts or addresses',async()=>{
    const result=await run([customer('my name is Mike, I need 20 yards flexbase and a driveway redo'),customer('1237 Eastside Dr 75149'),customer('sorry make that 25'),customer('commercial instead'),customer('sorry it was 424 Kent Dr 75149'),ai('got it.'),customer('what do you have me down for?')],{objective:'SUMMARY',answers:['SUMMARY'],next_question:''})
    expect(result.reply).toContain('Mike; 25 yards of Commercial Crushed Concrete Clean; 424 Kent Dr 75149')
    expect(result.reply).toContain('custom work pricing pending Salvador')
    expect(result.reply).not.toMatch(/20 yards|flexbase|1237/)
  })
  it('preserves side questions when an earlier address still needs clarification',async()=>{
    const result=await run([customer('18 yards commercial at 123 Oak Road'),ai('what city?'),customer('do you do driveways too?')],{objective:'ANSWER',answers:['SERVICE_SCOPE'],next_question:'What city is the delivery in?'})
    expect(result.reply).toContain('yes, we do driveways')
    expect(result.reply).toContain('What city')
  })
  it.each(['SPANISH','SPANGLISH'])('supports %s without repeating an introduction',async language=>{
    const result=await run([customer('18 yardas commercial'),ai('hola, soy de Monkey Trucking.'),customer('mejor que sean 25 yardas')],{answers:['QUANTITY'],next_question:'Cuál es la dirección de entrega?'},{detected_language:language})
    expect(result.reply).toMatch(/25 (yardas|yards)/)
    expect(result.reply).toContain('Cuál es la dirección')
    expect(result.reply).not.toContain('Monkey Trucking')
    expect(result.blocked).toBeNull()
  })
  it.each([false,true])('describes tax only when nonzero (tax enabled: %s)',async tax=>{
    const result=await run([customer('20 yards flexbase at 424 Kent Dr 75149')],{answers:['PRICE'],objective:'ANSWER',next_question:''},{},tax)
    if(tax)expect(result.reply).toContain('$59.40 tax')
    else expect(result.reply).not.toMatch(/with tax|tax|impuestos/)
  })
  it('retains full human takeover and never calls the model',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
    const result=await simulateConversation(service().db,{takeover:true,messages:[customer('hello')]},config)
    expect(result.blocked).toContain('Human takeover')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('treats explicit human requests as global even if the model chooses custom subtask scope',async()=>{
    const result=await run([customer('I want to speak to Salvador about the driveway')],{escalation_scope:'SUBTASK',escalation_category:'CUSTOM_WORK'})
    expect(result.reply).toBeNull()
    expect(result.decision).toMatchObject({requires_human:true,ai_may_continue:false})
  })
  it('does not treat ordinary corrections or explanatory questions as complaints',()=>{
    expect(forcedEscalation('No, I said 25 yards, please fix that.',false)).toBeNull()
    expect(forcedEscalation('Why is delivery so much?',false)).toBeNull()
    expect(forcedEscalation('The driver damaged my property',false)).toContain('complaint')
  })
  it('isolates two same-name sessions and never accesses real identities',async()=>{
    mockModel(decision({response_plan:plan({objective:'SUMMARY',answers:['SUMMARY'],next_question:''})}))
    const first=await simulateConversation(service().db,{messages:[customer('my name is Mike, I need 30 yards commercial')]},config)
    const second=await simulateConversation(service().db,{messages:[customer('my name is Mike, I need 10 yards flexbase')]},config)
    expect(first.session_id).not.toBe(second.session_id)
    expect(first.reply).toContain('30 yards')
    expect(second.reply).toContain('10 yards')
    expect(second.reply).not.toMatch(/30|Commercial/)
  })
  it('rejects model-invented business assertions and unknown material IDs',async()=>{
    await expect(run([customer('18 yards commercial')],{acknowledgement:'Delivery is $1.'})).rejects.toThrow('Unverified business assertion')
    await expect(run([customer('18 yards commercial')],{objective:'COMPARE',comparison_keys:['made-up']})).rejects.toThrow('unknown catalog identity')
  })
  it('fails closed when a refresh still has no valid tool result',async()=>{
    const result=await run([customer('hello')],{escalation_category:'TOOL_REFRESH',escalation_scope:'CONVERSATION',required_tools:['MATERIAL']},{requires_human:true,ai_may_continue:false,escalation_reason:'Official material pricing unavailable',recommended_action:'MANUAL_REPLY'})
    expect(result.reply).toBeNull()
    expect(result.decision.requires_human).toBe(true)
  })
  it('never prints a model quote hidden in draft_reply',async()=>{
    const result=await run([customer('20 yards commercial')],{objective:'ANSWER',answers:['PRICE'],next_question:''},{draft_reply:'the cost is $999999 for 999 miles'})
    expect(result.reply).toContain('$750.00')
    expect(result.reply).not.toContain('999')
    expect(result.reply).not.toMatch(/tax|impuestos/)
  })
  it('requires server conversation facts in the standalone composer',()=>{
    expect(()=>composeConversationResponse(decision(),{})).toThrow('Current conversation facts')
  })
})
