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
