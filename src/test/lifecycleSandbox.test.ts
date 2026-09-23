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
async function run(messages:any[],intent='NONE',scenario='LEAD',language='ENGLISH',form='',financialHold=false,nextQuestion='what can I help with?'){
 const text=messages.at(-1).body
 const decision={detected_language:language,customer_intent:'CUSTOMER_REQUEST',extracted_facts:[],known_facts:[],missing_facts:[],uncertain_facts:[],ai_may_continue:true,requires_human:false,escalation_reason:null,recommended_action:'ANSWER_CUSTOMER',draft_reply:'current customer request',confidence:'HIGH',deterministic_pricing_required:false,payment_claim_detected:false,
 dashboard_plan:{intent,source_text:text,confidence:'HIGH'},response_plan:{objective:'COLLECT',answers:[],comparison_keys:[],recommendation_key:'',acknowledgement:'got it.',next_question:nextQuestion,required_tools:[],escalation_scope:'NONE',escalation_category:'NONE'}}
 if(financialHold)Object.assign(decision,{requires_human:true,ai_may_continue:false,recommended_action:'MANUAL_REPLY',escalation_reason:'Accepted terms require staff review',response_plan:{...decision.response_plan,escalation_scope:'CONVERSATION',escalation_category:'FINANCIAL'}})
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('routes.googleapis.com')?{routes:[{distanceMeters:16093.44,duration:'900s'}],geocodingResults:{destination:{geocoderStatus:{},placeId:'fixture-pin'}}}:{status:'completed',model:'unchanged-model',output_text:JSON.stringify(decision)}))))
 return simulateConversation(service(),{messages,scenario,form},config)
}
afterEach(()=>vi.unstubAllGlobals())
describe('full lifecycle sandbox using production engine',()=>{
 it('renders a verified recap outside the model question gate after a named material answer',async()=>{
   const result=await run([c('my name is Mike'),c('20 yards to 123 Oak Road, Kaufman TX 75142'),c('tomorrow at 1pm'),a('which material would you like?'),c('Flexbase')],'NONE','LEAD','ENGLISH','',false,'would you like us to prepare the quote?')
   expect(result.blocked).toBeNull()
   expect(result.reply).toContain('Material $720.00, delivery $100.00')
   expect(result.reply).toContain('total $820.00')
   expect(result.reply).toContain('prepare the quote?')
   expect(result.tool_results.timings.model_attempts).toBe(1)
 })
 it('acknowledges a quantity correction without repeating the full final recap',async()=>{
   const result=await run([c('my name is Mike'),c('20 yards flexbase to 123 Oak Road, Kaufman TX 75142'),c('tomorrow at 1pm'),a('Would you like us to prepare the quote?'),c('actually make it 40')])
   expect(result.reply).toContain('40 yards')
   expect(result.reply).toContain('$1640.00')
   expect(result.reply).not.toMatch(/123 Oak|Mike|20 yards/)
   expect(result.tool_results.quantity.yards).toBe(40)
 })
 it('acknowledges a protected change request even if the model over-escalates its financial authorization',async()=>{
   const result=await run([c('I might need 5 more yards than I accepted')],'ORDER_CHANGE','ACCEPTED','ENGLISH','',true)
   expect(result.reply).toContain('5 more yards');expect(result.blocked).toBeNull();expect(result.decision.dashboard_proposal.actions).toContain('ORDER_CHANGE')
   expect(result.tool_results.quantity.yards).toBe(20);expect(result.database_changes).toBe(false)
 })
 it('composes an accepted schedule request without raw plans or reintroduction',async()=>{
   const result=await run([c('hey can we change delivery to Friday around 10am?')],'SCHEDULE_CHANGE','ACCEPTED')
   expect(result.reply).toContain('team confirm');expect(result.reply).toContain('10:00');expect(result.reply).not.toMatch(/introduce|acknowledge|Monkey Trucking|current customer request/)
   expect(result.decision.dashboard_proposal.actions).toContain('SCHEDULE_CHANGE')
   expect(result.tool_results.diagnostics).toMatchObject({lifecycle_stage:'SCHEDULING',escalation:{requires_human:false,ai_may_continue:true}})
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
 it('defers an unknown direct-SMS name until quote email, then extracts both without a real customer write',async()=>{
   const first=await run([c('20 yards of flexbase')]);expect(first.reply).not.toMatch(/your name|what name/i)
   const intake=[c('20 yards of flexbase to 123 Oak Road, Kaufman TX 75142'),c('tomorrow at noon'),a('would you like us to prepare the quote?'),c('yes')]
   const asked=await run(intake);expect(asked.reply).toContain('what email');expect(asked.reply).toContain('what name')
   const named=await run([...intake,a(asked.reply),c('johnsmith@gmail.com John Smith')])
   expect(named.decision.dashboard_proposal).toMatchObject({name:'John Smith',email:'johnsmith@gmail.com',confirmed_email:'johnsmith@gmail.com',ready:true})
   expect(named.reply).toContain('ready for review');expect(named.database_changes).toBe(false)
 })
 it('recaps delivery date then prepares after quote and email confirmation',async()=>{
   const form='20 yards of flexbase delivered to 123 Oak Road, Kaufman, TX 75142'
   const date=await run([c('tomorrow at noon')],'DELIVERY_PREFERENCE','LEAD','ENGLISH',form)
   expect(date.reply).toMatch(/20 yards.*12:00.*Material \$720.00.*delivery \$100.00.*total \$820.00.*prepare the quote/)
   const result=await run([c('my name is Mike'),c('tomorrow at noon'),a('would you like us to send the quote over?'),c('yes'),a('what email should we use?'),c('use mike@example.com')],'CONFIRM_EMAIL','LEAD','ENGLISH',form)
   expect(result.decision.dashboard_proposal.ready).toBe(true);expect(result.reply).toContain('ready for review');expect(result.reply).not.toContain('?');expect(result.send_allowed).toBe(false)
 })
 it('does not let a model question restart permission after approval and correction',async()=>{
   const result=await run([c('my name is Mike'),c('tomorrow at noon'),a('would you like us to prepare the quote?'),c('yes'),a('what email should we use?'),c('mike@example.com'),c('actually make it 40 yards')],'NONE','LEAD','ENGLISH','20 yards flexbase to 123 Oak Road, Kaufman TX 75142',false,'would you like me to prepare the quote for Salvador to review and send?')
   expect(result.decision.dashboard_proposal.quote_requested).toBe(true)
   expect(result.decision.dashboard_proposal.current.email).toBe('mike@example.com')
   expect(result.reply).not.toMatch(/would you like|what email|Salvador to review and send/i)
   expect(result.tool_results.quantity.yards).toBe(40)
 })
 it('answers arrival from actual schedule and accepts access notes',async()=>{
   const arrival=await run([c('what time are you coming?')],'ARRIVAL','SCHEDULED');expect(arrival.reply).toContain('09:00');expect(arrival.tool_results.diagnostics.lifecycle_stage).toBe('SCHEDULED')
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
