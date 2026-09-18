/* eslint-disable @typescript-eslint/no-explicit-any */
import { appendLeadMilestone, leadMilestoneQuestion, lifecycleReply } from './lifecycle.ts'

export function needsDeliveryReservation(proposal:any,lifecycle:any,pricing:any,lead:any) {
  return !lifecycle.reactive && !lifecycle.protected && !proposal.clarification
    && proposal.current.date && proposal.current.time
    && pricing.status==='MATERIAL_CALCULATED' && pricing.route?.status==='ROUTE_CALCULATED'
    && (proposal.lead_need??lead.need)!=='material-pickup'
    && (proposal.requested_date || proposal.requested_time || proposal.progress)
}

export function deliverySlotReply(slot:any,proposal:any,lifecycle:any,pricing:any,customer:any,language:string) {
  const es=language==='SPANISH'
  if(!slot||slot.status==='UNAVAILABLE')return es
    ?'tengo su horario preferido. no pude verificar el calendario ahora, así que todavía no está confirmado.'
    :'I have your preferred time. I couldn’t check the calendar right now, so it isn’t confirmed yet.'
  if(slot.status==='PAST')return es?'esa hora ya pasó. qué otra fecha y hora le funcionan?':'that time has already passed. what other date and time work for you?'
  if(slot.status==='CONFLICT')return es?'ya tenemos trabajo muy cerca de esa hora. qué otra hora le funciona?':'we already have work too close to that time. what other time works for you?'
  const label=new Intl.DateTimeFormat(es?'es-US':'en-US',{timeZone:'UTC',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(`${proposal.current.date}T${String(proposal.current.time).slice(0,5)}:00Z`))
  const acknowledgement=es?`sí, ${label} está disponible. le reservé ese horario mientras preparamos la cotización.`:`yes, ${label} works. I’ve reserved that time while we prepare the quote.`
  if(proposal.ready)return es?'perfecto, su horario está reservado y la cotización está lista para revisión.':'perfect, your time is reserved and your quote is ready for review.'
  const milestone=lifecycleReply(proposal,lifecycle,{detected_language:language},pricing)??leadMilestoneQuestion({proposal,lifecycle,pricing,route:pricing.route,quantity:pricing.quantity,customer,language})
  // The final verified recap already includes the time and destination. Avoid
  // repeating both in a long SMS, while stating what was actually reserved.
  return appendLeadMilestone(milestone&&/Material \$/.test(milestone)
    ? (es?'horario reservado.':'time reserved.') : acknowledgement,milestone)
}
