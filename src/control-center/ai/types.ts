export type AiLanguage = 'ENGLISH' | 'SPANISH' | 'SPANGLISH'
export type AiConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type AiRecommendedAction =
  | 'ASK_NEXT_MISSING_FACT'
  | 'PROVIDE_STANDARD_PRICE'
  | 'HOLD_FOR_SALVADOR'
  | 'VERIFY_PAYMENT'
  | 'MANUAL_REPLY'
  | 'NO_ACTION'

export type AiFact = {
  key: string
  value: string
  source: 'CONVERSATION' | 'RECORD' | 'PRICING'
}

export type AiDecision = {
  detected_language: AiLanguage
  customer_intent: string
  extracted_facts: AiFact[]
  known_facts: AiFact[]
  missing_facts: string[]
  uncertain_facts: string[]
  ai_may_continue: boolean
  requires_human: boolean
  escalation_reason: string | null
  recommended_action: AiRecommendedAction
  draft_reply: string
  confidence: AiConfidence
  deterministic_pricing_required: boolean
  payment_claim_detected: boolean
  automation_state: {
    mode: 'CONVERSATION' | 'AUTOMATION_DRY_RUN'
    rule_id: string | null
    transport: 'SETUP_REQUIRED'
    send_allowed: false
  }
}

export type AiDraft = {
  id: string
  lead_id: string | null
  customer_id: string
  automation_rule_id: string | null
  status: 'DRAFT' | 'DISCARDED'
  body: string
  language: AiLanguage
  decision: AiDecision
  created_at: string
}

export type AiEvaluationResult = {
  draft: AiDraft
  decision: AiDecision
  tool_results: Record<string, unknown>
}

export type AutomationPreview = {
  ruleId: string
  ruleName: string
  eligible: boolean
  customerId: string | null
  customerName: string
  subjectType: 'LEAD' | 'QUOTE' | 'JOB' | 'INVOICE' | 'CUSTOMER' | 'CALL' | null
  subjectId: string | null
  dueAt: string | null
  reason: string
  blockedReason: string | null
  language: AiLanguage
  draft: string
  stopConditions: string[]
  humanTakeoverBlocking: boolean
  channel: 'SMS'
  transport: 'SETUP_REQUIRED'
}
