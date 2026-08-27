# AI draft Edge Function

`ai-draft` is the authenticated, server-only OpenAI boundary for Monkey Trucking.

- It uses the Responses API with a strict JSON schema and `store: false`.
- It checks `public.is_admin_or_staff()` before reading customer context.
- It accepts only record identifiers from the browser and assembles scoped context server-side.
- It writes `ai_audit_logs`, `ai_conversation_state`, and `ai_drafts` only.
- It contains no SMS, email, calling, payment, ticket, or financial mutation path.

## Managed server configuration

The function uses the existing Lovable-managed secret path. It prefers `OPENAI_API_KEY` when the connected integration exposes it and otherwise uses `LOVABLE_API_KEY` through Lovable's AI gateway. No secret belongs in a `VITE_*` variable.

Optional server-side configuration:

- `OPENAI_MODEL` or `LOVABLE_AI_MODEL` selects the connected supported model.
- `OPENAI_BASE_URL` overrides the Responses-compatible server base URL when the managed integration provides one.

If the managed service is unavailable, the function logs a failed audit, returns a retryable error, and creates no draft or business-state mutation.

Apply `supabase/migrations/20260827143000_phase06_ai_draft_dry_run.sql` before deploying this function.
