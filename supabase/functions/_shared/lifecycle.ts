/* eslint-disable @typescript-eslint/no-explicit-any */
import { isSimpleAcceptance } from './material-intelligence.ts'
// Lifecycle is a projection of business records, never a second state machine.
export const LIFECYCLE_POLICY = `CUSTOMER LIFECYCLE AND DASHBOARD AUTHORITY
Use lifecycle.stage and its scoped quote/job/invoice, never another transaction belonging to the same customer.
LEAD/QUOTING: answer useful questions, collect missing specifications and name naturally. Known names are not asked again.
QUOTE_READY: the draft is already prepared for staff. Answer new questions, but never ask for quote permission or recipient confirmation again unless the customer changes the recipient. Never send or accept a quote yourself.
QUOTE_SENT: respond to questions; do not restart qualification or offer the same quote again.
ACCEPTED/SCHEDULING: collect requested delivery details, not new qualification. These and later stages are established relationships: never reintroduce Monkey Trucking merely because the supplied transcript is empty.
SCHEDULED/IN_PROGRESS: react to the customer. Arrival answers use the actual calendar. Gate/access instructions may become job notes. Date, quantity, material and address changes are staff requests, never silent calendar/financial edits.
COMPLETED/PAYMENT/PAID: use real invoice and payment records; a customer claim is not a confirmed payment. Do not keep selling the completed order.
RETURNING: new work belongs to a fresh lead linked to the same phone/customer, never an alteration of a historical quote.
Only validated server tools persist customer facts, eligible draft preparation, notes and staff action events. Name/email never identify or merge customers. A normal first customer email collected during qualification becomes durable profile contact data when it is non-conflicting. An explicitly alternate recipient for this Quote stays document-scoped unless the customer also requests a profile update.
A clear material and yard request is a material-delivery lead by default unless the customer explicitly requests pickup or custom service work. Later explicit clarification replaces the lead-card need while the transaction is still unprotected.
Acknowledging a requested order/address/schedule change is safe intake, not financial authorization. Keep that staff approval as a subtask while acknowledging the exact request. Do not stop the whole conversation merely because accepted terms cannot be changed by AI. Actual disputes, negotiation, payment claims, uncertain claims and human takeover still stop autonomous sending.
dashboard_plan contains intent and exact source wording from the latest customer text. When ambiguous, clarify before writing. Dates are resolved by the server in America/Chicago. Morning/afternoon without an exact time require a time clarification. A preference is not a booking.
Quote readiness requires current deterministic material/route/pricing, requested date/time, explicit quote request and confirmed current email. Staff remains responsible for sending.
When consent has just been confirmed, continue the saved pre-consent inquiry. YES is authorization, not the customer's service question.
For a lead, answer the current question first and then ask exactly one natural next milestone question: name, material, quantity, destination, delivery preference, quote permission, then quote-recipient email. Do not end with a generic thank-you.
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

export const LEAD_NEEDS=['material-delivery','material-pickup','driveway','pond','dirt-grading','land-clearing'] as const
export type LeadNeed=typeof LEAD_NEEDS[number]

/**
 * Project the useful lead-card category from the same customer transcript and
 * deterministic material resolution already used by the conversation engine.
 * A later explicit clarification wins; incidental phrases such as "for my
 * driveway" do not turn a material order into custom driveway work.
 */
export function leadNeedFromConversation(messages:any[], quantity:any) {
  let resolved:{need:LeadNeed;source_message_id:string|null;source_text:string}|null=null
  for(const message of messages) {
    if(message.sender_type!=='CUSTOMER')continue
    const text=String(message.body??'').trim()
    const value=normal(text)
    let need:LeadNeed|null=null
    if(/\b(?:build|install|repair|fix|redo|regrade|grade|work on)\b.{0,35}\b(?:driveway|private road|entrance)\b|\b(?:driveway|private road|entrance)\b.{0,35}\b(?:installation|repair|work|grading|regrading)\b/i.test(value))need='driveway'
    else if(/\b(?:build|dig|excavate|repair|reshape|clean out)\b.{0,35}\bpond\b|\bpond\b.{0,35}\b(?:construction|excavation|repair|work|drainage)\b/i.test(value))need='pond'
    else if(/\b(?:dirt work|grading|grade (?:the|my|our)|site prep|level (?:the|my|our))\b/i.test(value))need='dirt-grading'
    else if(/\b(?:land clearing|brush clearing|clear (?:the|my|our) (?:land|lot|property|brush))\b/i.test(value))need='land-clearing'
    else if(/\b(?:pick\s*up|pick it up|pickup|collect it|haul it myself|come get it)\b/i.test(value))need='material-pickup'
    else if(/\b(?:deliver|delivery|drop(?:ped)? off|bring it)\b/i.test(value))need='material-delivery'
    else if(/\b\d+(?:\.\d+)?\s*(?:yards?|yardas?)\b/i.test(value)
      && (quantity?.status==='RESOLVED'||/\b(?:flexbase|crushed concrete|limestone|gravel|sand|select fill|native gravel|millings|decomposed granite|base)\b/i.test(value)))need='material-delivery'
    if(need)resolved={need,source_message_id:message.id??null,source_text:text.slice(0,500)}
  }
  return resolved
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
  return {date,time,text:text.slice(0,200),ambiguous,needsClarification:ambiguous||!!date&&!time||!!time&&!date}
}

export function lifecycleProposal(input:{lead:any;customer:any;messages:any[];lifecycle:any;decision:any;pricing:any;requestMessage?:any;now?:Date;timezone?:string}) {
  const {lead,customer,messages,lifecycle,decision,pricing}=input
  const inbound=[...messages].reverse().find(m=>m.sender_type==='CUSTOMER')
  const text=String(input.requestMessage?.body??inbound?.body??'').trim()
  const previousTurn=messages.slice(0,messages.lastIndexOf(inbound)).filter(m=>['AI','HUMAN','CUSTOMER'].includes(m.sender_type)).at(-1)
  const lastAi=previousTurn&&['AI','HUMAN'].includes(previousTurn.sender_type)?previousTurn.body??'':''
  const plan=decision.dashboard_plan
  const trustedPlan=plan?.confidence==='HIGH'&&typeof plan.source_text==='string'&&plan.source_text.trim()&&text.includes(plan.source_text)
  const intent=trustedPlan?plan.intent:'NONE'
  const yes=isSimpleAcceptance(text)||/^(?:correct|correcto)[.!\s]*$/i.test(text)
  const emails=[...text.matchAll(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}\b/gi)].map(m=>m[0])
  const email=emails.length===1&&!/\bor\b|\bo\b|maybe|perhaps|quizas/i.test(text)?emails[0]:null
  const name=customerName(text,/\b(your name|su nombre|tu nombre|se llama|te llamas)\b/i.test(lastAi))
  const dateRelevant=['DELIVERY_PREFERENCE','SCHEDULE_CHANGE'].includes(intent)||/\b(tomorrow|noon|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miercoles|jueves|viernes|sabado|domingo|mediodia)\b/i.test(normal(text))||/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/i.test(text)
  // A date-only clarification is not a booking/write. Recover its unambiguous
  // date from the immediately preceding customer preference when time arrives.
  const priorText=[...messages].slice(0,-1).reverse().find(m=>m.sender_type==='CUSTOMER')
  const priorPreference=priorText?resolveDeliveryPreference(priorText.body,priorText.created_at?new Date(priorText.created_at):input.now,input.timezone):null
  const previousDate=priorPreference&&!priorPreference.ambiguous?priorPreference.date??lead.requested_delivery_date:lead.requested_delivery_date
  const preference=dateRelevant?resolveDeliveryPreference(text,input.now,input.timezone,previousDate):null
  // Recover approvals from customer turns too, so old conversations affected by
  // the prepare/send wording mismatch can advance on their next message.
  let approved=Boolean(lead.quote_requested_at)
  let precedingQuestion=''
  for(const message of messages) {
    if(['AI','HUMAN'].includes(message.sender_type))precedingQuestion=String(message.body??'')
    if(message.sender_type==='CUSTOMER') {
      if(message.message_kind!=='COMPLIANCE'&&isQuoteApproval(String(message.body??''),precedingQuestion))approved=true
      precedingQuestion=''
    }
  }
  const quoteRequested=approved||isQuoteApproval(text,lastAi)||intent==='QUOTE_REQUEST'&&/\b(quote|estimate|cotizacion|presupuesto|send it|mandala|enviala)\b/i.test(normal(text))
  const quoteEmailPrompt=/\b(quote|estimate|cotizaci[oó]n|presupuesto|send|email|correo)\b/i.test(lastAi)
  const existingEmail=String(customer.email??'').trim().toLowerCase()
  const explicitQuoteOnly=Boolean(email)&&intent!=='CONTACT'&&(
    /\b(?:another|different|alternate)\s+(?:email|address|correo)\b/i.test(text)
    ||/\b(?:this quote|this estimate|esta cotizaci[oó]n|este presupuesto)\b/i.test(text)
    ||Boolean(existingEmail&&email!.toLowerCase()!==existingEmail)
  )
  // A normal first email supplied while qualifying the lead becomes durable
  // customer contact data. Explicit alternate document recipients stay scoped
  // to this Quote and never overwrite the profile.
  const contactEmail=email&&!explicitQuoteOnly?email:null
  const promptedEmails=[...lastAi.matchAll(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}\b/gi)].map(m=>m[0].toLowerCase())
  const confirmedEmail=email&&intent!=='CONTACT'&&(intent==='NONE'||['CONFIRM_EMAIL','QUOTE_REQUEST'].includes(intent)||quoteEmailPrompt)?email:(yes&&quoteEmailPrompt&&promptedEmails.length===1&&/[?？]/.test(lastAi)?promptedEmails[0]:null)
  const requestedDate=preference?.date??lead.requested_delivery_date
  const requestedTime=preference?.date&&preference.date!==lead.requested_delivery_date?preference.time:preference?.time??lead.requested_delivery_time
  const emailConfirmed=confirmedEmail??lead.quote_confirmed_email??null
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
  const leadNeed=!lifecycle.protected?leadNeedFromConversation(messages,pricing?.quantity):null
  return {source_message_id:inbound?.id,name,email:contactEmail,confirmed_email:confirmedEmail,quote_requested:quoteRequested,
    lead_need:leadNeed?.need??null,lead_need_source_message_id:leadNeed?.source_message_id??null,lead_need_source_text:leadNeed?.source_text??null,
    requested_date:preference&&!preference.ambiguous?preference.date:null,requested_time:preference&&!preference.ambiguous?preference.time:null,requested_text:preference?.text,
    job_note:financialChange?null:note,ready:Boolean(ready),actions,clarification:emails.length>1?'EMAIL':preference?.needsClarification?'DATE_TIME':plan?.confidence==='LOW'?'REQUEST':null,
    intent,progress:yes||Boolean(email)||Boolean(preference)||intent==='QUOTE_REQUEST',context:{stage:lifecycle.stage,quote_id:lifecycle.quote?.id,job_id:lifecycle.job?.id,invoice_id:lifecycle.invoice?.id,request:text,request_source_message_id:input.requestMessage?.id??inbound?.id,requested_date:preference?.date,requested_time:preference?.time,pricing,prior_delivery_address:lead.delivery_address},
    current:{name:name??knownCustomerName(customer.name),email:emailConfirmed,contact_email:customer.email,date:requestedDate,time:requestedTime},
  }
}

export function explicitFullRecap(text:string) {
  return /\b(?:recap|summari[sz]e|what (?:information|details) do you have|what do you have (?:for|so far|me down for)|repas[oa]|resumen|qu[eé] (?:informaci[oó]n|datos) tiene)\b/i.test(text)
}

export function leadMilestoneQuestion(input:{proposal:any;lifecycle:any;pricing:any;route:any;quantity:any;customer:any;language:string}) {
  const {proposal,lifecycle,pricing,route,quantity,customer}=input
  if(lifecycle.reactive||proposal.clarification||proposal.actions?.some((a:string)=>['HUMAN_REQUEST','COMPLAINT','PAYMENT_CLAIM'].includes(a)))return null
  const es=input.language==='SPANISH'
  const choose=(en:string,sp:string)=>es?sp:en
  if(!knownCustomerName(proposal.current?.name??customer?.name))return choose('what name should I put on the request?','qué nombre pongo en la solicitud?')
  if(quantity?.status!=='RESOLVED') {
    return quantity?.material_name
      ? choose(`how many yards of ${String(quantity.material_name).replace(/[—–-]/g,' ')} do you need?`,`cuántas yardas de ${String(quantity.material_name).replace(/[—–-]/g,' ')} necesita?`)
      : choose('what material and how many yards do you need?','qué material y cuántas yardas necesita?')
  }
  if(!route?.destination)return choose('what is the exact delivery address?','cuál es la dirección exacta de entrega?')
  if(!proposal.current?.date)return choose('what delivery date and time work best for you?','qué fecha y hora de entrega le funcionan mejor?')
  if(!proposal.current?.time)return choose('what time works best that day?','qué hora le funciona mejor ese día?')
  if(!proposal.quote_requested)return quotePreparationQuestion(proposal,pricing,es)
  if(!proposal.current?.email)return proposal.current?.contact_email
    ? choose(`should we send the quote to ${proposal.current.contact_email}?`,`enviamos la cotización a ${proposal.current.contact_email}?`)
    : choose('what email should we send the quote to?','a qué correo enviamos la cotización?')
  if(pricing?.route?.status!=='ROUTE_CALCULATED')return null
  return null
}

export function appendLeadMilestone(reply:string,question:string|null) {
  const clean=String(reply??'').trim()
  if(!question||/[?？]\s*$/.test(clean)||clean.toLowerCase().includes(question.toLowerCase()))return clean
  return `${clean}${clean?' ':''}${question}`.trim()
}

/** Final quote milestone is rendered only from the verified calculation. */
export function quotePreparationQuestion(proposal:any,pricing:any,es:boolean) {
  if(pricing?.status!=='MATERIAL_CALCULATED'||pricing.route?.status!=='ROUTE_CALCULATED'
    || ![pricing.material_total,pricing.delivery_total,pricing.grand_total].every(Number.isFinite))return null
  const money=(value:number)=>`$${value.toFixed(2)}`
  const material=String(pricing.material_name).replace(/[—–-]/g,' ')
  const tax=Number(pricing.tax_total)>0?(es?`, impuestos ${money(pricing.tax_total)}`:`, tax ${money(pricing.tax_total)}`):''
  // These are local requested calendar values, not an already booked timestamp.
  const requested=new Date(`${proposal.current.date}T${String(proposal.current.time).slice(0,5)}:00Z`)
  const when=Number.isFinite(requested.getTime())
    ? new Intl.DateTimeFormat(es?'es-US':'en-US',{timeZone:'UTC',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(requested)
    : `${proposal.current.date} ${String(proposal.current.time).slice(0,5)}`
  return es
    ? `${pricing.yards} yardas de ${material} a ${pricing.route.destination}, solicitado ${when}. Material ${money(pricing.material_total)}, entrega ${money(pricing.delivery_total)}${tax}; total estimado ${money(pricing.grand_total)}. Quiere que preparemos la cotización?`
    : `${pricing.yards} yards of ${material} to ${pricing.route.destination}, requested ${when}. Material ${money(pricing.material_total)}, delivery ${money(pricing.delivery_total)}${tax}; estimated total ${money(pricing.grand_total)}. Would you like us to prepare the quote?`
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
  if(pricing.status==='MATERIAL_CALCULATED'&&pricing.route?.status==='ROUTE_CALCULATED'&&Number.isFinite(pricing.grand_total)
    && /\b(?:actually|make it|make that|change it|mejor|c[aá]mbialo)\b.*\d/i.test(proposal.context?.request??'')) {
    return choose(`got it, ${pricing.yards} yards. the estimated delivered total is $${pricing.grand_total.toFixed(2)}.`,`anotado, ${pricing.yards} yardas. el total estimado con entrega es $${pricing.grand_total.toFixed(2)}.`)
  }
  if(proposal.context?.prior_delivery_address&&pricing?.route?.destination
    && String(proposal.context.prior_delivery_address).trim().toLowerCase()!==String(pricing.route.destination).trim().toLowerCase()
    && /\b(address|direcci[oó]n)\b|\d{1,6}\s+\S+/i.test(proposal.context.request??'')) {
    return choose(`got it, I changed the delivery address to ${pricing.route.destination}.`,`listo, cambié la dirección de entrega a ${pricing.route.destination}.`)
  }
  if(proposal.ready&&proposal.progress)return choose('perfect, your quote is ready for review. we’ll send it over shortly.','perfecto, su cotización está lista para revisión. se la enviamos pronto.')
  if(proposal.quote_requested&&proposal.progress&&pricing.status==='MATERIAL_CALCULATED'&&!proposal.current.email)return proposal.current.contact_email?choose(`I have ${proposal.current.contact_email} on file. is that where you want us to send it?`,`tengo ${proposal.current.contact_email}. ahí quiere que enviemos la cotización?`):choose('what email should we send the quote to?','a qué correo enviamos la cotización?')
  if(!proposal.quote_requested&&proposal.progress&&proposal.current.date&&proposal.current.time&&pricing.status==='MATERIAL_CALCULATED'&&pricing.route?.status==='ROUTE_CALCULATED') {
    return quotePreparationQuestion(proposal,pricing,es)
  }
  return null
}

export function isQuoteApproval(text:string,previousReply:string) {
  const value=normal(text).trim()
  if(/\b(?:do not|don't|dont|not yet|no thanks|no quiero)\b/.test(value))return false
  if(/\b(?:prepare|send|make|email|prepara|prepare|manda|mande|envia|envie)\b.{0,45}\b(?:quote|estimate|cotizacion|presupuesto)\b/.test(value))return true
  const affirmative=isSimpleAcceptance(value)||/^(?:correct|correcto|yes that is correct|yes that's correct)[.!\s]*$/.test(value)
  const question=normal(previousReply).split(/[?？]/).slice(0,-1).pop()??''
  return affirmative&&/\b(?:quote|estimate|cotizacion|presupuesto)\b/.test(question)
    && /\b(?:prepare|send|review|prepar\w*|envi\w*|mand\w*)\b/.test(question)
    && !/\b(?:cancel|decline|reject|cancelar|rechazar)\b/.test(question)
}

// An increment is not a replacement quantity. Keep it separate from accepted terms.
export function additionalYards(text:string):number|null {
  const match=text.match(/\b(\d+(?:\.\d+)?)\s+(?:more|additional|extra)\s+yards?\b|\b(\d+(?:\.\d+)?)\s+yardas?\s+(?:más|mas|adicionales)\b/i)
  const value=Number(match?.[1]??match?.[2])
  return Number.isFinite(value)&&value>0&&value<=10000?value:null
}
