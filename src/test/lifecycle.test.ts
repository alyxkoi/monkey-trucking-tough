// @vitest-environment node
import { describe,it,expect } from 'vitest'
import { customerName,knownCustomerName,lifecycleContext,lifecycleProposal,lifecycleReply,resolveDeliveryPreference } from '../../supabase/functions/_shared/lifecycle'
import { activeAiInstructions,PROMPT_VERSION } from '../../supabase/functions/_shared/ai-engine'
const now=new Date('2026-09-15T23:30:00Z')
const lead={id:'lead'},quote={id:'q',lead_id:'lead',status:'ACCEPTED'},job={id:'j',quote_id:'q',status:'SCHEDULED',scheduled_date:'2026-09-20',scheduled_time:'09:00'}
const pricing={status:'MATERIAL_CALCULATED',yards:20,material_name:'Flexbase',grand_total:800,route:{status:'ROUTE_CALCULATED',destination:'123 Road, Kaufman, TX'}}
const decision={detected_language:'ENGLISH',uncertain_facts:[]}
function proposal(text:string,extra:Record<string,unknown>={}) {return lifecycleProposal({lead,customer:{name:'Mike',email:'mike@example.com'},messages:[{id:'m',sender_type:'CUSTOMER',body:text}],lifecycle:lifecycleContext(lead,[],[],[],[]),decision,pricing,now,...extra})}
describe('lifecycle projection and validated proposals',()=>{
  it.each([['tomorrow at noon','2026-09-16','12:00',false],['tomorrow around noon','2026-09-16','12:00',false],['Friday morning','2026-09-18',null,true],['next Monday','2026-09-21',null,true],['Saturday at 2pm','2026-09-19','14:00',false],['mañana al mediodía','2026-09-16','12:00',false],['Friday at 12','2026-09-18',null,true],['Friday between 6 and 8pm','2026-09-18','18:00',false]])('resolves %s in Chicago', (text,date,time,needsClarification)=>{
    expect(resolveDeliveryPreference(text as string,now)).toMatchObject({date,time,needsClarification})
  })
  it('uses the local date rather than the UTC date',()=>expect(resolveDeliveryPreference('tomorrow at noon',new Date('2026-09-16T03:00:00Z')).date).toBe('2026-09-16'))
  it('rejects impossible dates and ambiguous days',()=>{
    expect(resolveDeliveryPreference('2026-02-31 at noon',now).needsClarification).toBe(true)
    expect(resolveDeliveryPreference('Friday or Saturday at noon',now).needsClarification).toBe(true)
  })
  it.each(['hey this is Mike','my name is Mike','me llamo Mike','soy Mike'])('extracts explicit identity %s',text=>expect(customerName(text)).toBe('Mike'))
  it('accepts a short answer only to a name question',()=>{expect(customerName('Mike',true)).toBe('Mike');expect(customerName('Mike')).toBeNull();expect(customerName('yes',true)).toBeNull();expect(knownCustomerName('Unknown SMS +12145550000')).toBeNull();expect(knownCustomerName('Mike')).toBe('Mike')})
  it('does not attach another lead transaction',()=>expect(lifecycleContext(lead,[{...quote,lead_id:'other'}],[job],[],[]).stage).toBe('LEAD'))
  it.each([['SENT','QUOTE_SENT'],['ACCEPTED','SCHEDULING'],['DRAFT','QUOTING']])('derives %s', (status,stage)=>expect(lifecycleContext(lead,[{...quote,status}],[],[],[]).stage).toBe(stage))
  it('derives scheduled, completed and verified paid without trusting a label alone',()=>{
    expect(lifecycleContext(lead,[quote],[job],[],[]).stage).toBe('SCHEDULED')
    const completed={...job,status:'COMPLETED'},invoice={id:'i',job_id:'j',status:'PAID',amount:100}
    expect(lifecycleContext(lead,[quote],[completed],[invoice],[]).stage).toBe('PAYMENT')
    expect(lifecycleContext(lead,[quote],[completed],[invoice],[{invoice_id:'i',amount:100,confirmed_by:'staff'}]).stage).toBe('PAID')
  })
  it('confirms an exact email only from the customer or a yes to the exact address',()=>{
    expect(proposal('use other@example.com').confirmed_email).toBe('other@example.com')
    expect(proposal('yes').confirmed_email).toBeNull()
    expect(proposal('yes',{messages:[{sender_type:'AI',body:'send to mike@example.com?'},{sender_type:'CUSTOMER',body:'yes'}]}).confirmed_email).toBe('mike@example.com')
    expect(proposal('a@example.com or b@example.com').clarification).toBe('EMAIL')
  })
  it('requires all ready facts and explicit quote consent',()=>{
    const p=proposal('yes',{lead:{...lead,requested_delivery_date:'2026-09-16',requested_delivery_time:'12:00',quote_requested_at:'now'},messages:[{sender_type:'AI',body:'send to mike@example.com?'},{sender_type:'CUSTOMER',body:'yes'}]})
    expect(p.ready).toBe(true);expect(proposal('yes').ready).toBe(false)
  })
  it('recaps date and moves toward quote/email confirmation',()=>{
    const p=proposal('tomorrow at noon');expect(lifecycleReply(p,{reactive:false},decision,pricing)).toMatch(/20 yards.*2026-09-16.*12:00.*send the quote/)
    const ask=proposal('yes',{messages:[{sender_type:'AI',body:'would you like us to send the quote over?'},{sender_type:'CUSTOMER',body:'yes'}]})
    expect(lifecycleReply(ask,{reactive:false},decision,pricing)).toContain('mike@example.com')
  })
  it('protects accepted orders and calendar bookings with actions',()=>{
    const lifecycle=lifecycleContext(lead,[quote],[job],[],[])
    expect(proposal('actually change it to 30 yards',{lifecycle}).actions).toContain('ORDER_CHANGE')
    expect(proposal('tomorrow at noon',{lifecycle}).actions).toContain('SCHEDULE_CHANGE')
    expect(proposal('the address changed',{lifecycle}).actions).toContain('ADDRESS_CHANGE')
  })
  it('requires source evidence for model-proposed writes',()=>{
    expect(proposal('hello',{decision:{dashboard_plan:{intent:'JOB_NOTE',source_text:'gate 123',confidence:'HIGH'}}}).job_note).toBeNull()
    expect(proposal('gate code is 5521').job_note).toBe('gate code is 5521')
    expect(proposal('maybe',{decision:{dashboard_plan:{intent:'CONTACT',source_text:'maybe',confidence:'LOW'}}}).clarification).toBe('REQUEST')
  })
  it('exposes the same effective static instructions without credentials',()=>{
    const text=activeAiInstructions({tone:'WARM',concise:true});expect(PROMPT_VERSION).toContain('lifecycle');expect(text).toContain('CUSTOMER LIFECYCLE');expect(text).toContain('CONVERSATIONAL PLANNING');expect(text).not.toMatch(/sk-|apiKey|SUPABASE_SERVICE_ROLE_KEY/)
  })
})
