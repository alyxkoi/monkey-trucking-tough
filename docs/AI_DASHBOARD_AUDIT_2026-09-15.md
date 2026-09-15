# AI and dashboard audit · September 15, 2026

## Architecture verified in source

- Intake: website → `send-contact-email` / intake transaction → customer + lead + consent request. Incoming SMS → signed sent.DM webhook → idempotent `ingest_sms_event` / `record_inbound_sms`. Unknown numbers are retained. The reconciliation worker is a secondary provider-inbox recovery path.
- Replies: eligible inbound event → revision-bound communication job → `process-communications` → shared `ai-engine` → structured decision → `autonomousReply` → immutable outbox → final SQL eligibility check → sent.DM. Delivery updates attach to the original provider message ID. Nothing in the new sandbox can enqueue a message.
- AI: server environment selects direct OpenAI or the managed gateway. The original fallback model is `gpt-5.6-terra`; this fallback is not proof of the live model. The new control endpoint reports configured and actually observed model IDs separately and verifies the connected provider inventory. Model changes must pass a structured-response test. Existing model selection is preserved by default.
- Context: latest 80 lead messages, saved known/missing/uncertain facts, original lead intake, customer, three recent quotes/jobs/invoices, five verified payment records, official materials and delivery/tax settings. Draft generation uses the Responses API with strict JSON schema, 2,500 output-token budget, 45-second attempt timeout and at most one transient retry. No provider conversation memory is required (`store:false`).
- Deterministic tools: material identity and quantity resolution; tons divided by saved loose bulk density; one-yard internal reserve rounded upward to half yards; standard material/load pricing; Google Routes driving distance; current delivery tiers and tax. No scale means these remain approximate volume estimates, not verified weights or a guaranteed compacted thickness.
- Quote application: existing database RPCs only update eligible untouched draft quotes with the expected conversation revision. Staff edits and sent/accepted records remain protected. Financial actions, discounts, custom work pricing, complaints and takeover still require staff.
- Live updates: Supabase realtime for messages/leads/customers/jobs/outbox, immediate message merge, 75ms coalesced refresh, five-second message fallback, three-minute full refresh, resume/online reconciliation. Provider and queue recovery cron remain at the previously approved ten seconds. This has ongoing API/database cost; this pass does not add another fast polling loop.
- Automation: runtime gates are separate from individual rule status. Existing consent, STOP/START/HELP, marketing approval, business hours, monthly follow-up cap, idempotency, lease and revision checks remain in SQL. Calling/missed-call integration is not implemented by this pass.

## Root causes and targeted corrections

1. Address extraction dropped multiline details and did not recognize Expy. It now keeps pasted address lines and recognizes expressways, suffix abbreviations, ZIP follow-ups and city answers.
2. Routes API `geocoderStatus` is a `google.rpc.Status` object, not the legacy Directions `"OK"` string. Comparing `{}` to `"OK"` rejected successful routes. Corrected, with tests using the actual object-shaped payload. [Google reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes).
3. Clarification repeatedly demanded an already-provided full address. It now names the location to check and asks a specific question, rather than restarting the checklist. Partial/failed geocoding still never invents mileage.
4. Six conversational AI replies per hour silently cancelled normal exchanges. Replaced only that cutoff with a 12-per-minute emergency burst circuit breaker and an explicit `AI_BURST_GUARD` error. Scheduled follow-up limits remain unchanged.
5. Conversion prose exposed internal reserve calculations. Customer text now presents an approximate recommended yard amount; reserve details stay in staff tool results. Ordinary Yes responses no longer trigger the conversion template. A clear acceptance of a single preceding yard proposal updates the quantity; ambiguous multiple options do not.
6. Form facts were available to the model but omitted from deterministic routing/quantity tools. Added them as older context, with newer conversation corrections taking precedence.
7. Material readiness and aliases depended on mutable display names. Added immutable `catalog_key` identities to existing rows. The current already-renamed asphalt row is mapped without changing its UUID, rates, density or history. Existing material edits no longer reset load capacity.
8. Material editing now expands within its own card. Worker names wrap above status badges. Mobile New opens a spring speed dial with four existing creation flows, Escape/outside dismissal and reduced-motion support. Record Payment now opens the actual payment flow. Desktop Enter sends, Shift+Enter inserts a newline, and mobile/IME entry is preserved.

## Controls and review scope

`ai-control` is staff-authenticated; settings changes and rollback require an administrator. It exposes sanitized diagnostics, not credentials. Editable values are model selection, tone, concise presentation and review enablement. Existing language, initial-delay and routing controls continue to use their original settings.

The conversation sandbox uses the production engine and current server tools through an isolated read-only synthetic context. No real lead ID is accepted and no customer messages, state, quotes, audit drafts or outbox rows are written. AI and Maps calls still consume provider usage.

The three-day improvement review is deliberately rules-based and recommendation-only: it flags generation failures, repeated replies and explicit customer corrections. It does not rewrite itself or silently change any business rule. Settings edits/rollback create new versioned history entries; concurrent stale edits are rejected. The UI shows the latest 20 entries while retaining older records. A daily cron invokes the review, and the database three-day gate prevents duplicate reviews.

## Deployment sequence

1. Apply `20260915120000_ai_control_audit.sql` once. Adds stable catalog keys, settings/history tables, secured version/review RPCs and the narrow conversational guard replacement. Does not rewrite prices, quantities, historical snapshots or consent.
2. Redeploy `ai-draft`, `process-communications`, and new `ai-control`, including shared modules.
3. Install/update the named `ai-conversation-review` schedule (`0 8 * * *`). Keep all existing messaging/email schedules and runtime gates unchanged.
4. Publish frontend from the tested main commit.
5. Verify live diagnostics, provider model inventory, Google route sandbox, English/Spanish, Yes continuation, staff escalation, no new SMS/outbox records, and responsive settings UI.

## Pre-deployment live baseline

Verified through Cloud SQL and signed-in production settings: business number +19453750877; SMS/AI/routes/email READY; Calling SETUP_REQUIRED; delay 0; both languages and takeover enabled; ten active material factors configured; origin 7653 S FM 148, Kaufman, TX 75142. Runtime AI and scheduled sending enabled, marketing approval false. Do not interpret UI improvements as permission to activate setup-required rules.

## Verification record

Local production build and app TypeScript check passed. The full suite passed 336 tests with two workers; additional focused route/city coverage is being included in the final run. The database tests execute migration, authorization, version conflict, review cadence, material rename and protected SMS guards in PostgreSQL (PGlite). The sandbox tests verify no real business-table writes or sent.DM calls.

Live publication and post-deployment checks are pending until recorded below. Do not claim carrier delivery or overall production completion based only on build results.
