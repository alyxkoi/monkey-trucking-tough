import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { configuredAi, aiConfig } from '../_shared/ai-config.ts'
import { simulateConversation } from '../_shared/ai-sandbox.ts'
import { HttpError, requireStaff } from '../_shared/staff-auth.ts'
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info' }
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}})

async function availableModels(config: ReturnType<typeof aiConfig>) {
  const response=await fetch(`${config.baseUrl.replace(/\/$/,'')}/models`,{
    headers:{Authorization:`Bearer ${config.apiKey}`},signal:AbortSignal.timeout(10000),
  })
  if(!response.ok) throw new Error(`Connected provider model inventory returned ${response.status}`)
  const result=await response.json()
  return (result.data??[]).map((m:{id:string})=>m.id).filter((id:string)=>/^gpt-/.test(id)&&!/audio|realtime|image|transcrib|tts|search/.test(id)).sort() as string[]
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const actor=await requireStaff(service,req)
    const input=await req.json()
    const config=await configuredAi(service)
    if(input.action==='simulate')return json(await simulateConversation(service,input,config))
    if(input.action==='models')return json({models:await availableModels(config),current:config.model})
    if(input.action==='save'||input.action==='rollback'){
      const role=await service.from('user_roles').select('role').eq('user_id',actor.id).eq('role','admin').maybeSingle()
      if(role.error||!role.data)throw new HttpError(403,'Only an administrator can change the AI configuration')
      let values=input.settings
      if(input.action==='rollback'){
        const entry=await service.from('ai_operation_history').select('before_settings').eq('id',input.history_id).single()
        if(entry.error||!entry.data?.before_settings)throw new HttpError(400,'This entry has no settings to restore')
        values=entry.data.before_settings
      }
      if(!values||!['WARM','DIRECT','PROFESSIONAL'].includes(values.tone)||typeof values.concise!=='boolean'||typeof values.review_enabled!=='boolean')throw new HttpError(400,'Invalid presentation settings')
      const model=values.model||aiConfig().model
      if(model!==config.model){
        if(!(await availableModels(config)).includes(model))throw new HttpError(400,'Model is not available on the connected account')
        // Inventory alone does not prove structured Responses compatibility.
        await simulateConversation(service,{messages:[{sender_type:'CUSTOMER',body:'hello, I need some gravel'}]}, {...config,model})
      }
      const result=await service.rpc('save_ai_operation_settings',{
        p_actor:actor.id,p_expected_version:input.expected_version,p_model:values.model||null,
        p_tone:values.tone,p_concise:values.concise,p_review_enabled:values.review_enabled,
        p_rollback_id:input.action==='rollback'?input.history_id:null,
      })
      if(result.error)throw new Error(result.error.message)
      return json({settings:result.data})
    }
    if(input.action==='review'){
      const result=await service.rpc('review_ai_operations')
      if(result.error)throw new Error(result.error.message)
      return json(result.data)
    }
    if(input.action!=='status')throw new HttpError(400,'Unknown control action')
    const [settings,history,audit,runtime,channels,sync]=await Promise.all([
      service.from('ai_operation_settings').select('*').eq('id',1).single(),
      service.from('ai_operation_history').select('*').order('created_at',{ascending:false}).limit(20),
      service.from('ai_audit_logs').select('model_id,prompt_version,status,latency_ms,created_at,error_message').order('created_at',{ascending:false}).limit(10),
      service.from('communication_runtime').select('ai_sending_enabled,scheduled_sending_enabled,marketing_approved,timezone').eq('id',1).single(),
      service.from('control_center_settings').select('business_number,sms_status,calling_status,route_status,ai_english,ai_spanish,human_takeover_on_reply,initial_response_target_seconds,route_intelligence_enabled').eq('id',1).single(),
      service.from('communication_provider_sync').select('*'),
    ])
    if([settings,history,audit,runtime,channels,sync].some(r=>r.error))throw new Error('AI diagnostic data could not be loaded')
    return json({settings:settings.data,history:history.data,recent_runs:audit.data,runtime:runtime.data,channels:channels.data,
      provider_sync:sync.data, configured_model:config.model,provider:new URL(config.baseUrl).hostname,
      maps_key_configured:Boolean(config.googleMapsApiKey),prompt_version:'mt-ai-draft-v8',context_message_limit:80,
      immutable_rules:['Server calculated material prices and delivery tiers','Approximate tons conversion, internal one yard reserve','Only untouched draft quotes can be updated','STOP / START / HELP and consent gates','Human takeover and revision checks','One transient retry; fail closed for business decisions','12 replies per minute emergency burst guard; scheduled follow up limits unchanged'],
    })
  }catch(error){return json({error:error instanceof Error?error.message:'AI control failed'},error instanceof HttpError?error.status:502)}
})
