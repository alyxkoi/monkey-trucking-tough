/* eslint-disable @typescript-eslint/no-explicit-any */
/** Best-effort telemetry, never a condition of acknowledging a committed SMS. */
export async function recordInboundTiming(service:any,messageId:string,source:'WEBHOOK'|'RECONCILIATION',started:number,ingestStarted:number,occurredAt:string) {
  const finished=Date.now()
  const timings={ingress_source:source,ingress_started_at:new Date(started).toISOString(),
    provider_to_ingress_ms:Math.max(0,started-Date.parse(occurredAt)),
    ingress_before_commit_ms:ingestStarted-started,ingestion_ms:finished-ingestStarted,
    ...(source==='WEBHOOK'?{webhook_arrived_at:new Date(started).toISOString(),provider_to_webhook_ms:Math.max(0,started-Date.parse(occurredAt))}:{})}
  try {
    const result=await service.from('sms_webhook_events').update({ingress_timings:timings})
      .eq('provider','SENT_DM').eq('provider_message_id',messageId).eq('message_status','RECEIVED').is('ingress_timings',null)
    if(result.error)console.warn('Inbound timing could not be saved',{messageId,source})
  } catch { console.warn('Inbound timing could not be saved',{messageId,source}) }
}
