/* eslint-disable @typescript-eslint/no-explicit-any */
// Lifecycle is a projection of business records, never a second state machine.
export const LIFECYCLE_POLICY = `CUSTOMER LIFECYCLE AND DASHBOARD AUTHORITY
Use lifecycle.stage and its scoped quote/job/invoice, never another transaction belonging to the same customer.
LEAD/QUOTING: answer useful questions, collect missing specifications and name naturally. Known names are not asked again.
QUOTE_READY: offer the quote, confirm the exact email, then prepare an eligible draft for staff Review & Send. Never send or accept a quote yourself.
QUOTE_SENT: respond to questions; do not restart qualification or offer the same quote again.
ACCEPTED/SCHEDULING: collect requested delivery details, not new qualification. These and later stages are established relationships: never reintroduce Monkey Trucking merely because the supplied transcript is empty.
SCHEDULED/IN_PROGRESS: react to the customer. Arrival answers use the actual calendar. Gate/access instructions may become job notes. Date, quantity, material and address changes are staff requests, never silent calendar/financial edits.
COMPLETED/PAYMENT/PAID: use real invoice and payment records; a customer claim is not a confirmed payment. Do not keep selling the completed order.
RETURNING: new work belongs to a fresh lead linked to the same phone/customer, never an alteration of a historical quote.
Only validated server tools persist customer facts, eligible draft preparation, notes and staff action events. Name/email never identify or merge customers.
Acknowledging a requested order/address/schedule change is safe intake, not financial authorization. Keep that staff approval as a subtask while acknowledging the exact request. Do not stop the whole conversation merely because accepted terms cannot be changed by AI. Actual disputes, negotiation, payment claims, uncertain claims and human takeover still stop autonomous sending.
dashboard_plan contains intent and exact source wording from the latest customer text. When ambiguous, clarify before writing. Dates are resolved by the server in America/Chicago. Morning/afternoon without an exact time require a time clarification. A preference is not a booking.
Quote readiness requires current deterministic material/route/pricing, requested date/time, explicit quote request and confirmed current email. Staff remains responsible for sending.
Explicit human requests receive one brief acknowledgment through the guarded outbox; normal AI then pauses. Other global safety/financial escalations fail closed. Custom work remains an independent staff subtask.
Existing consent, compliance, revision, duplicate, pricing and manual-override protections always win. Run only on customer/business events, due automations or explicit sandbox requests.`

export const dashboardPlanSchema = {
  type:'object',additionalProperties:false,
  required:['intent','source_text','confidence'],
  properties:{intent:{type:'string',enum:['NONE','CONTACT','DELIVERY_PREFERENCE','JOB_NOTE','QUOTE_REQUEST','CONFIRM_EMAIL','ORDER_CHANGE','SCHEDULE_CHANGE','ARRIVAL','NEW_WORK','PAYMENT_CLAIM','HUMAN_REQUEST']},source_text:{type:'string'},confidence:{type:'string',enum:['HIGH','LOW']}},
}

export function lifecycleContext(lead:any, quotes:any[], jobs:any[], invoices:any[], payments:any[]) {
  const quote=quotes.find(q=>q.lead_id===lead?.id&&!['VOID','DECLINED'].includes(q.status))??null
  const job=quote?jobs.find(j=>j.quote_id===quote.id&&j.status!=='CANCELLED')??null:null
  const invoice=invoices.find(i=>i.status!=='VOID'&&(job&&i.job_id===job.id||quote&&i.quote_id===quote.id))??null
  const paid=invoice?.status==='PAID'&&payments.filter(p=>p.invoice_id===invoice.id&&!p.voided_at&&p.confirmed_by).reduce((n,p)=>n+Number(p.amount),0)>=Number(invoice.amount)
  const stage=paid?'PAID':job?.status==='COMPLETED'?(invoice?'PAYMENT':'COMPLETED'):job?.status==='IN_PROGRESS'?'IN_PROGRESS':job?.status==='SCHEDULED'?'SCHEDULED':quote?.status==='ACCEPTED'?'SCHEDULING':quote?.status==='SENT'?'QUOTE_SENT':quote?.ai_ready_at?'QUOTE_READY':quote?'QUOTING':'LEAD'
  return {stage,quote,job,invoice,paid:Boolean(paid),protected:!!quote&&quote.status!=='DRAFT',reactive:['QUOTE_SENT','SCHEDULING','SCHEDULED','IN_PROGRESS','COMPLETED','PAYMENT','PAID'].includes(stage)}
}

export function knownCustomerName(value:unknown) {
  const name=String(value??'').trim()
  return name&&!/^(?:unknown|test customer|sms |\+?\d)/i.test(name)?name:null
}
export function customerName(text:string, asked=false) {
  const prefix=/\b(?:my name is|me llamo|mi nombre es|this is|soy)\s+([\p{L}][\p{L}'’]*(?:\s+[\p{L}][\p{L}'’]*){0,3})(?=[,.!?]|\s+(?:and|y|i need|necesito)\b|$)/iu
  const name=text.match(prefix)?.[1]??(asked&&/^[\p{L}][\p{L}'’]*(?:\s+[\p{L}][\p{L}'’]*){0,3}[.!]?$/u.test(text.trim())?text.trim().replace(/[.!]$/,''):null)
  return name&&!/\b(need|want|gravel|ready|yes|no|hola|thanks|necesito|quiero|listo|too|much|expensive|cheap|confusing|wrong|correct|great|good|fine|bad|a|the)\b/i.test(name)&&name.length<=80?name:null
}

const dayNames=['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const spanishDays=['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export function resolveDeliveryPreference(text:string, now=new Date(), timezone='America/Chicago', previousDate?:string) {
  const t=normal(text)
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  const get=(k:string)=>parts.find(p=>p.type===k)!.value
  const today=`${get('year')}-${get('month')}-${get('day')}`
  const base=new Date(today+'T12:00:00Z')
  let date:string|null=null,time:string|null=null,ambiguous=false
  const explicit=t.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if(explicit){date=explicit[1];if(!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)ambiguous=true}
  else if(/\b(tomorrow|manana)\b/.test(t)&&!/(por la|en la) manana/.test(t)){base.setUTCDate(base.getUTCDate()+1);date=base.toISOString().slice(0,10)}
  else if(/\b(today|hoy)\b/.test(t))date=today
  else {
    const days=dayNames.map((d,i)=>new RegExp(`\\b(${d}|${spanishDays[i]})\\b`).test(t)?i:-1).filter(i=>i>=0)
    if(days.length>1)ambiguous=true
    else if(days.length===1){let delta=(days[0]-base.getUTCDay()+7)%7;if(delta===0)delta=7;base.setUTCDate(base.getUTCDate()+delta);date=base.toISOString().slice(0,10)}
  }
  if(/\b(noon|mediodia)\b/.test(t))time='12:00'
  else {
    const match=t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:to|a|hasta|and|y|-)\s*\d{1,2}(?::\d{2})?\s*(am|pm)\b/)
      ??t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
    if(match){const h=Number(match[1]),m=Number(match[2]??0);if(h<1||h>12||m>59)ambiguous=true;else time=`${String(h%12+(match[3]==='pm'?12:0)).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
    else if(/\b(at|a las|around)\s+\d|\b(morning|afternoon|evening|manana|tarde|noche)\b/.test(t)&&date)ambiguous=true
  }
  if(!date&&time&&previousDate)date=previousDate
  if(date&&(!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date))ambiguous=true
  if(date&&date<today)ambiguous=true
  if(date===today&&time){const hm=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);if(time<=hm)ambiguous=true}
  return {date,time,text:text.slice(0,200),needsClarification:ambiguous||!!date&&!time||!!time&&!date}
}

export function lifecycleProposal(input:{lead:any;customer:any;messages:any[];lifecycle:any;decision:any;pricing:any;now?:Date;timezone?:string}) {
  const {lead,customer,messages,lifecycle,decision,pricing}=input
  const inbound=[...messages].reverse().find(m=>m.sender_type==='CUSTOMER')
  const text=String(inbound?.body??'').trim()
  const lastAi=[...messages].reverse().find(m=>m.sender_type==='AI')?.body??''
  const plan=decision.dashboard_plan
  const trustedPlan=plan?.confidence==='HIGH'&&typeof plan.source_text==='string'&&plan.source_text.trim()&&text.includes(plan.source_text)
  const intent=trustedPlan?plan.intent:'NONE'
  const yes=/^(?:yes|yeah|yep|sure|ok(?:ay)?|si|sí|claro|correct|correcto|please do|send it)[.!\s]*$/i.test(text)
  const emails=[...text.matchAll(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}\b/gi)].map(m=>m[0])
  const email=emails.length===1&&!/\bor\b|\bo\b|maybe|perhaps|quizas/i.test(text)?emails[0]:null
  const name=customerName(text,/\b(your name|su nombre|tu nombre|se llama|te llamas)\b/i.test(lastAi))
  const dateRelevant=['DELIVERY_PREFERENCE','SCHEDULE_CHANGE'].includes(intent)||/\b(tomorrow|noon|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miercoles|jueves|viernes|sabado|domingo|mediodia)\b/i.test(normal(text))||/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/i.test(text)
  // A date-only clarification is not a booking/write. Recover its unambiguous
  // date from the immediately preceding customer preference when time arrives.
  const priorText=[...messages].slice(0,-1).reverse().find(m=>m.sender_type==='CUSTOMER')
  const priorPreference=priorText?resolveDeliveryPreference(priorText.body,priorText.created_at?new Date(priorText.created_at):input.now,input.timezone):null
  const previousDate=priorPreference?.date??lead.requested_delivery_date
  const preference=dateRelevant?resolveDeliveryPreference(text,input.now,input.timezone,previousDate):null
  const quoteRequested=Boolean(lead.quote_requested_at)||intent==='QUOTE_REQUEST'&&/\b(quote|estimate|cotizacion|presupuesto|send it|mandala|enviala)\b/i.test(normal(text))||yes&&/\b(send.*quote|quote.*over|envi.*cotizaci|mand.*cotizaci)\b/i.test(lastAi)
  const confirmedEmail=email??(yes&&customer.email&&lastAi.includes(customer.email)?customer.email:null)
  const requestedDate=preference?.date??lead.requested_delivery_date
  const requestedTime=preference?.date&&preference.date!==lead.requested_delivery_date?preference.time:preference?.time??lead.requested_delivery_time
  const emailConfirmed=confirmedEmail??(lead.quote_confirmed_email===customer.email?lead.quote_confirmed_email:null)
  const ready=!lifecycle.protected&&quoteRequested&&emailConfirmed&&requestedDate&&requestedTime&&!preference?.needsClarification&&pricing.status==='MATERIAL_CALCULATED'&&pricing.route?.status==='ROUTE_CALCULATED'&&Number.isFinite(pricing.grand_total)&&!decision.uncertain_facts?.length
  const note=intent==='JOB_NOTE'&&trustedPlan?plan.source_text.slice(0,500):/\b(gate code|back entrance|side gate|call me when|codigo.*porton|entrada trasera|llamame cuando)\b/i.test(normal(text))?text.slice(0,500):null
  const financialChange=lifecycle.protected&&(intent==='ORDER_CHANGE'||/\b(changed?|instead|actually|more|cambia|mejor|mas)\b/i.test(normal(text))&&/\b(yards?|tons?|material|address|yardas|toneladas|direccion)\b/i.test(normal(text)))
  const actions:string[]=[]
  if(financialChange)actions.push(/address|direccion/i.test(normal(text))?'ADDRESS_CHANGE':'ORDER_CHANGE')
  if(lifecycle.protected&&preference&&!preference.needsClarification)actions.push('SCHEDULE_CHANGE')
  if(decision.current_custom_work_request)actions.push('CUSTOM_WORK')
  if(decision.payment_claim_detected)actions.push('PAYMENT_CLAIM')
  if(/complaint|Customer complaint/i.test(decision.escalation_reason??''))actions.push('COMPLAINT')
  if(lifecycle.stage==='PAID'&&intent==='NEW_WORK')actions.push('NEW_WORK')
  return {source_message_id:inbound?.id,name,email,confirmed_email:confirmedEmail,quote_requested:quoteRequested,
    requested_date:preference?.date,requested_time:preference?.time,requested_text:preference?.text,
    job_note:financialChange?null:note,ready:Boolean(ready),actions,clarification:emails.length>1?'EMAIL':preference?.needsClarification?'DATE_TIME':plan?.confidence==='LOW'?'REQUEST':null,
    intent,progress:yes||Boolean(email)||Boolean(preference)||intent==='QUOTE_REQUEST',context:{stage:lifecycle.stage,quote_id:lifecycle.quote?.id,job_id:lifecycle.job?.id,invoice_id:lifecycle.invoice?.id,request:text,requested_date:preference?.date,requested_time:preference?.time,pricing},
    current:{name:name??knownCustomerName(customer.name),email:emailConfirmed,contact_email:customer.email,date:requestedDate,time:requestedTime},
  }
}

export function lifecycleReply(proposal:any,lifecycle:any,decision:any,pricing:any) {
  const es=decision.detected_language==='SPANISH'
  const choose=(en:string,sp:string)=>es?sp:en
  if(proposal.clarification)return choose(proposal.clarification==='EMAIL'?'which exact email should we use?':proposal.clarification==='DATE_TIME'?'what exact date and time should I note, including morning or afternoon?':'could you clarify exactly what you would like changed?',proposal.clarification==='EMAIL'?'cuál correo exacto debemos usar?':proposal.clarification==='DATE_TIME'?'qué fecha y hora exactas prefiere, por la mañana o por la tarde?':'puede aclarar exactamente qué quiere cambiar?')
  if(proposal.actions.includes('NEW_WORK'))return choose('we can help with another project. what material and how many yards do you need?','podemos ayudarle con otro proyecto. qué material y cuántas yardas necesita?')
  if(proposal.actions.includes('SCHEDULE_CHANGE'))return choose(`got it, ${proposal.requested_date} around ${proposal.requested_time}. I'll have the team confirm that time. your current schedule stays the same until then.`,`anotado, ${proposal.requested_date} alrededor de las ${proposal.requested_time}. el equipo confirmará esa hora. su horario actual sigue igual mientras tanto.`)
  if(proposal.actions.includes('ORDER_CHANGE')) {
    const extra=additionalYards(proposal.context.request)
    if(extra)return choose(`got it, you may need ${extra} more yards. I'll have Salvador review the updated amount and price. your current order stays the same until that's confirmed.`,`anotado, puede necesitar ${extra} yardas más. Salvador revisará la cantidad y el precio. su pedido actual sigue igual hasta que se confirme.`)
  }
  if(proposal.actions.some((a:string)=>['ORDER_CHANGE','ADDRESS_CHANGE','SCHEDULE_CHANGE'].includes(a)))return choose('got it, I have your change request for Salvador to review. the current order and schedule stay unchanged until the team confirms.','ya tengo su solicitud para que Salvador la revise. el pedido y horario actuales siguen iguales hasta que el equipo confirme.')
  if(proposal.email&&proposal.intent==='CONTACT')return choose(`got it, I updated your email to ${proposal.email}.`,`listo, actualicé su correo a ${proposal.email}.`)
  if(proposal.job_note&&lifecycle.job)return choose('got it, I added that instruction for the crew.','listo, agregué esa instrucción para el equipo.')
  if(proposal.intent==='ARRIVAL'&&lifecycle.job)return choose(`your current schedule is ${lifecycle.job.scheduled_date}${lifecycle.job.scheduled_time?` at ${lifecycle.job.scheduled_time.slice(0,5)}`:'. an exact arrival time has not been set'}.`,`su horario actual es ${lifecycle.job.scheduled_date}${lifecycle.job.scheduled_time?` a las ${lifecycle.job.scheduled_time.slice(0,5)}`:'. todavía no hay hora exacta de llegada'}.`)
  if(lifecycle.reactive)return null
  if(proposal.ready&&proposal.progress)return choose(`your quote is prepared for Salvador to review and send to ${proposal.current.email}. the delivery time is a request until the team confirms.`,`su cotización está preparada para que Salvador la revise y envíe a ${proposal.current.email}. el horario es una solicitud hasta que el equipo confirme.`)
  if(proposal.quote_requested&&proposal.progress&&pricing.status==='MATERIAL_CALCULATED'&&!proposal.current.email)return proposal.current.contact_email?choose(`I have ${proposal.current.contact_email} on file. is that where you want us to send it?`,`tengo ${proposal.current.contact_email}. ahí quiere que enviemos la cotización?`):choose('what email should we send the quote to?','a qué correo enviamos la cotización?')
  if(proposal.requested_date&&proposal.current.time&&pricing.status==='MATERIAL_CALCULATED'&&pricing.route?.status==='ROUTE_CALCULATED') {
    const material=String(pricing.material_name).replace(/[—–-]/g,' ')
    return choose(`I have ${pricing.yards} yards of ${material}, ${pricing.route.destination}, requested for ${proposal.current.date} at ${proposal.current.time}. would you like us to send the quote over?`,`tengo ${pricing.yards} yardas de ${material}, ${pricing.route.destination}, para solicitar el ${proposal.current.date} a las ${proposal.current.time}. quiere que enviemos la cotización?`)
  }
  return null
}

// An increment is not a replacement quantity. Keep it separate from accepted terms.
export function additionalYards(text:string):number|null {
  const match=text.match(/\b(\d+(?:\.\d+)?)\s+(?:more|additional|extra)\s+yards?\b|\b(\d+(?:\.\d+)?)\s+yardas?\s+(?:más|mas|adicionales)\b/i)
  const value=Number(match?.[1]??match?.[2])
  return Number.isFinite(value)&&value>0&&value<=10000?value:null
}
