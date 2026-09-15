import type { AiConfig } from './ai-engine.ts'

export function aiConfig(): AiConfig {
  const direct = Deno.env.get('OPENAI_API_KEY')
  const apiKey = direct ?? Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) throw new Error('The managed AI connection is unavailable')
  return {
    apiKey,
    baseUrl: Deno.env.get('OPENAI_BASE_URL') ?? (direct ? 'https://api.openai.com/v1' : 'https://ai.gateway.lovable.dev/v1'),
    model: Deno.env.get('OPENAI_MODEL') ?? Deno.env.get('LOVABLE_AI_MODEL') ?? 'gpt-5.6-terra',
    googleMapsApiKey: Deno.env.get('GOOGLE_MAPS_API_KEY'),
  }
}

// Server configuration is authoritative; editable options are narrowly scoped.
// Supabase's schema-aware client and the test adapter both provide this chain.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function configuredAi(service: { from: (table: string) => any }): Promise<AiConfig> {
  const config = aiConfig()
  const result = await service.from('ai_operation_settings').select('model,tone,concise,version').eq('id', 1).single()
  if (result.error) throw new Error('AI control settings could not be loaded')
  return { ...config, model: result.data.model || config.model, tone: result.data.tone, concise: result.data.concise, version: result.data.version }
}
