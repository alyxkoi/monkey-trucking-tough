/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateAiDraft, validateDecision, type AiConfig } from './ai-engine.ts'
import { composeConversationResponse } from './conversation-response.ts'
import { scheduledResponse } from './scheduled-response.ts'

export function autonomousReply(decision: any, pricing: any): string {
  const reply = renderAutonomousReply(decision, pricing)
  if (!decision.first_conversational_reply || /monkey trucking/i.test(reply)) return reply
  return `${decision.detected_language === 'SPANISH' ? 'hola, somos Monkey Trucking. ' : 'hi, this is Monkey Trucking. '}${reply}`
}

function renderAutonomousReply(decision: any, pricing: any): string {
  const invalid = validateDecision(decision)
  if (invalid) throw new Error(invalid)
  if (decision.requires_human || !decision.ai_may_continue || decision.payment_claim_detected || decision.confidence !== 'HIGH'
    || decision.uncertain_facts.length) throw new Error(decision.escalation_reason || 'AI decision needs human review')
  if(decision.recommended_action==='ANSWER_CUSTOMER')return composeConversationResponse(decision,pricing)
  if (decision.recommended_action === 'PROVIDE_STANDARD_PRICE') {
    if (pricing?.status !== 'MATERIAL_CALCULATED' || !Number.isFinite(pricing.material_total) || pricing.material_total < 0) throw new Error('Verified material pricing unavailable')
    const quantity=decision.known_facts.find((fact:any)=>fact.key==='quantity_yards')?.value
    const knownMaterial=decision.known_facts.find((fact:any)=>fact.key==='material')?.value
    if (Number(quantity)!==pricing.yards || typeof knownMaterial!=='string' || knownMaterial.toLowerCase()!==String(pricing.material_name).toLowerCase()) throw new Error('Pricing facts require confirmation')
    // Prices are rendered from the calculation, never copied from model prose.
    const amount = pricing.material_total.toFixed(2)
    const material = String(pricing.material_name).toLowerCase().replace(/[—–-]/g, ' ')
    const addressKnown=decision.known_facts.some((fact:any)=>['address','delivery_address'].includes(fact.key)&&fact.value)
    const converted = pricing.quantity?.input_unit === 'TONS' && decision.explain_conversion !== false
      ? {
          tons: Number(pricing.quantity.input_value).toLocaleString('en-US',{maximumFractionDigits:2}),
          estimatedYards: Number(pricing.quantity.estimated_yards ?? pricing.quantity.raw_yards).toLocaleString('en-US',{maximumFractionDigits:1}),
          recommendedYards: Number(pricing.quantity.recommended_yards ?? pricing.yards).toLocaleString('en-US',{maximumFractionDigits:1}),
        }
      : null
    const routeReady = Number.isFinite(pricing.delivery_total) && Number.isFinite(pricing.grand_total)
    if (routeReady) {
      const delivery = Number(pricing.delivery_total).toFixed(2)
      const total = Number(pricing.grand_total).toFixed(2)
      return decision.detected_language === 'SPANISH'
        ? `${converted ? `recomiendo aproximadamente ${converted.recommendedYards} yardas. ` : ''}el material cuesta $${amount}. la entrega para ${pricing.delivery_loads} ${pricing.delivery_loads===1?'carga':'cargas'} cuesta $${delivery}. el total estimado${pricing.tax_total>0?' con impuestos':''} es $${total}.`
        : `${converted ? `i recommend approximately ${converted.recommendedYards} yards. ` : ''}the material is $${amount}. delivery for ${pricing.delivery_loads} ${pricing.delivery_loads===1?'load':'loads'} is $${delivery}. the estimated total${pricing.tax_total>0?' with tax':''} is $${total}.`
    }
    return decision.detected_language === 'SPANISH'
      ? `${converted ? `recomiendo aproximadamente ${converted.recommendedYards} yardas. ` : ''}el material para ${pricing.yards} yardas de ${material} cuesta $${amount}. ${pricing.tax_applicable===false?'la entrega se confirma por separado.':'la entrega y los impuestos se confirman por separado.'}${addressKnown?'':' cuál es la dirección exacta de entrega.'}`
      : `${converted ? `i recommend approximately ${converted.recommendedYards} yards. ` : ''}the material for ${pricing.yards} yards of ${material} is $${amount}. ${pricing.tax_applicable===false?'delivery is confirmed separately.':'delivery and tax are confirmed separately.'}${addressKnown?'':' what is the exact delivery address.'}`
  }
  if (!['ASK_NEXT_MISSING_FACT','COLLECT_RESCHEDULE_PREFERENCE'].includes(decision.recommended_action)) throw new Error('This AI action requires staff review')
  if (decision.recommended_action === 'COLLECT_RESCHEDULE_PREFERENCE'
    && /\b(booked|scheduled|rescheduled|confirmed|agendado|reagendado|confirmado)\b/i.test(decision.draft_reply)) {
    throw new Error('Reschedule preference cannot be presented as a confirmed change')
  }
  if (/[$€£]|\b(dollars?|dólares|paid|refunded|booked|scheduled|discount|pagado|reembolsado|agendado|descuento)\b/i.test(decision.draft_reply)) throw new Error('Financial or scheduling commitment requires staff review')
  return decision.draft_reply
}

const spanish = (text: string) => /\b(hola|necesito|quiero|cuanto|cuánto|yardas|cargas|entrega|direccion|dirección|gracias|ocupo|camino)\b/i.test(text)

export function jobReminderText(when: string, es: boolean) {
  const compactWhen = when.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').replace(/\.+$/, '')
  return es ? `Recordatorio: su trabajo es el ${compactWhen}.` : `Reminder: your job is ${compactWhen}.`
}

async function scheduledText(service: any, job: any, config: AiConfig) {
  if (['new-lead','quote-follow-up'].includes(job.rule_id)) {
    const result = await generateAiDraft(service, { mode: 'AUTOMATION_DRY_RUN', automation_rule_id: job.rule_id,
      subject_type: job.context.subject_type, subject_id: job.context.subject_id }, null, config)
    return autonomousReply(result.decision, result.tool_results.pricing)
  }
  const lead = await service.from('leads').select('customer_id').eq('id',job.lead_id).single()
  if (lead.error) throw new Error('Lead context unavailable')
  const messages = await service.from('lead_messages').select('body').eq('customer_id',lead.data.customer_id).eq('sender_type','CUSTOMER').eq('message_kind','INBOUND').order('created_at',{ascending:false}).limit(1)
  const runtime = await service.from('communication_runtime').select('timezone').eq('id',1).single()
  const settings = await service.from('control_center_settings').select('review_url,ai_english,ai_spanish').eq('id',1).single()
  if (messages.error || runtime.error || settings.error) throw new Error('Communication context unavailable')
  const es = spanish(messages.data?.[0]?.body ?? '')
  if (es ? !settings.data.ai_spanish : !settings.data.ai_english) throw new Error('Conversation language is disabled')
  if (job.rule_id === 'job-reminder') {
    // The guard's anchor is a database-converted real scheduled timestamp.
    const when = new Intl.DateTimeFormat(es ? 'es-US' : 'en-US', {
      timeZone: runtime.data.timezone, weekday:'long',day:'numeric',hour:'numeric',minute:'2-digit',
    }).format(new Date(job.context.anchor))
    return jobReminderText(when, es)
  }
  const invoice = await service.from('invoices').select('amount,invoice_number,due_at,status,job_id').eq('id',job.context.subject_id).eq('customer_id',lead.data.customer_id).single()
  if (invoice.error || !Number.isFinite(Number(invoice.data.amount))) throw new Error('Invoice context unavailable')
  const work = job.rule_id === 'invoice-follow-up' ? null
    : await service.from('jobs').select('category,status').eq('id',invoice.data.job_id).eq('customer_id',lead.data.customer_id).single()
  if (work?.error) throw new Error('Completed work context unavailable')
  return scheduledResponse({rule:job.rule_id,step:Number(job.context.step),spanish:es,timezone:runtime.data.timezone,
    invoice:invoice.data,job:work?.data,reviewUrl:settings.data.review_url})
}

export async function runCommunicationJob(service: any, config: AiConfig, templateId?: string, jobId?: string) {
  const claimed = jobId
    ? await service.rpc('claim_communication_job_by_id', { p_job_id: jobId })
    : await service.rpc('claim_communication_job')
  if (claimed.error) throw new Error('Communication jobs could not be claimed')
  const job = claimed.data
  if (!job) return { processed: false }
  let text: string | null = null
  let reason: string | null = null
  try {
    const eligible = await service.rpc('communication_job_eligible', { p_job_id: job.id, p_lease_token: job.lease_token })
    if (eligible.error || eligible.data !== true) throw new Error('Communication job is no longer eligible')
    if (job.kind === 'AI_REPLY') {
      const result = await generateAiDraft(service, { lead_id: job.lead_id }, null, config)
      text = autonomousReply(result.decision, result.tool_results.pricing)
    } else text = await scheduledText(service, job, config)
    if (!text || text.length>420 || /[—–]/.test(text)) throw new Error('Automated message failed length or style checks')
  } catch (error) { reason = error instanceof Error ? error.message : 'Communication generation failed' }
  const finished = await service.rpc('finish_communication_job', {
    p_job_id:job.id,p_lease_token:job.lease_token,p_body:reason ? null : text,p_template_id:templateId ?? null,p_error:reason,
  })
  if (finished.error) throw new Error('Communication result could not be committed')
  return { processed:true, reserved:Boolean(finished.data?.id), blocked:Boolean(reason), messageId:finished.data?.id ?? null }
}
