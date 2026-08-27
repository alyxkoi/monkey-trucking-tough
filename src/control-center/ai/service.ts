import { supabase } from '@/integrations/supabase/client'
import type { ControlData } from '@/control-center/data'
import { evaluateConversation, validateCustomerDraft } from './decision'
import type { AiEvaluationResult, AutomationPreview } from './types'

function demoResult(data: ControlData, leadId: string): AiEvaluationResult {
  const lead = data.leads.find((item) => item.id === leadId)
  if (!lead) throw new Error('Lead not found.')
  const evaluated = evaluateConversation({
    messages: data.messages.filter((message) => message.lead_id === leadId),
    humanTakeover: lead.human_takeover,
    materials: data.materials,
    appSettings: data.appSettings,
  })
  const invalid = validateCustomerDraft(evaluated.decision)
  if (invalid) throw new Error(invalid)
  return {
    decision: evaluated.decision,
    tool_results: evaluated.toolResults,
    draft: {
      id: `qa-ai-draft-${leadId}`,
      lead_id: leadId,
      customer_id: lead.customer_id,
      automation_rule_id: null,
      status: 'DRAFT',
      body: evaluated.decision.draft_reply,
      language: evaluated.decision.detected_language,
      decision: evaluated.decision,
      created_at: new Date().toISOString(),
    },
  }
}

export async function generateConversationDraft(input: { data: ControlData; leadId: string; demo: boolean }) {
  if (input.demo) return demoResult(input.data, input.leadId)
  const { data, error } = await supabase.functions.invoke('ai-draft', {
    body: { mode: 'CONVERSATION', lead_id: input.leadId },
  })
  if (error) throw new Error(error.message || 'AI draft generation failed.')
  if (data?.error) throw new Error(data.error)
  return data as AiEvaluationResult
}

export async function generateAutomationDraft(input: { preview: AutomationPreview; demo: boolean }) {
  if (!input.preview.subjectType || !input.preview.subjectId) throw new Error('This automation has no current subject.')
  if (input.demo) return input.preview.draft
  const { data, error } = await supabase.functions.invoke('ai-draft', {
    body: {
      mode: 'AUTOMATION_DRY_RUN',
      automation_rule_id: input.preview.ruleId,
      subject_type: input.preview.subjectType,
      subject_id: input.preview.subjectId,
    },
  })
  if (error) throw new Error(error.message || 'AI automation preview failed.')
  if (data?.error) throw new Error(data.error)
  return String(data?.decision?.draft_reply ?? '')
}
