import { createClient } from 'npm:@supabase/supabase-js@2'

const PROMPT_VERSION = 'mt-ai-draft-v1'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const decisionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'detected_language', 'customer_intent', 'extracted_facts', 'known_facts',
    'missing_facts', 'uncertain_facts', 'ai_may_continue', 'requires_human',
    'escalation_reason', 'recommended_action', 'draft_reply', 'confidence',
    'deterministic_pricing_required', 'payment_claim_detected', 'automation_state',
  ],
  properties: {
    detected_language: { type: 'string', enum: ['ENGLISH', 'SPANISH', 'SPANGLISH'] },
    customer_intent: { type: 'string' },
    extracted_facts: { type: 'array', items: { $ref: '#/$defs/fact' } },
    known_facts: { type: 'array', items: { $ref: '#/$defs/fact' } },
    missing_facts: { type: 'array', items: { type: 'string' } },
    uncertain_facts: { type: 'array', items: { type: 'string' } },
    ai_may_continue: { type: 'boolean' },
    requires_human: { type: 'boolean' },
    escalation_reason: { type: ['string', 'null'] },
    recommended_action: { type: 'string', enum: ['ASK_NEXT_MISSING_FACT', 'PROVIDE_STANDARD_PRICE', 'HOLD_FOR_SALVADOR', 'VERIFY_PAYMENT', 'MANUAL_REPLY', 'NO_ACTION'] },
    draft_reply: { type: 'string' },
    confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    deterministic_pricing_required: { type: 'boolean' },
    payment_claim_detected: { type: 'boolean' },
    automation_state: {
      type: 'object', additionalProperties: false,
      required: ['mode', 'rule_id', 'transport', 'send_allowed'],
      properties: {
        mode: { type: 'string', enum: ['CONVERSATION', 'AUTOMATION_DRY_RUN'] },
        rule_id: { type: ['string', 'null'] },
        transport: { type: 'string', enum: ['SETUP_REQUIRED'] },
        send_allowed: { type: 'boolean', enum: [false] },
      },
    },
  },
  $defs: {
    fact: {
      type: 'object', additionalProperties: false,
      required: ['key', 'value', 'source'],
      properties: {
        key: { type: 'string' }, value: { type: 'string' },
        source: { type: 'string', enum: ['CONVERSATION', 'RECORD', 'PRICING'] },
      },
    },
  },
}

function outputText(response: any) {
  if (typeof response?.output_text === 'string') return response.output_text
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) if (content?.type === 'output_text' && typeof content.text === 'string') return content.text
  }
  return ''
}

function forcedEscalation(text: string, takeover: boolean) {
  if (takeover) return 'Human takeover is active.'
  if (/\b(i sent|i paid|sent the zelle|mand[eé] el zelle|ya pagu[eé])\b/i.test(text)) return 'Payment claim requires human verification.'
  if (/\b(discount|cheaper|price match|can you do (?:it|that) for|if i pay today|menos|descuento)\b/i.test(text)) return 'Pricing negotiation requires Salvador.'
  if (/\b(driveway|private road|pond|grading|grade|site prep|clearing|ditch)\b/i.test(text) && /\b(how much|price|cost|total|cuanto|cuánto|fix|repair|arreglar)\b/i.test(text)) return 'Custom work pricing requires Salvador.'
  if (/\b(dispute|wrong amount|not what we agreed|too much|no es lo acordado)\b/i.test(text)) return 'Invoice dispute requires Salvador.'
  if (/\b(reschedule|change the date|different day|move the job|cambiar la fecha)\b/i.test(text)) return 'Schedule changes require Salvador.'
  if (/\b(complaint|damaged|unhappy|not happy|terrible|problema)\b/i.test(text)) return 'Customer complaint requires human judgment.'
  if (/\b(salvador|human|person|manager|someone real)\b/i.test(text)) return 'Customer requested a human.'
  return null
}

function validateDecision(decision: any) {
  if (!decision || typeof decision !== 'object') return 'No structured decision was returned.'
  if (decision.ai_may_continue && !decision.draft_reply) return 'AI returned an empty customer draft.'
  if (/[—–-]/.test(decision.draft_reply ?? '')) return 'Draft contains prohibited dash punctuation.'
  if (decision.draft_reply && decision.draft_reply[0] !== decision.draft_reply[0].toLowerCase()) return 'Draft must begin with lowercase text.'
  if ((decision.draft_reply ?? '').length > 420) return 'Draft exceeds the approved SMS length.'
  if (decision.requires_human && decision.ai_may_continue) return 'Escalated decision cannot continue autonomously.'
  if (decision.automation_state?.send_allowed !== false) return 'Draft-only mode cannot allow sending.'
  return null
}

function materialTool(messages: any[], materials: any[], settings: any) {
  const text = messages.filter((item) => item.sender_type === 'CUSTOMER').map((item) => item.body).join(' ')
  const materialName = text.match(/\b(mason sand|flexbase|crushed concrete|select fill|cushion sand|native gravel)\b/i)?.[1]
  const yards = Number(text.match(/\b(\d+(?:\.\d+)?)\s*(?:yards?|yardas?)\b/i)?.[1] ?? 0)
  const miles = Number(text.match(/\b(\d+(?:\.\d+)?)\s*miles?\b/i)?.[1] ?? 0)
  if (!materialName || !yards) return { status: 'NOT_READY', reason: 'Material and yard quantity are required.' }
  const material = materials.find((item) => item.name.toLowerCase().includes(materialName.toLowerCase()))
  if (!material) return { status: 'UNAVAILABLE', reason: 'Official material record was not found.' }
  const loads = Math.floor(yards / Number(material.full_load_yards))
  const remainder = yards % Number(material.full_load_yards)
  const materialTotal = loads * Number(material.full_load_price) + remainder * Number(material.price_per_yard)
  const deliveryLoads = Math.ceil(yards / Number(material.full_load_yards))
  let deliveryPerLoad: number | null = null
  if (miles > 0 && settings) {
    deliveryPerLoad = miles <= Number(settings.delivery_tier_1_max_miles)
      ? Number(settings.delivery_tier_1_fee)
      : miles <= Number(settings.delivery_tier_2_max_miles)
        ? Number(settings.delivery_tier_2_fee)
        : miles <= Number(settings.delivery_tier_3_max_miles)
          ? Number(settings.delivery_tier_3_fee)
          : Number(settings.delivery_overage_base_fee) + (miles - Number(settings.delivery_tier_3_max_miles)) * Number(settings.delivery_overage_per_mile)
  }
  const deliveryTotal = deliveryPerLoad == null ? null : deliveryPerLoad * deliveryLoads
  const taxable = deliveryTotal == null ? null : materialTotal + (settings.tax_applies_to_delivery ? deliveryTotal : 0)
  // app_settings.tax_rate uses percentage points: 8.25 means 8.25%.
  const tax = taxable == null ? null : Math.round(taxable * (Number(settings.tax_rate) / 100) * 100) / 100
  return {
    status: 'MATERIAL_CALCULATED', material_id: material.id, material_name: material.name,
    yards, full_loads: loads, remainder_yards: remainder,
    material_total: materialTotal, delivery_loads: deliveryLoads, delivery_miles: miles || null,
    delivery_fee_per_load: deliveryPerLoad,
    delivery_total: deliveryTotal ?? (/\b\d{2,6}\s+/.test(text) ? 'REQUIRES_APPROVED_DISTANCE' : 'REQUIRES_EXACT_ADDRESS'),
    tax_total: tax,
    grand_total: deliveryTotal == null ? null : Math.round((materialTotal + deliveryTotal + (tax ?? 0)) * 100) / 100,
  }
}

const instructions = `You are the internal drafting intelligence for Monkey Trucking. Return only the required structured decision.
This is DRAFT ONLY. Never send, mark sent, delivered, paid, refunded, voided, or change business state.
Read the supplied scoped context before replying. Merge facts from the complete conversation. Never ask for a fact already present. Ask only the smallest next missing fact.
Customer drafts begin lowercase, are short, friendly, calm and confident, and use no hyphens or em dashes. Use only ordinary sentence punctuation. Match natural English, Spanish or Spanglish.
Allowed scope: material sales and delivery, driveways and private roads, ponds, dirt work, grading and site preparation, and light clearing. Never claim demolition, major forestry, or large specialized clearing.
Only communicate pricing supplied by the deterministic pricing result. Never calculate or invent pricing yourself. Custom work pricing, negotiation, discounts, unusual conditions, complaints, schedule changes, disputes, payment claims, and explicit human requests require Salvador.
Payment claims are not payments. Never change money state. Human takeover pauses conversational AI. Do not expose chain of thought. Provide only useful facts and a concise operational decision.
Never mention internal tax setup, bookkeeper confirmation, provider configuration, or other admin-only setup details in a customer draft.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const started = Date.now()
  let actorId: string | null = null
  let leadId: string | null = null
  let customerId: string | null = null
  let automationRuleId: string | null = null
  let service: any = null
  try {
    const authorization = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const scoped = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    service = createClient(supabaseUrl, serviceKey)
    const { data: authData, error: authError } = await scoped.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Authentication required.' }, 401)
    actorId = authData.user.id
    const { data: authorized, error: roleError } = await scoped.rpc('is_admin_or_staff')
    if (roleError || !authorized) return json({ error: 'Admin or staff role required.' }, 403)

    const body = await req.json()
    const mode = body.mode === 'AUTOMATION_DRY_RUN' ? 'AUTOMATION_DRY_RUN' : 'CONVERSATION'
    automationRuleId = mode === 'AUTOMATION_DRY_RUN' ? String(body.automation_rule_id ?? '') : null
    leadId = body.lead_id ? String(body.lead_id) : null

    let lead: any = null
    let subject: any = null
    if (mode === 'CONVERSATION') {
      if (!leadId) return json({ error: 'lead_id is required.' }, 400)
      const result = await service.from('leads').select('*').eq('id', leadId).single()
      if (result.error) throw new Error('Lead could not be loaded.')
      lead = result.data
      customerId = lead.customer_id
    } else {
      const subjectType = String(body.subject_type ?? '')
      const subjectId = String(body.subject_id ?? '')
      if (!automationRuleId || !subjectType || !subjectId) return json({ error: 'Automation subject is required.' }, 400)
      const tableByType: Record<string, string> = { LEAD: 'leads', QUOTE: 'quotes', JOB: 'jobs', INVOICE: 'invoices', CUSTOMER: 'customers' }
      const table = tableByType[subjectType]
      if (!table) return json({ error: 'Unsupported automation subject.' }, 400)
      const result = await service.from(table).select('*').eq('id', subjectId).single()
      if (result.error) throw new Error('Automation subject could not be loaded.')
      subject = result.data
      customerId = subjectType === 'CUSTOMER' ? subject.id : subject.customer_id
      leadId = subjectType === 'LEAD' ? subject.id : subject.lead_id ?? null
      if (!leadId && customerId) {
        const latestLead = await service.from('leads').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        lead = latestLead.data
        leadId = lead?.id ?? null
      }
    }

    if (!customerId) throw new Error('Customer context could not be resolved.')
    const [customerResult, messageResult, stateResult, quoteResult, jobResult, invoiceResult, paymentResult, materialResult, appResult, controlResult] = await Promise.all([
      service.from('customers').select('id,name,phone,email,notes,sms_consent_at,sms_consent_source,sms_opted_out_at').eq('id', customerId).single(),
      leadId ? service.from('lead_messages').select('id,sender_type,body,created_at').eq('lead_id', leadId).order('created_at').limit(80) : Promise.resolve({ data: [], error: null }),
      leadId ? service.from('ai_conversation_state').select('*').eq('lead_id', leadId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      service.from('quotes').select('id,quote_number,status,description,address,grand_total,sent_at,accepted_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(3),
      service.from('jobs').select('id,status,category,scheduled_date,scheduled_time,address,description,agreed_amount,blocked_reason').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(3),
      service.from('invoices').select('id,invoice_number,status,amount,due_at,disputed,dispute_note,payment_claimed_at,payment_claim_note').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(3),
      service.from('payments').select('invoice_id,amount,method,received_at,voided_at').eq('customer_id', customerId).order('received_at', { ascending: false }).limit(5),
      service.from('materials').select('id,name,price_per_yard,full_load_price,full_load_yards').eq('is_active', true).order('sort_order'),
      service.from('app_settings').select('delivery_tier_1_fee,delivery_tier_1_max_miles,delivery_tier_2_fee,delivery_tier_2_max_miles,delivery_tier_3_fee,delivery_tier_3_max_miles,delivery_overage_base_fee,delivery_overage_per_mile,tax_rate,tax_applies_to_delivery').limit(1).maybeSingle(),
      service.from('control_center_settings').select('ai_english,ai_spanish,human_takeover_on_reply,sms_status,calling_status,custom_work_tax_rule').eq('id', 1).maybeSingle(),
    ])
    if (customerResult.error || messageResult.error || materialResult.error) throw new Error('Required conversation context could not be loaded.')
    const messages = messageResult.data ?? []
    const latestCustomer = [...messages].reverse().find((item: any) => item.sender_type === 'CUSTOMER')
    const takeover = Boolean((lead ?? subject)?.human_takeover)
    const forced = forcedEscalation(latestCustomer?.body ?? '', mode === 'CONVERSATION' && takeover)
    const pricing = materialTool(messages, materialResult.data ?? [], appResult.data)
    const context = {
      mode, automation_rule_id: automationRuleId, subject,
      customer: customerResult.data,
      lead: lead ?? (mode === 'CONVERSATION' ? subject : null),
      conversation: messages,
      existing_extracted_state: stateResult.data,
      recent_quotes: quoteResult.data ?? [], recent_jobs: jobResult.data ?? [],
      recent_invoices: invoiceResult.data ?? [], recent_verified_payments: paymentResult.data ?? [],
      official_materials: materialResult.data ?? [], delivery_and_tax_settings: appResult.data,
      communication_settings: controlResult.data,
      deterministic_pricing_result: pricing,
      application_forced_escalation: forced,
    }

    if (takeover && mode === 'CONVERSATION') {
      const decision = {
        detected_language: 'ENGLISH', customer_intent: 'HUMAN_TAKEOVER', extracted_facts: [],
        known_facts: stateResult.data?.known_facts ?? [], missing_facts: stateResult.data?.missing_facts ?? [], uncertain_facts: [],
        ai_may_continue: false, requires_human: true, escalation_reason: forced,
        recommended_action: 'MANUAL_REPLY', draft_reply: '', confidence: 'HIGH', deterministic_pricing_required: false,
        payment_claim_detected: false, automation_state: { mode, rule_id: automationRuleId, transport: 'SETUP_REQUIRED', send_allowed: false },
      }
      await service.from('ai_audit_logs').insert({
        evaluation_type: mode, customer_id: customerId, lead_id: leadId,
        automation_rule_id: automationRuleId, prompt_version: PROMPT_VERSION,
        language: decision.detected_language, decision,
        concise_rationale: 'Human takeover is active, so no model call or draft was created.',
        status: 'SUCCESS', latency_ms: Date.now() - started,
        tool_results: { pricing, model_call_skipped: true }, actor_id: actorId,
      })
      return json({ decision, draft: null, tool_results: { pricing }, paused: true })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) throw new Error('The managed OpenAI connection is unavailable to the Edge Function.')
    const isDirect = Boolean(Deno.env.get('OPENAI_API_KEY'))
    const baseUrl = Deno.env.get('OPENAI_BASE_URL') ?? (isDirect ? 'https://api.openai.com/v1' : 'https://ai.gateway.lovable.dev/v1')
    const model = Deno.env.get('OPENAI_MODEL') ?? Deno.env.get('LOVABLE_AI_MODEL') ?? 'gpt-5.6-terra'
    const aiResponse = await fetch(`${baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, store: false, instructions,
        input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(context) }] }],
        text: { format: { type: 'json_schema', name: 'monkey_trucking_ai_decision', strict: true, schema: decisionSchema } },
      }),
    })
    const responseBody = await aiResponse.json()
    if (!aiResponse.ok) throw new Error(`OpenAI request failed with ${aiResponse.status}.`)
    const decision = JSON.parse(outputText(responseBody))
    decision.automation_state = { mode, rule_id: automationRuleId, transport: 'SETUP_REQUIRED', send_allowed: false }
    if (forced) {
      decision.ai_may_continue = false
      decision.requires_human = true
      decision.escalation_reason = forced
      decision.recommended_action = /payment/i.test(forced) ? 'VERIFY_PAYMENT' : 'HOLD_FOR_SALVADOR'
      decision.payment_claim_detected = /payment/i.test(forced)
    }
    const asksStandardPrice = /\b(how much|price|cost|cuanto|cuánto)\b/i.test(latestCustomer?.body ?? '') && !forced
    if (asksStandardPrice) decision.deterministic_pricing_required = true
    if (asksStandardPrice && pricing.status !== 'MATERIAL_CALCULATED' && /\$|\b\d{2,}(?:\.\d{2})?\b/.test(decision.draft_reply ?? '')) {
      throw new Error('AI attempted to state pricing without an approved deterministic result.')
    }
    decision.missing_facts = (decision.missing_facts ?? []).filter((missing: string) => !(decision.known_facts ?? []).some((known: any) => known.key === missing || known.key === missing.replaceAll(' ', '_')))
    const validationError = validateDecision(decision)
    if (validationError) throw new Error(validationError)

    const rationale = decision.requires_human ? decision.escalation_reason : `${decision.customer_intent}: ${decision.recommended_action}`
    const audit = await service.from('ai_audit_logs').insert({
      evaluation_type: mode, customer_id: customerId, lead_id: leadId, automation_rule_id: automationRuleId,
      model_id: responseBody.model ?? model, prompt_version: PROMPT_VERSION, language: decision.detected_language,
      decision, concise_rationale: rationale, status: 'SUCCESS', latency_ms: Date.now() - started,
      tool_results: { pricing }, actor_id: actorId,
    }).select('id').single()
    if (audit.error) throw new Error('AI audit log could not be saved.')
    const draft = await service.from('ai_drafts').insert({
      audit_log_id: audit.data.id, lead_id: leadId, customer_id: customerId, automation_rule_id: automationRuleId,
      status: 'DRAFT', body: decision.draft_reply, language: decision.detected_language, decision, created_by: actorId,
    }).select('*').single()
    if (draft.error) throw new Error('AI draft could not be saved.')
    if (leadId) {
      const lastMessage = messages.at(-1)
      await service.from('ai_conversation_state').upsert({
        lead_id: leadId, customer_id: customerId, known_facts: decision.known_facts,
        missing_facts: decision.missing_facts, uncertain_facts: decision.uncertain_facts,
        last_evaluated_message_id: lastMessage?.id ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id' })
    }
    return json({ decision, draft: draft.data, tool_results: { pricing } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI draft generation failed.'
    if (service) {
      await service.from('ai_audit_logs').insert({
        evaluation_type: automationRuleId ? 'AUTOMATION_DRY_RUN' : 'CONVERSATION', customer_id: customerId,
        lead_id: leadId, automation_rule_id: automationRuleId, prompt_version: PROMPT_VERSION,
        status: 'FAILED', latency_ms: Date.now() - started, tool_results: {}, error_code: 'AI_GENERATION_FAILED',
        error_message: message.slice(0, 500), actor_id: actorId,
      })
    }
    return json({ error: message, retryable: true, send_allowed: false }, 502)
  }
})
