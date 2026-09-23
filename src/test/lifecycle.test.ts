// @vitest-environment node
import { describe,it,expect } from 'vitest'
import { appendLeadMilestone,customerName,explicitFullRecap,isQuoteApproval,knownCustomerName,leadMilestoneQuestion,lifecycleContext,lifecycleProposal,lifecycleReply,resolveDeliveryPreference } from '../../supabase/functions/_shared/lifecycle'
import { activeAiInstructions,PROMPT_VERSION } from '../../supabase/functions/_shared/ai-engine'
const now=new Date('2026-09-15T23:30:00Z')
const lead={id:'lead'},quote={id:'q',lead_id:'lead',status:'ACCEPTED'},job={id:'j',quote_id:'q',status:'SCHEDULED',scheduled_date:'2026-09-20',scheduled_time:'09:00'}
const pricing={status:'MATERIAL_CALCULATED',yards:20,material_name:'Flexbase',material_total:700,delivery_total:100,tax_total:0,grand_total:800,route:{status:'ROUTE_CALCULATED',destination:'123 Road, Kaufman, TX'}}
const decision={detected_language:'ENGLISH',uncertain_facts:[]}
function proposal(text:string,extra:Record<string,unknown>={}) {return lifecycleProposal({lead,customer:{name:'Mike',email:'mike@example.com'},messages:[{id:'m',sender_type:'CUSTOMER',body:text}],lifecycle:lifecycleContext(lead,[],[],[],[]),decision,pricing,now,...extra})}
describe('lifecycle projection and validated proposals',()=>{
  it.each(['would you like us to prepare the quote?', 'Would you like me to prepare the quote for Salvador to review and send?', 'quiere que preparemos la cotización?'])('recognizes one approval to its own prompt: %s',question=>{
    expect(isQuoteApproval('yes',question)).toBe(true)
    expect(isQuoteApproval('no thanks',question)).toBe(false)
  })
  it('does not treat an unrelated yes or quote cancellation as permission',()=>{
    expect(isQuoteApproval('yes','is the driveway gravel?')).toBe(false)
    expect(isQuoteApproval('yes','would you like to cancel the quote?')).toBe(false)
    expect(isQuoteApproval("don't prepare the quote",'')).toBe(false)
  })
  it('retains earlier approval through quantity correction and finishes without more permission questions',()=>{
    const p=proposal('yes',{lead:{...lead,requested_delivery_date:'2026-09-16',requested_delivery_time:'10:00'},messages:[
      {sender_type:'AI',body:'would you like me to prepare the quote for Salvador to review and send?'},
      {sender_type:'CUSTOMER',body:'yes'}, {sender_type:'CUSTOMER',body:'actually make it 40 yards'},
      {sender_type:'AI',body:'i have mike@example.com. is that where you want us to send it?'}, {sender_type:'CUSTOMER',body:'yes'},
    ]})
    expect(p.quote_requested).toBe(true);expect(p.ready).toBe(true)
    expect(lifecycleReply(p,{reactive:false},decision,pricing)).toContain('ready for review')
    expect(lifecycleReply(p,{reactive:false},decision,pricing)).not.toContain('?')
    expect(leadMilestoneQuestion({proposal:p,lifecycle:{reactive:false},pricing,route:pricing.route,quantity:{status:'RESOLVED'},customer:{name:'Mike'},language:'ENGLISH'})).toBeNull()
  })
  it('does not persist an ambiguous date while asking for clarification',()=>{
    expect(proposal('Friday or Saturday at noon').requested_date).toBeNull()
  })
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
  it.each(['johnsmith@gmail.com John Smith','John Smith, johnsmith@gmail.com','johnsmith@gmail.com\nJohn Smith'])('collects email and name from either reply order: %s',text=>{
    const p=proposal(text,{customer:{name:'Unknown SMS +12145550000',email:null},lead:{...lead,quote_requested_at:'now',requested_delivery_date:'2026-09-16',requested_delivery_time:'10:00'},messages:[{sender_type:'AI',body:'what email should we send the quote to, and what name should we put it under?'},{sender_type:'CUSTOMER',body:text}]})
    expect(p).toMatchObject({name:'John Smith',email:'johnsmith@gmail.com',confirmed_email:'johnsmith@gmail.com',ready:true})
  })
  it('waits until quote collection to ask an unknown SMS customer for a name',()=>{
    const customer={name:'Unknown SMS +12145550000',email:null}
    const early=proposal('20 yards of flexbase',{customer})
    expect(leadMilestoneQuestion({proposal:early,lifecycle:{reactive:false},pricing,route:{destination:null},quantity:{status:'RESOLVED'},customer,language:'ENGLISH'})).toContain('delivery address')
    const agreed=proposal('yes',{customer,lead:{...lead,quote_requested_at:'now',requested_delivery_date:'2026-09-16',requested_delivery_time:'10:00'},messages:[{sender_type:'AI',body:'would you like us to prepare the quote?'},{sender_type:'CUSTOMER',body:'yes'}]})
    expect(lifecycleReply(agreed,{reactive:false},decision,pricing)).toBe('what email should we send the quote to, and what name should we put it under?')
    expect(agreed.ready).toBe(false)
  })
  it('asks only for the remaining quote identity detail and ignores acknowledgments',()=>{
    const customer={name:'Unknown SMS +12145550000',email:null}
    const base={customer,lead:{...lead,quote_requested_at:'now',requested_delivery_date:'2026-09-16',requested_delivery_time:'10:00'}}
    const emailOnly=proposal('johnsmith@gmail.com',{...base,messages:[{sender_type:'AI',body:'what email should we send the quote to, and what name should we put it under?'},{sender_type:'CUSTOMER',body:'johnsmith@gmail.com'}]})
    expect(emailOnly.name).toBeNull();expect(emailOnly.ready).toBe(false)
    expect(lifecycleReply(emailOnly,{reactive:false},decision,pricing)).toBe('what name should we put on the quote?')
    const nameOnly=proposal('John Smith',{...base,messages:[{sender_type:'AI',body:'what email should we send the quote to, and what name should we put it under?'},{sender_type:'CUSTOMER',body:'John Smith'}]})
    expect(nameOnly.name).toBe('John Smith');expect(nameOnly.email).toBeNull()
    expect(lifecycleReply(nameOnly,{reactive:false},decision,pricing)).toBe('what email should we send the quote to?')
    expect(customerName("it's okay",true)).toBeNull()
    expect(customerName('yes please',true)).toBeNull()
    expect(lifecycleReply(proposal('johnsmith@gmail.com',{...base,customer:{name:'John Smith',email:null},messages:[{sender_type:'AI',body:'what email should we send the quote to?'},{sender_type:'CUSTOMER',body:'johnsmith@gmail.com'}]}),{reactive:false},decision,pricing)).toContain('ready for review')
  })
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
  it('keeps quote-recipient email separate from an explicit profile update',()=>{
    expect(proposal('send it to quote@example.com').confirmed_email).toBe('quote@example.com')
    const contact=proposal('change my account email to profile@example.com',{decision:{...decision,dashboard_plan:{intent:'CONTACT',source_text:'change my account email to profile@example.com',confidence:'HIGH'}}})
    expect(contact.email).toBe('profile@example.com');expect(contact.confirmed_email).toBeNull()
  })
  it('promotes a normal first quote email but keeps an explicit alternate recipient quote-only',()=>{
    const normalEmail=proposal('mike@example.com',{customer:{name:'Mike',email:null},messages:[{id:'ai',sender_type:'AI',body:'what email should we send the quote to?'},{id:'m',sender_type:'CUSTOMER',body:'mike@example.com'}]})
    expect(normalEmail.email).toBe('mike@example.com');expect(normalEmail.confirmed_email).toBe('mike@example.com')
    const alternate=proposal('send this quote to alternate@example.com',{messages:[{id:'m',sender_type:'CUSTOMER',body:'send this quote to alternate@example.com'}]})
    expect(alternate.email).toBeNull();expect(alternate.confirmed_email).toBe('alternate@example.com')
  })
  it('classifies material delivery and lets later pickup or service clarification replace it',()=>{
    const quantity={status:'RESOLVED',material_name:'Flexbase',yards:32}
    const delivery=proposal('how much for 32 yards of flexbase?',{pricing:{...pricing,quantity},messages:[{id:'first',sender_type:'CUSTOMER',body:'how much for 32 yards of flexbase?'}]})
    expect(delivery.lead_need).toBe('material-delivery')
    const pickup=proposal('actually I will pick it up',{pricing:{...pricing,quantity},messages:[{id:'first',sender_type:'CUSTOMER',body:'how much for 32 yards of flexbase?'},{id:'pickup',sender_type:'CUSTOMER',body:'actually I will pick it up'}]})
    expect(pickup.lead_need).toBe('material-pickup');expect(pickup.lead_need_source_message_id).toBe('pickup')
    const driveway=proposal('I actually need you to regrade my driveway',{pricing:{...pricing,quantity},messages:[{id:'first',sender_type:'CUSTOMER',body:'how much for 32 yards of flexbase?'},{id:'service',sender_type:'CUSTOMER',body:'I actually need you to regrade my driveway'}]})
    expect(driveway.lead_need).toBe('driveway')
  })
  it('enforces one deterministic lead milestone after the useful answer',()=>{
    const p=proposal('how much is gravel?')
    const question=leadMilestoneQuestion({proposal:p,lifecycle:{reactive:false},pricing:{},route:{status:'NOT_READY'},quantity:{status:'NEEDS_QUANTITY',material_name:'Flexbase'},customer:{name:'Mike'},language:'ENGLISH'})
    expect(appendLeadMilestone('Flexbase is available.',question)).toBe('Flexbase is available. how many yards of Flexbase do you need?')
    expect(appendLeadMilestone('What address should we use?',question)).toBe('What address should we use?')
  })
  it('only permits a full recap when the customer actually asks for one',()=>{
    expect(explicitFullRecap('what information do you have so far?')).toBe(true)
    expect(explicitFullRecap('yes that is fine')).toBe(false)
    expect(explicitFullRecap('change the address to 123 Oak Road')).toBe(false)
  })
  it('recaps date and moves toward quote/email confirmation',()=>{
    const p=proposal('tomorrow at noon');expect(lifecycleReply(p,{reactive:false},decision,pricing)).toMatch(/20 yards.*Sep 16.*12:00 PM.*total \$800.00.*prepare the quote/)
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
