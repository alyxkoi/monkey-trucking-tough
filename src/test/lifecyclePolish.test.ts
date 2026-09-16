// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest'
import {assertCustomerText,composeConversationResponse,requestedService} from '../../supabase/functions/_shared/conversation-response'
import {resolveConversationQuantity} from '../../supabase/functions/_shared/material-intelligence'
import {calculateDeliveryRoute} from '../../supabase/functions/_shared/route-intelligence'
const plan={objective:'EXPLAIN',answers:['DELIVERY','INSTALLATION_SCOPE'],comparison_keys:[],recommendation_key:'',acknowledgement:'',next_question:'What is your delivery address?',required_tools:['ROUTE'],escalation_scope:'NONE',escalation_category:'NONE'}
afterEach(()=>vi.unstubAllGlobals())
describe('lifecycle behavior classes',()=>{
 it.each([14.1,14.5,14.9])('rounds the buffered %s ton estimate up to whole yards',tons=>{
   const result=resolveConversationQuantity([{sender_type:'CUSTOMER',body:`${tons} tons flexbase`}],[{id:'base',catalog_key:'mat-4',name:'Flexbase',tons_per_cubic_yard:1}])
   expect(result).toMatchObject({raw_yards:tons,coverage_buffer_yards:1,recommended_yards:16,yards:16})
 })
 it('answers only requested service scopes',()=>{
   expect(requestedService('can you redo my driveway?',false)).toBe('yes, we do driveways.')
   expect(requestedService('do you work on ponds?',false)).toBe('yes, we do pond work.')
   expect(requestedService('do you do driveways and private roads?',false)).toBe('yes, we do driveways and private roads.')
 })
 it.each(['introduce Monkey Trucking and acknowledge the preferred time','tell the customer the tool_results','respond with an acknowledgment'])('rejects internal text: %s',text=>expect(()=>assertCustomerText(text)).toThrow('Internal response'))
 it('explains actual route/load fees and installation without repeating a known address',()=>{
   const reply=composeConversationResponse({detected_language:'ENGLISH',response_plan:plan},{status:'MATERIAL_CALCULATED',delivery_total:300,grand_total:1200,delivery_miles:15,delivery_loads:2,conversation:{address:'123 Oak Road'}})
   expect(reply).toContain('$300.00');expect(reply).toContain('15 miles');expect(reply).toContain('2 loads');expect(reply).toContain('not installation');expect(reply).not.toContain('What is your delivery address')
 })
 it('keeps a captured address during a transient routing failure',()=>{
   const reply=composeConversationResponse({detected_language:'ENGLISH',response_plan:plan},{status:'MATERIAL_CALCULATED',route:{status:'UNAVAILABLE'},conversation:{address:'123 Oak Road'}})
   expect(reply).toContain('no need to send it again');expect(reply).not.toContain('What is your delivery address')
 })
 it('reuses only server-resolved recent routes and recalculates fees',async()=>{
   const fetcher=vi.fn(async()=>new Response(JSON.stringify({routes:[{distanceMeters:16093.44}],geocodingResults:{destination:{geocoderStatus:{}}}})))
   vi.stubGlobal('fetch',fetcher)
   const input={messages:[{sender_type:'CUSTOMER',body:'867 Cache Road, Test TX 75001'}],state:null,quotes:[],enabled:true,apiKey:'fixture',settings:{company_address:'Yard',delivery_tier_1_max_miles:20,delivery_tier_1_fee:100}}
   expect(await calculateDeliveryRoute(input)).toMatchObject({status:'ROUTE_CALCULATED',delivery_fee_per_load:100})
   expect(await calculateDeliveryRoute({...input,settings:{...input.settings,delivery_tier_1_fee:200}})).toMatchObject({cached:true,delivery_fee_per_load:200})
   expect(fetcher).toHaveBeenCalledTimes(1)
 })
})
