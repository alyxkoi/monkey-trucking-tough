/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateAiDraft, type AiConfig } from './ai-engine.ts'
import { autonomousReply } from './communication-worker.ts'

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
    leads: { id:syntheticId, customer_id:syntheticId, human_takeover:Boolean(input.takeover), conversation_revision:1, description:String(input.form ?? '').slice(0,2000) },
    customers: { id:syntheticId,name:'Test customer' },
    lead_messages: input.messages.map((m:any,i:number)=>({...m,id:String(i),created_at:new Date(Date.now()+i).toISOString()})).reverse(),
    ai_conversation_state: { known_facts:[],missing_facts:[],uncertain_facts:[] },
    quotes: [], jobs: [], invoices: [], payments: [], materials:materials.data,
    app_settings:app.data, control_center_settings:control.data,
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
  try { reply=autonomousReply(result.decision,result.tool_results.pricing) } catch(error) { blocked=error instanceof Error?error.message:'Human review needed' }
  return {...result, reply, blocked, session_id:sessionId, send_allowed:false, database_changes:false}
}
