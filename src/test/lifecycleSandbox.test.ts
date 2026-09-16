// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe,it,expect,vi,afterEach } from 'vitest'
import { simulateConversation } from '../../supabase/functions/_shared/ai-sandbox'
const config={apiKey:'fixture',baseUrl:'https://example.test/v1',model:'unchanged-model',googleMapsApiKey:'fixture'}
function service(){return {from(table:string){
 const rows:any={materials:[{id:'base',catalog_key:'mat-4',name:'Flexbase',price_per_yard:38,full_load_price:720,full_load_yards:20}],app_settings:{company_address:'7653 S FM 148',company_city_state_zip:'Kaufman TX 75142',tax_enabled:false,delivery_tier_1_max_miles:10,delivery_tier_1_fee:100},control_center_settings:{ai_english:true,ai_spanish:true,route_intelligence_enabled:true}}
 if(!(table in rows))throw new Error('Real customer access forbidden')
 const chain:any={then:(resolve:any)=>Promise.resolve({data:rows[table],error:null}).then(resolve)};for(const method of ['select','eq','limit','single'])chain[method]=()=>chain;return chain
}}}
const c=(body:string)=>({sender_type:'CUSTOMER',body}),a=(body:string)=>({sender_type:'AI',body})
async function run(messages:any[],intent='NONE',scenario='LEAD',language='ENGLISH',form='',financialHold=false){
 const text=messages.at(-1).body
 const decision={detected_language:language,customer_intent:'CUSTOMER_REQUEST',extracted_facts:[],known_facts:[],missing_facts:[],uncertain_facts:[],ai_may_continue:true,requires_human:false,escalation_reason:null,recommended_action:'ANSWER_CUSTOMER',draft_reply:'current customer request',confidence:'HIGH',deterministic_pricing_required:false,payment_claim_detected:false,
 dashboard_plan:{intent,source_text:text,confidence:'HIGH'},response_plan:{objective:'COLLECT',answers:[],comparison_keys:[],recommendation_key:'',acknowledgement:'got it.',next_question:'what can I help with?',required_tools:[],escalation_scope:'NONE',escalation_category:'NONE'}}
 if(financialHold)Object.assign(decision,{requires_human:true,ai_may_continue:false,recommended_action:'MANUAL_REPLY',escalation_reason:'Accepted terms require staff review',response_plan:{...decision.response_plan,escalation_scope:'CONVERSATION',escalation_category:'FINANCIAL'}})
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('routes.googleapis.com')?{routes:[{distanceMeters:16093.44,duration:'900s'}],geocodingResults:{destination:{geocoderStatus:{},placeId:'fixture-pin'}}}:{status:'completed',model:'unchanged-model',output_text:JSON.stringify(decision)}))))
 return simulateConversation(service(),{messages,scenario,form},config)
}
afterEach(()=>vi.unstubAllGlobals())
describe('full lifecycle sandbox using production engine',()=>{
 it('acknowledges a protected change request even if the model over-escalates its financial authorization',async()=>{
   const result=await run([c('I might need 5 more yards than I accepted')],'ORDER_CHANGE','ACCEPTED','ENGLISH','',true)
   expect(result.reply).toContain('5 more yards');expect(result.blocked).toBeNull();expect(result.decision.dashboard_proposal.actions).toContain('ORDER_CHANGE')
   expect(result.tool_results.quantity.yards).toBe(20);expect(result.database_changes).toBe(false)
 })
 it('composes an accepted schedule request without raw plans or reintroduction',async()=>{
   const result=await run([c('hey can we change delivery to Friday around 10am?')],'SCHEDULE_CHANGE','ACCEPTED')
   expect(result.reply).toContain('team confirm');expect(result.reply).toContain('10:00');expect(result.reply).not.toMatch(/introduce|acknowledge|Monkey Trucking|current customer request/)
   expect(result.decision.dashboard_proposal.actions).toContain('SCHEDULE_CHANGE')
 })
 it('acknowledges an increment while protecting accepted order terms',async()=>{
   const result=await run([c('also I might need 5 more yards than I accepted')],'ORDER_CHANGE','ACCEPTED')
   expect(result.reply).toContain('5 more yards');expect(result.reply).toContain('current order stays the same');expect(result.database_changes).toBe(false)
   expect(result.tool_results.proposed_changes.context).toMatchObject({accepted_yards:20,additional_yards:5,proposed_pricing:{yards:25,material_total:910},proposal_requires_staff_approval:true})
   expect(result.tool_results.quantity.yards).toBe(20)
 })
 it('confirms the exact email in the reactive lifecycle',async()=>{
   const result=await run([c('update my email to treytest@gmail.com')],'CONTACT','ACCEPTED')
   expect(result.reply).toBe('got it, I updated your email to treytest@gmail.com.')
   expect(result.decision.dashboard_proposal.email).toBe('treytest@gmail.com')
 })
 it('skips the model for a verified plain address after material intake',async()=>{
   const result=await run([c('123 Oak Road, Kaufman TX 75142')],'NONE','LEAD','ENGLISH','20 yards flexbase')
   expect(result.tool_results.timings).toMatchObject({model_attempts:0,deterministic_address_reply:true})
   expect(result.reply).toContain('estimated total');expect(result.reply).not.toContain('what material')
 })
 it('asks unknown names, extracts the answer and never writes a real customer',async()=>{
   const first=await run([c('hello')]);expect(first.reply).toContain('name')
   const next=await run([c('hello'),a('what is your name?'),c('Mike')],'CONTACT')
   expect(next.decision.dashboard_proposal.name).toBe('Mike');expect(next.database_changes).toBe(false)
 })
 it('recaps delivery date then prepares after quote and email confirmation',async()=>{
   const form='20 yards of flexbase delivered to 123 Oak Road, Kaufman, TX 75142'
   const date=await run([c('tomorrow at noon')],'DELIVERY_PREFERENCE','LEAD','ENGLISH',form)
   expect(date.reply).toMatch(/20 yards.*12:00.*send the quote/)
   const result=await run([c('tomorrow at noon'),a('would you like us to send the quote over?'),c('yes'),a('what email should we use?'),c('use mike@example.com')],'CONFIRM_EMAIL','LEAD','ENGLISH',form)
   expect(result.decision.dashboard_proposal.ready).toBe(true);expect(result.reply).toContain('Salvador to review and send');expect(result.send_allowed).toBe(false)
 })
 it('answers arrival from actual schedule and accepts access notes',async()=>{
   const arrival=await run([c('what time are you coming?')],'ARRIVAL','SCHEDULED');expect(arrival.reply).toContain('09:00')
   const note=await run([c('use the side gate, code 5521')],'JOB_NOTE','SCHEDULED');expect(note.decision.dashboard_proposal.job_note).toContain('5521');expect(note.reply).toContain('instruction')
 })
 it('keeps accepted corrections as review requests, not accepted quote edits',async()=>{
   const result=await run([c('actually change it to 30 yards')],'ORDER_CHANGE','ACCEPTED')
   expect(result.reply).toContain('current order and schedule stay unchanged');expect(result.decision.dashboard_proposal.actions).toContain('ORDER_CHANGE')
 })
 it.each(['SPANISH','SPANGLISH'])('keeps %s handoff acknowledged without autonomous continuation',async language=>{
   const result=await run([c('quiero hablar con Salvador')],'HUMAN_REQUEST','SCHEDULED',language)
   expect(result.reply).toContain('Salvador');expect(result.decision.ai_may_continue).toBe(false);expect(result.decision.handoff_acknowledgement).toBe(true)
 })
 it('reactivates paid customer intent only as a new transaction proposal',async()=>{
   const result=await run([c('I need another delivery')],'NEW_WORK','PAID')
   expect(result.decision.lifecycle).toBe('PAID');expect(result.decision.dashboard_proposal.actions).toContain('NEW_WORK');expect(result.reply).toContain('another project')
 })
 it('stays paused after the single handoff acknowledgment',async()=>{
   const result=await run([c('I want Salvador'),a('got it, I will have Salvador take a look at this.'),c('are you there?')])
   expect(result.reply).toBeNull();expect(result.blocked).toMatch(/human takeover/i)
 })
})
