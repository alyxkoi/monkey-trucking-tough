import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { generateAiDraft } from '../_shared/ai-engine.ts'
import { aiConfig } from '../_shared/ai-config.ts'
import { HttpError, requireStaff } from '../_shared/staff-auth.ts'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const actor = await requireStaff(service, req)
    const result = await generateAiDraft(service, await req.json(), actor.id, aiConfig())
    return json(result)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI drafting failed', send_allowed: false },
      error instanceof HttpError ? error.status : 502)
  }
})
