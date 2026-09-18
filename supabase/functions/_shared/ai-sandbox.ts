/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateAiDraft, type AiConfig } from './ai-engine.ts'
import { autonomousReply } from './communication-worker.ts'
import { customerName, lifecycleContext, lifecycleProposal } from './lifecycle.ts'

// Deliberately separate from the real database client: the engine can read
// synthetic context only. No real lead ID, quote mutation, outbox or SMS path.
export async function simulateConversation(service: any, input: any, config: AiConfig) {
  // This ID is diagnostic only. It can never address a persisted lead/customer.
  const sessionId = typeof input.session_id==='string'&&/^[0-9a-f-]{36}$/i.test(input.session_id) ? input.session_id : crypto.randomUUID()
  const syntheticId = `sandbox:${sessionId}`
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 80
    || input.messages.some((m: any) => !['CUSTOMER','AI','HUMAN'].includes(m.sender_type) || typeof m.body !== 'string' || m.body.length > 1600)) {
    throw new Error('Provide 1 to 80 test messages, each at most 1600 characters.')
  }
  const [materials, app, control] = await Promise.all([
    service.from('materials').select('*').eq('is_active',true),
    service.from('app_settings').select('*').limit(1).single(),
    service.from('control_center_settings').select('*').eq('id',1).single(),
  ])
  if ([materials,app,control].some(r=>r.error)) throw new Error('Test configuration could not be loaded')
  const rows: Record<string, any> = {
    leads: { id:syntheticId, customer_id:syntheticId, human_takeover:Boolean(input.takeover)||input.messages.some((m:any)=>m.sender_type==='HUMAN'||m.sender_type==='AI'&&/^(got it, I will have Salvador take a look at this\.|claro, le aviso a Salvador para que revise su mensaje\.)$/.test(m.body)), conversation_revision:1, need:'Inbound SMS conversation', description:String(input.form ?? '').slice(0,2000) },
    customers: { id:syntheticId,name:'Test customer' },
    lead_messages: input.messages.map((m:any,i:number)=>({...m,id:String(i),created_at:new Date(Date.now()+i).toISOString()})).reverse(),
    ai_conversation_state: { known_facts:[],missing_facts:[],uncertain_facts:[] },
    quotes: [], jobs: [], invoices: [], payments: [], materials:materials.data,
    app_settings:app.data, control_center_settings:control.data,
  }
  const scenario=['LEAD','QUOTE_SENT','ACCEPTED','SCHEDULED','COMPLETED','PAID'].includes(input.scenario)?input.scenario:'LEAD'
  if(scenario!=='LEAD') {
    rows.customers.name='Sandbox customer';rows.customers.email='sandbox@example.test'
    rows.quotes=[{id:'sandbox-quote',lead_id:syntheticId,customer_id:syntheticId,status:scenario==='QUOTE_SENT'?'SENT':'ACCEPTED',description:'Sandbox delivery',address:'123 Fixture Road',grand_total:500}]
    if(materials.data?.[0])rows.quotes[0].quote_items=[{id:'sandbox-item',kind:'MATERIAL',material_id:materials.data[0].id,description:materials.data[0].name,yards:20,line_total:500}]
    if(['SCHEDULED','COMPLETED','PAID'].includes(scenario))rows.jobs=[{id:'sandbox-job',quote_id:'sandbox-quote',status:scenario==='SCHEDULED'?'SCHEDULED':'COMPLETED',scheduled_date:'2026-10-01',scheduled_time:'09:00',notes:'',address:'123 Fixture Road'}]
    if(scenario==='PAID'){rows.invoices=[{id:'sandbox-invoice',job_id:'sandbox-job',quote_id:'sandbox-quote',status:'PAID',amount:500}];rows.payments=[{invoice_id:'sandbox-invoice',amount:500,confirmed_by:'sandbox-staff'}]}
  }
  // Replay synthetic intake only; never accept production entity IDs.
  for(let n=0;n<input.messages.length-1;n++) {
    if(input.messages[n].sender_type!=='CUSTOMER')continue
    const prefix=input.messages.slice(0,n+1),name=customerName(prefix[n].body,/your name|su nombre/i.test(prefix[n-1]?.body??''))
    if(name)rows.customers.name=name
    const proposal=lifecycleProposal({lead:rows.leads,customer:rows.customers,messages:prefix,lifecycle:lifecycleContext(rows.leads,rows.quotes,rows.jobs,rows.invoices,rows.payments),decision:{},pricing:{}})
    if(proposal.email)rows.customers.email=proposal.email
    if(proposal.confirmed_email)rows.leads.quote_confirmed_email=proposal.confirmed_email
    if(proposal.lead_need)rows.leads.need=proposal.lead_need
    if(proposal.quote_requested)rows.leads.quote_requested_at=new Date().toISOString()
    if(proposal.requested_date&&(!proposal.clarification||proposal.clarification==='DATE_TIME')){const priorDate=rows.leads.requested_delivery_date;rows.leads.requested_delivery_date=proposal.requested_date;rows.leads.requested_delivery_time=proposal.requested_time??(priorDate===proposal.requested_date?rows.leads.requested_delivery_time:null)}
  }
  const fake = { from(table: string) {
    if (!(table in rows)) throw new Error('Sandbox blocked database access: '+table)
    const result = { data:rows[table],error:null }
    const chain:any = { then:(resolve:any)=>Promise.resolve(result).then(resolve) }
    for (const method of ['select','eq','order','limit','single','maybeSingle']) chain[method]=()=>chain
    return chain
  } }
  const result = await generateAiDraft(fake,{lead_id:syntheticId},null,config,{sandbox:true})
  let reply: string | null = null
  let blocked: string | null = null
  try { reply=result.decision.handoff_acknowledgement?(result.decision.detected_language==='SPANISH'?'claro, le aviso a Salvador para que revise su mensaje.':'got it, I will have Salvador take a look at this.'):autonomousReply(result.decision,result.tool_results.pricing) } catch(error) { blocked=error instanceof Error?error.message:'Human review needed' }
  return {...result, reply, blocked, session_id:sessionId, send_allowed:false, database_changes:false}
}
