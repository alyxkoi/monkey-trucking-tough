import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { aiConfig } from '../_shared/ai-config.ts'
import { runCommunicationJob } from '../_shared/communication-worker.ts'
import { dispatchSms } from '../_shared/sms-dispatch.ts'
import { workerAuthorized } from '../_shared/worker-auth.ts'

const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})

Deno.serve(async(req) => {
  if (req.method!=='POST') return json({error:'Method not allowed'},405)
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const url=Deno.env.get('SUPABASE_URL')
  const secret=Deno.env.get('COMMUNICATIONS_WORKER_SECRET')
  const authorization=req.headers.get('Authorization')??''
  const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
  // Verify the actual credential, not a decoded, unsigned JWT role claim.
  if (!key || !url || !token) return json({error:'Unauthorized'},401)
  const service=createClient(url,key)
  if (!await workerAuthorized(service,token,key,secret)) return json({error:'Unauthorized'},401)
  try {
    const planned=await service.rpc('plan_communication_jobs')
    if (planned.error) throw new Error('Communication scheduling failed')
    const runtime=await service.from('communication_runtime').select('ai_sending_enabled,scheduled_sending_enabled').eq('id',1).single()
    if (runtime.error) throw new Error('Runtime settings unavailable')
    let job={processed:false}
    if (runtime.data.ai_sending_enabled||runtime.data.scheduled_sending_enabled) {
      job=await runCommunicationJob(service,aiConfig(),Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID'))
    }
    const apiKey=Deno.env.get('SENT_DM_API_KEY')
    let dispatches=0
    if (apiKey) for(let n=0;n<2;n++) {
      const result=await dispatchSms(service,{apiKey,profileId:Deno.env.get('SENT_DM_PROFILE_ID')})
      if (!result.dispatched) break
      dispatches++
    }
    return json({planned:planned.data,job,dispatches})
  } catch(error) {
    return json({error:error instanceof Error?error.message:'Communications processing failed'},503)
  }
})
