import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { configuredAi } from '../_shared/ai-config.ts'
import { runCommunicationJob } from '../_shared/communication-worker.ts'
import { dispatchSms } from '../_shared/sms-dispatch.ts'
import { workerAuthorized } from '../_shared/worker-auth.ts'

const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})

Deno.serve(async(req) => {
  const requestStarted=Date.now()
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
    const input=await req.json().catch(()=>({})) as {jobId?:unknown,messageId?:unknown}
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const jobId=typeof input.jobId==='string'&&uuid.test(input.jobId)?input.jobId:null
    const messageId=typeof input.messageId==='string'&&uuid.test(input.messageId)?input.messageId:null
    if ((input.jobId!=null&&!jobId)||(input.messageId!=null&&!messageId)) return json({error:'Invalid processing target'},400)
    const targeted=Boolean(jobId||messageId)
    const planned=targeted?{data:0,error:null}:await service.rpc('plan_communication_jobs')
    if (planned.error) throw new Error('Communication scheduling failed')
    const runtime=await service.from('communication_runtime').select('ai_sending_enabled,scheduled_sending_enabled').eq('id',1).single()
    if (runtime.error) throw new Error('Runtime settings unavailable')
    let job:Awaited<ReturnType<typeof runCommunicationJob>>={processed:false}
    const apiKey=Deno.env.get('SENT_DM_API_KEY')
    // Run independently so a staff carrier timeout cannot delay customer SMS.
    const staffDispatch=apiKey&&!targeted
      ? dispatchSms(service,{apiKey,profileId:Deno.env.get('SENT_DM_PROFILE_ID'),internal:true,templateId:Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID')})
        .catch(()=>console.warn('Internal notification remains queued for reconciliation'))
      : Promise.resolve()
    const generationStarted=Date.now()
    if (jobId&&runtime.data.ai_sending_enabled) {
      job=await runCommunicationJob(service,await configuredAi(service),Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID'),jobId)
    } else if (!targeted&&(runtime.data.ai_sending_enabled||runtime.data.scheduled_sending_enabled)) {
      job=await runCommunicationJob(service,await configuredAi(service),Deno.env.get('SENT_DM_FIRST_CONTACT_TEMPLATE_ID'))
    }
    const generationMs=Date.now()-generationStarted
    const dispatchStarted=Date.now()
    let dispatches=0
    if (apiKey) {
      const exactMessageId=messageId??job.messageId??null
      if (exactMessageId) {
        const result=await dispatchSms(service,{apiKey,profileId:Deno.env.get('SENT_DM_PROFILE_ID')},exactMessageId)
        if(job.toolResults?.timings)Object.assign(job.toolResults.timings,result.timing??{}, {provider_accepted:result.accepted??false})
        if (result.dispatched) dispatches++
      } else if (!targeted) for(let n=0;n<2;n++) {
        const result=await dispatchSms(service,{apiKey,profileId:Deno.env.get('SENT_DM_PROFILE_ID')})
        if (!result.dispatched) break
        dispatches++
      }
    }
    await staffDispatch
    const timing={generation_ms:generationMs,dispatch_ms:Date.now()-dispatchStarted,total_ms:Date.now()-requestStarted}
    // Diagnostics must never cause a successful immutable send to be retried.
    if(job.auditId&&job.toolResults) {
      Object.assign(job.toolResults.timings,{worker_total_ms:timing.total_ms})
      if(job.toolResults.diagnostics)job.toolResults.diagnostics.timings=job.toolResults.timings
      try {
        const saved=await service.from('ai_audit_logs').update({tool_results:job.toolResults}).eq('id',job.auditId)
        if(saved.error)console.warn('Could not append transport diagnostics',{auditId:job.auditId})
      } catch { console.warn('Could not append transport diagnostics',{auditId:job.auditId}) }
    }
    console.info('communications worker timing',{jobId,messageId,processed:job.processed,dispatches,...timing})
    return json({planned:planned.data,job:{processed:job.processed,messageId:job.messageId},dispatches,timing})
  } catch(error) {
    console.error('communications worker failed',{total_ms:Date.now()-requestStarted,error:error instanceof Error?error.message:'Communications processing failed'})
    return json({error:error instanceof Error?error.message:'Communications processing failed'},503)
  }
})
