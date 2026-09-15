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
9. Live bilingual testing exposed an older lowercase-only formatting check rejecting valid Spanish drafts. Opening capitalization is now normalized before validation. Business-rule validation is unchanged. Sandbox errors now display the actual failure instead of a generic non-2xx message.
10. Street-only input now asks for one locality hint before Google can select a similarly named street elsewhere. A corrected ZIP replaces the earlier ZIP. If Google still cannot resolve the same location after the same clarification was answered, an explicit `ADDRESS_RESOLUTION_LOOP` stops repetition and requests staff review.

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

Local production build, app TypeScript check, changed-file lint and diff checks passed. Final full suite: **341 tests in 49 files passed**, two workers, September 15 at 09:57 CDT. The database tests execute migration, authorization, version conflict, review cadence, material rename and protected SMS guards in PostgreSQL (PGlite). Sandbox tests exercise the production engine and verify no real business-table writes or sent.DM calls, including takeover and unresolved-address loop handling.

Published frontend: `33b294c4f47734e7de6e5bfb867a71d542e84572`, including mobile/diagnostic polish `d00ac06`. Backend `ai-draft`, `process-communications`, and `ai-control` subsequently deployed from `b718f5b38bd9ab13f5b0c4a2931e559bd3d2c71d` for the isolated capitalization fix. Migration applied once through the existing Cloud workflow, recorded as `drizzle/migrations/0015_ai_control_audit.sql`. Deployment regenerated material types; the test fixture was updated and typecheck rerun successfully.

### Live results

- Signed-in controls report **gpt-5.6-terra**, both configured and last observed, through **api.openai.com**, prompt v8. Provider model inventory was fetched successfully; no more expensive model was selected.
- Ten tons of flexbase produced approximately **8.5 recommended yards** using the existing 1.4 factor and internal reserve. Customer text did not expose the reserve. First reply identified Monkey Trucking once.
- Exact multiline Google address `839 S Good Latimer Expy / Dallas, TX 75226 / United States` resolved to **51,334 meters / 31.8975 miles**, with the saved origin and delivery formula. Sandbox material $323 plus delivery $318.97 yielded $641.97 under the current tax configuration. No real quote was changed.
- The next **Yes** asked for the preferred delivery date, without repeating the introduction, conversion or address question.
- **Street only → specific city/ZIP question → 75226** resolved the route and reused the form's 20 yards of flexbase. No full-address loop.
- Spanish/Spanglish `sí, cuánto cuesta con delivery?` reused all form facts and returned Spanish pricing after the capitalization correction. It did not restart qualification or add a reserve to a yard-based order.
- Pond pricing correctly returned **Custom work pricing requires Salvador**, without inventing a price or sending a message.
- Model inventory, diagnostic status and review cadence were exercised through the authenticated production UI. Deployment checks also verified no-token and invalid-token requests return 401. The first recommendation review ran; a second due-review request correctly said it was not due.
- At **09:59 CDT**, SQL verified **zero new lead messages and zero new SMS outbox records during the sandbox test window** beginning 09:40. All ten catalog identities exist. Exactly one active worker cron and one provider recovery cron remain at ten seconds, plus one daily review cron. Provider reconciliation last succeeded at 14:59:37 UTC with no error.
- Signed-in production browser reported no console errors and no remaining alert after the tests. Mobile demo checks at 375×812 and landscape 667×375 verified inline material edit/save, worker layout, speed dial layering and the existing Record Payment flow. No payment was recorded. UI/UX skill guidance informed touch targets, focus, safe areas and reduced motion.

### Boundaries

This pass used live OpenAI/Google sandbox requests and automated database/transport regressions, **not a new carrier SMS round trip or a real invoice/payment transaction**. Existing real communications and business data were preserved. Calling/missed-call events remain unverified; promotional and other setup-required rules were not activated. The improvement review is a conservative rules-based recommendation system, not a semantic LLM review of every conversation and not autonomous prompt rewriting. Pricing, delivery, consent and automation eligibility never self-modify.
