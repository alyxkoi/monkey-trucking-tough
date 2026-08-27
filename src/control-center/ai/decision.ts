import type { ControlData, LeadMessage } from '@/control-center/data'
import type { AiDecision, AiFact, AiLanguage } from './types'

type EvaluationInput = {
  messages: Pick<LeadMessage, 'sender_type' | 'body'>[]
  humanTakeover?: boolean
  materials?: ControlData['materials']
  appSettings?: ControlData['appSettings']
  automationRuleId?: string | null
}

const SPANISH = /\b(hola|necesito|quiero|cuanto|cuánto|yardas|cargas|entrega|direccion|dirección|para|cerca|gracias|mande|ocupo|camino)\b/i
const ENGLISH = /\b(hey|need|want|how much|yards|loads|delivery|address|driveway|sent|paid|wife|tomorrow)\b/i

export function detectLanguage(text: string): AiLanguage {
  const spanish = SPANISH.test(text)
  const english = ENGLISH.test(text)
  return spanish && english ? 'SPANGLISH' : spanish ? 'SPANISH' : 'ENGLISH'
}

function fact(key: string, value: string): AiFact {
  return { key, value, source: 'CONVERSATION' }
}

function extractFacts(text: string): AiFact[] {
  const facts: AiFact[] = []
  const materialMatch = text.match(/\b(mason sand|flexbase|crushed concrete|select fill|cushion sand|native gravel|base)\b/i)?.[1]
  const material = materialMatch?.toLowerCase() === 'base' ? 'Flexbase' : materialMatch
  const yards = text.match(/\b(\d+(?:\.\d+)?)\s*(?:yards?|yardas?)\b/i)?.[1]
  const loadMatch = text.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|un|una|dos|tres|cuatro|cinco)\s*(?:loads?|cargas?)\b/i)?.[1]
  const wordNumber: Record<string, string> = { one: '1', un: '1', una: '1', two: '2', dos: '2', three: '3', tres: '3', four: '4', cuatro: '4', five: '5', cinco: '5' }
  const loads = loadMatch ? wordNumber[loadMatch.toLowerCase()] ?? loadMatch : undefined
  const city = text.match(/\b(kaufman|crandall|terrell|forney|kemp|mabank|scurry)\b/i)?.[1]
  const address = text.match(/\b\d{2,6}\s+[a-z0-9][a-z0-9 .']{3,}(?:road|rd|street|st|lane|ln|drive|dr|highway|hwy|fm|county road|cr)\b/i)?.[0]
  if (material) facts.push(fact('material', material.replace(/\b\w/g, (value) => value.toUpperCase())))
  if (yards) facts.push(fact('quantity_yards', yards))
  if (loads) facts.push(fact('quantity_loads', loads))
  if (/\b(deliver|delivery|entrega|entregar|delivered)\b/i.test(text)) facts.push(fact('delivery_requested', 'yes'))
  if (city) facts.push(fact('city', city.replace(/^./, (value) => value.toUpperCase())))
  if (address) facts.push(fact('delivery_address', address.trim()))
  if (/\b(i sent|i paid|sent the zelle|mand[eé] el zelle|ya pagu[eé])\b/i.test(text)) facts.push(fact('payment_claim', 'customer says payment was sent'))
  if (/\b(wife|husband|spouse|esposa|esposo)\b/i.test(text)) facts.push(fact('decision_context', 'customer is discussing it with their spouse'))
  return facts
}

function mergeFacts(messages: EvaluationInput['messages']) {
  const byKey = new Map<string, AiFact>()
  for (const message of messages) {
    if (message.sender_type !== 'CUSTOMER') continue
    for (const item of extractFacts(message.body)) byKey.set(item.key, item)
  }
  return [...byKey.values()]
}

function valueOf(facts: AiFact[], key: string) {
  return facts.find((item) => item.key === key)?.value
}

function safeDraft(text: string) {
  const clean = text.replace(/[—–-]/g, ',').replace(/\s+/g, ' ').trim()
  return clean ? clean.charAt(0).toLowerCase() + clean.slice(1) : ''
}

export function evaluateConversation(input: EvaluationInput): { decision: AiDecision; toolResults: Record<string, unknown> } {
  const customerMessages = input.messages.filter((message) => message.sender_type === 'CUSTOMER')
  const latest = customerMessages.at(-1)?.body ?? ''
  const language = detectLanguage(latest)
  const extracted = extractFacts(latest)
  const known = mergeFacts(input.messages)
  const paymentClaim = Boolean(valueOf(known, 'payment_claim'))
  const negotiation = /\b(discount|cheaper|price match|can you do (?:it|that) for|if i pay today|menos|descuento)\b/i.test(latest)
  const customPricing = /\b(driveway|private road|pond|grading|grade|site prep|clearing|ditch)\b/i.test(latest) && /\b(how much|price|cost|total|cuanto|cuánto|fix|repair|arreglar)\b/i.test(latest)
  const humanRequest = /\b(salvador|human|person|manager|someone real)\b/i.test(latest)
  const dispute = /\b(dispute|wrong amount|not what we agreed|too much|no es lo acordado)\b/i.test(latest)
  const scheduleChange = /\b(reschedule|change the date|different day|move the job|cambiar la fecha)\b/i.test(latest)
  const complaint = /\b(complaint|damaged|unhappy|not happy|terrible|problema)\b/i.test(latest)
  const humanReason = input.humanTakeover
    ? 'Human takeover is active.'
    : paymentClaim
      ? 'Payment claim requires human verification.'
      : negotiation
        ? 'Pricing negotiation requires Salvador.'
        : customPricing
          ? 'Custom work pricing requires Salvador.'
          : dispute
            ? 'Invoice dispute requires Salvador.'
            : scheduleChange
              ? 'Schedule changes require Salvador.'
              : complaint
                ? 'Customer complaint requires human judgment.'
                : humanRequest
                  ? 'Customer requested a human.'
                  : null

  const delivery = valueOf(known, 'delivery_requested') === 'yes'
  const material = valueOf(known, 'material')
  const quantity = valueOf(known, 'quantity_yards') ?? valueOf(known, 'quantity_loads')
  const address = valueOf(known, 'delivery_address')
  const city = valueOf(known, 'city')
  const missing: string[] = []
  if (material && !quantity) missing.push('quantity')
  if (delivery && !address) missing.push('delivery address')
  if (!material && /\b(material|sand|gravel|base|concrete|yard|load|carga)\b/i.test(latest)) missing.push('material')

  let pricingResult: Record<string, unknown> = { status: 'NOT_REQUIRED' }
  const asksPrice = /\b(how much|price|cost|cuanto|cuánto)\b/i.test(latest)
  const deterministicPricing = Boolean(material && quantity && asksPrice && !customPricing && !negotiation)
  if (deterministicPricing) {
    const row = input.materials?.find((entry) => entry.name.toLowerCase().includes(material!.toLowerCase()))
    const yards = Number(valueOf(known, 'quantity_yards') ?? 0)
    if (row && yards > 0) {
      const fullLoads = Math.floor(yards / Number(row.full_load_yards))
      const remainder = yards % Number(row.full_load_yards)
      pricingResult = {
        status: 'MATERIAL_CALCULATED',
        material: row.name,
        material_total: fullLoads * Number(row.full_load_price) + remainder * Number(row.price_per_yard),
        delivery_total: address ? 'REQUIRES_DISTANCE_TIER' : 'REQUIRES_ADDRESS',
      }
    } else {
      pricingResult = { status: 'UNAVAILABLE', reason: 'Official material pricing or usable quantity is unavailable.' }
    }
  }

  let draft = ''
  if (input.humanTakeover) draft = ''
  else if (paymentClaim) draft = language === 'SPANISH' ? 'perfecto, gracias. le aviso a salvador para que verifique el pago.' : 'perfect, thank you. i will let salvador know so he can verify it.'
  else if (humanReason) draft = language === 'SPANISH' ? 'déjeme revisar eso con salvador y le confirmamos.' : 'let me check with salvador on that and get back to you.'
  else if (missing[0] === 'delivery address') draft = language === 'SPANISH' ? 'claro, me comparte la dirección exacta para calcular la entrega.' : language === 'SPANGLISH' ? 'perfecto, what is the exact delivery address so i can calculate the delivery.' : 'what is the exact delivery address so i can calculate the delivery.'
  else if (missing[0] === 'quantity') draft = language === 'SPANISH' ? 'claro, cuántas yardas o cargas necesita.' : 'how many yards or loads do you need.'
  else if (missing[0] === 'material') draft = language === 'SPANISH' ? 'claro, qué material necesita.' : 'what material do you need.'
  else draft = language === 'SPANISH' ? 'perfecto, ya tengo esos datos. le preparo el siguiente paso.' : language === 'SPANGLISH' ? 'perfecto, i have those details and can help with the next step.' : 'perfect, i have those details and can help with the next step.'

  const intent = paymentClaim ? 'PAYMENT_CLAIM' : negotiation ? 'PRICE_NEGOTIATION' : customPricing ? 'CUSTOM_WORK_PRICING' : asksPrice ? 'STANDARD_PRICE_REQUEST' : delivery ? 'MATERIAL_DELIVERY' : 'GENERAL_INQUIRY'
  const requiresHuman = Boolean(humanReason)
  const decision: AiDecision = {
    detected_language: language,
    customer_intent: intent,
    extracted_facts: extracted,
    known_facts: known,
    missing_facts: missing.filter((key) => !valueOf(known, key.replace(' ', '_'))),
    uncertain_facts: [],
    ai_may_continue: !requiresHuman && !input.humanTakeover,
    requires_human: requiresHuman,
    escalation_reason: humanReason,
    recommended_action: input.humanTakeover ? 'MANUAL_REPLY' : paymentClaim ? 'VERIFY_PAYMENT' : requiresHuman ? 'HOLD_FOR_SALVADOR' : deterministicPricing && pricingResult.status === 'MATERIAL_CALCULATED' && !missing.length ? 'PROVIDE_STANDARD_PRICE' : missing.length ? 'ASK_NEXT_MISSING_FACT' : 'NO_ACTION',
    draft_reply: safeDraft(draft),
    confidence: latest ? 'HIGH' : 'LOW',
    deterministic_pricing_required: deterministicPricing,
    payment_claim_detected: paymentClaim,
    automation_state: { mode: input.automationRuleId ? 'AUTOMATION_DRY_RUN' : 'CONVERSATION', rule_id: input.automationRuleId ?? null, transport: 'SETUP_REQUIRED', send_allowed: false },
  }
  return { decision, toolResults: { pricing: pricingResult, city: city ?? null } }
}

export function validateCustomerDraft(decision: AiDecision) {
  if (!decision.draft_reply && decision.ai_may_continue) return 'AI returned an empty draft.'
  if (/[—–-]/.test(decision.draft_reply)) return 'Draft contains prohibited dash punctuation.'
  if (decision.draft_reply && decision.draft_reply[0] !== decision.draft_reply[0].toLowerCase()) return 'Draft must begin with lowercase text.'
  if (decision.draft_reply.length > 420) return 'Draft is too long for the approved SMS style.'
  if (decision.requires_human && decision.ai_may_continue) return 'Human escalation cannot allow autonomous continuation.'
  if (decision.automation_state.send_allowed !== false) return 'Draft only mode cannot allow sending.'
  return null
}
