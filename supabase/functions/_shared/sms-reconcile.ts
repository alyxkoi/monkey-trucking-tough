/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeSentDmStatus } from './sent-dm-domain.ts'
import type { SmsProviderConfig } from './sms-dispatch.ts'

/** One-off operator reconciliation, not a second polling loop or a resend. */
export async function reconcileSms(service:any,config:SmsProviderConfig,messageId:string,leadId:string|null,fetcher:typeof fetch=fetch,background=false) {
  const row=config.internal
    ? await service.from('staff_sms_outbox').select('provider_message_id,delivery_status').eq('message_id',messageId).single()
    : await service.from('lead_messages').select('provider_message_id,customer_id,delivery_status').eq('id',messageId).eq('lead_id',leadId).eq('provider','SENT_DM').single()
  if(row.error||!row.data?.provider_message_id) throw new Error('A linked provider message is required')
  const headers:Record<string,string>={'x-api-key':config.apiKey}
  if(config.profileId) headers['x-profile-id']=config.profileId
  const response=await fetcher(`https://api.sent.dm/v3/messages/${encodeURIComponent(row.data.provider_message_id)}`,{headers,signal:AbortSignal.timeout(15_000)})
  if(!response.ok) throw new Error(`Provider status lookup failed (${response.status})`)
  const body=await response.json()
  const status=normalizeSentDmStatus(body?.data?.status)
  if(body?.data?.id!==row.data.provider_message_id||String(body?.data?.direction).toUpperCase()!=='OUTBOUND'||body?.data?.channel!=='sms'||!status||status==='RECEIVED') throw new Error('Provider status response did not match this SMS')
  const events=(Array.isArray(body.data.events)?body.data.events:[]).map((event:any)=>({
    status:normalizeSentDmStatus(event.status),timestamp:event.timestamp,description:typeof event.description==='string'?event.description.slice(0,500):null,
  }))
  const reason=events.findLast((event:any)=>event.status===status)?.description??null
  const result=await service.rpc('apply_sms_delivery_status',{p_provider_message_id:row.data.provider_message_id,p_provider_status:status,p_error_message:reason})
  if(result.error) throw new Error('Provider status could not be saved')
  if (!background || row.data.delivery_status !== result.data.delivery_status) {
    const audit=await service.from('activity_history').insert({customer_id:config.internal?null:row.data.customer_id,entity_type:config.internal?'SYSTEM':'LEAD',entity_id:config.internal?null:leadId,event_type:config.internal?'STAFF_SMS_RECONCILED':'SMS_RECONCILED',summary:'SMS status verified directly with sent.DM',actor_label:background?'Communications worker':'Dashboard staff',metadata:{message_id:messageId,provider_status:status}})
    if(audit.error) throw new Error('Status saved but reconciliation audit could not be recorded')
  }
  return {success:true,messageId,status:result.data.delivery_status,events}
}

/** Runs under the existing provider reconciliation schedule, not a new timer. */
export async function reconcileAcceptedSms(service:any,config:SmsProviderConfig,fetcher:typeof fetch=fetch) {
  const claim=await service.rpc('claim_sms_receipt_checks')
  if (claim.error) return {checked:0,errors:['Receipt checks could not be claimed']}
  const rows=Array.isArray(claim.data)?claim.data:[]
  const errors:string[]=[]
  const boundedFetch:typeof fetch=(url,init)=>fetcher(url,{...init,signal:AbortSignal.timeout(8_000)})
  await Promise.all(rows.map(async (row:any)=>{
    try { await reconcileSms(service,{...config,internal:row.internal===true},row.message_id,row.lead_id??null,boundedFetch,true) }
    catch(error) {errors.push(error instanceof Error?error.message:'Receipt lookup failed')}
  }))
  return {checked:rows.length,errors}
}
