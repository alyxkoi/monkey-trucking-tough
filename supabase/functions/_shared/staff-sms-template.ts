/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpError } from './staff-auth.ts'

// sent.DM rejects line breaks inside variables. Put layout in the template,
// not a single multiline `message` parameter. Customer templates stay untouched.
export const STAFF_TEMPLATE = {
  category: 'UTILITY', language: 'en_US', submit_for_review: true,
  definition: { definitionVersion: '1.0', body: { multiChannel: {
    type: 'text',
    template: 'Monkey Trucking staff alert\n{{0:variable}}\n{{1:variable}}\n{{2:variable}}\n\nOpen: {{3:variable}}\nReply STOP to opt out.',
    variables: ['event','customer','detail','link'].map((name,id)=>({id,name,type:'variable',props:{variableType:'text',sample:['QUOTE READY','Tyrone · 20 yd Flexbase','$1,042.43 · Sep 22 at 3 PM','monkeytrucking.llc/a/1234567890'][id]}})),
  } } },
}

/** Only called by the authenticated, explicitly requested internal test action. */
export async function ensureStaffSmsTemplate(service:any, config:{apiKey:string;profileId?:string}, fetcher:typeof fetch=fetch) {
  const settings=await service.from('staff_sms_settings').select('enabled,opted_out_at,staff_template_id,staff_template_ready').eq('id',1).single()
  if(settings.error)throw new HttpError(503,'Staff SMS settings could not be read')
  if(!settings.data.enabled||settings.data.opted_out_at)throw new HttpError(409,'Staff alerts are disabled or opted out')
  if(settings.data.staff_template_ready&&settings.data.staff_template_id)return
  const headers:Record<string,string>={'x-api-key':config.apiKey,'Content-Type':'application/json'}
  if(config.profileId)headers['x-profile-id']=config.profileId
  let id=settings.data.staff_template_id as string|null
  if(!id){
    const created=await fetcher('https://api.sent.dm/v3/templates',{method:'POST',headers:{...headers,'Idempotency-Key':'mt_internal_staff_alert_layout_v1'},body:JSON.stringify(STAFF_TEMPLATE),signal:AbortSignal.timeout(20_000)})
    const body=await created.json().catch(()=>null)
    if(!created.ok||typeof body?.data?.id!=='string')throw new HttpError(503,`Staff template setup was not accepted (HTTP ${created.status}); no SMS sent`)
    id=body.data.id
    const saved=await service.from('staff_sms_settings').update({staff_template_id:id,staff_template_ready:false}).eq('id',1)
    if(saved.error)throw new HttpError(503,'Staff template created but could not be linked; retry uses the same setup operation')
  }
  const checked=await fetcher(`https://api.sent.dm/v3/templates/${encodeURIComponent(id!)}`,{headers,signal:AbortSignal.timeout(20_000)})
  const body=await checked.json().catch(()=>null)
  if(!checked.ok||body?.data?.status!=='APPROVED'||body.data.is_published!==true||!body.data.channels?.includes('sms'))throw new HttpError(409,'Staff layout template is awaiting provider SMS approval. No test sent; existing approved alert transport remains available.')
  const saved=await service.from('staff_sms_settings').update({staff_template_ready:true}).eq('id',1)
  if(saved.error)throw new HttpError(503,'Staff template approval could not be saved')
}
