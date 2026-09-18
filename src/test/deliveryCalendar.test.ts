// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import {afterEach,describe,expect,it,vi} from 'vitest'
import {simulateConversation} from '../../supabase/functions/_shared/ai-sandbox'
import {isDeliveryTimeReply,resolveDeliveryPreference} from '../../supabase/functions/_shared/lifecycle'
import {needsDeliveryReservation} from '../../supabase/functions/_shared/delivery-calendar'
const c=(body:string)=>({sender_type:'CUSTOMER',body}),a=(body:string)=>({sender_type:'AI',body})
const now=new Date('2026-09-18T15:00:00Z')
const config={apiKey:'fixture',baseUrl:'https://example.test/v1',model:'unchanged',googleMapsApiKey:'fixture'}
const intake=[c('my name is Mike'),c('20 yards of flexbase to 123 Oak Road, Kaufman TX 75142'),c('today'),a('what date would you prefer for delivery?')]
function fixture(status='AVAILABLE') {
 const rpc=vi.fn(async()=>({data:{status},error:null}))
 const service={rpc,from(table:string){
   const data:any={materials:[{id:'flex',catalog_key:'mat-4',name:'Flexbase',price_per_yard:38,full_load_price:720,full_load_yards:20}],app_settings:{company_address:'7653 S FM 148',company_city_state_zip:'Kaufman TX 75142',tax_enabled:false,delivery_tier_1_max_miles:10,delivery_tier_1_fee:100},control_center_settings:{ai_english:true,ai_spanish:true,route_intelligence_enabled:true}}
   if(!(table in data))throw new Error('Forbidden production access')
   const chain:any={then:(f:any)=>Promise.resolve({data:data[table],error:null}).then(f)}
   for(const key of ['select','eq','limit','single'])chain[key]=()=>chain
   return chain
 }}
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now)
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(!url.includes('routes.googleapis.com'))throw new Error('Scheduling must not use model');return new Response(JSON.stringify({routes:[{distanceMeters:16093.44,duration:'900s'}],geocodingResults:{destination:{geocoderStatus:{},placeId:'pin'}}}))}))
 return service
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
describe('delivery intake through the production sandbox',()=>{
 it.each(['can we do today at 1 PM?','today at 1','let’s do 1 PM today','would 1 PM work?'])('checks the real calendar and continues on %s',async text=>{
   const service=fixture();const result=await simulateConversation(service,{messages:[...intake,c(text)]},config)
   expect(result.reply).toMatch(/time reserved.*20 yards.*prepare the quote/i)
   expect(result.decision.dashboard_proposal.current).toMatchObject({date:'2026-09-18',time:'13:00'})
   expect(service.rpc).toHaveBeenCalledWith('check_delivery_slot',{p_date:'2026-09-18',p_time:'13:00',p_lead_id:null})
   expect(result.tool_results.timings.model_attempts).toBe(0)
   expect(result.database_changes).toBe(false);expect(result.send_allowed).toBe(false)
 })
 it('does not confirm a conflicting time or create a human handoff',async()=>{
   const result=await simulateConversation(fixture('CONFLICT'),{messages:[...intake,c('can we do today at 1 PM?')]},config)
   expect(result.reply).toMatch(/too close.*what other time/);expect(result.reply).not.toMatch(/reserved|booked|prepare the quote/)
   expect(result.decision.requires_human).toBe(false);expect(result.decision.dashboard_proposal.ready).toBe(false)
 })
 it('preserves the preference but makes no promise when the calendar fails',async()=>{
   const service=fixture();service.rpc.mockRejectedValue(new Error('Calendar offline'))
   const result=await simulateConversation(service,{messages:[...intake,c('today at 1pm')]},config)
   expect(result.reply).toContain('isn’t confirmed yet');expect(result.decision.dashboard_proposal.current.time).toBe('13:00')
 })
 it('continues through quote approval and recipient confirmation after reserving',async()=>{
   const service=fixture();const first=[...intake,c('today at 1pm')]
   const selected=await simulateConversation(service,{messages:first},config)
   const second=[...first,a(selected.reply),c('yes please')]
   const approved=await simulateConversation(service,{messages:second},config)
   expect(approved.reply).toContain('what email')
   const ready=await simulateConversation(service,{messages:[...second,a(approved.reply),c('mike@example.com')]},config)
   expect(ready.decision.dashboard_proposal).toMatchObject({ready:true,quote_requested:true,confirmed_email:'mike@example.com'})
   expect(ready.reply).toContain('quote is ready for review')
 })
 it('never reserves accepted/scheduled changes or pickup orders',()=>{
   const p={current:{date:'2026-09-19',time:'13:00'},progress:true};const pricing={status:'MATERIAL_CALCULATED',route:{status:'ROUTE_CALCULATED'}}
   for(const stage of ['SCHEDULING','SCHEDULED'])expect(needsDeliveryReservation(p,{stage,reactive:true,protected:true},pricing,{})).toBe(false)
   expect(needsDeliveryReservation({...p,lead_need:'material-pickup'},{},pricing,{})).toBe(false)
 })
 it('does not fast-track mixed changes and asks for missing/ambiguous dates',()=>{
   expect(isDeliveryTimeReply('today at 1pm and make it 40 yards')).toBe(false)
   expect(isDeliveryTimeReply('not today at 1pm')).toBe(false)
   expect(resolveDeliveryPreference('would 1pm work?',now).needsClarification).toBe(true)
   expect(resolveDeliveryPreference('today at 7',now).needsClarification).toBe(true)
   expect(resolveDeliveryPreference('today at 8am',now).needsClarification).toBe(true)
 })
})
