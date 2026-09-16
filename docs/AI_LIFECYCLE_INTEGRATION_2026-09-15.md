# AI lifecycle and dashboard integration

## Architecture and authority

Built on main `1aa22ef`, preserving the recent automation completion work. No model change, extra scheduler, customer identity system, task table, or independent lifecycle state machine.

| Existing records | Derived behavior |
| --- | --- |
| Lead, no current quote | Intake and quoting; collect missing name naturally |
| Draft quote | Update eligible deterministic material/route values; gather requested date and confirmed email |
| Draft with `ai_ready_at` | Staff Review & Send; never automatic quote sending |
| Sent quote | Reactive questions; existing quote follow-up remains responsible for outreach |
| Accepted quote | Scheduling preferences; protected financial commitment |
| Scheduled/in-progress job | Actual arrival schedule and access notes; changes require staff review |
| Completed job / sent invoice | Completion/payment conversation; claims are not payments |
| Paid invoice plus confirmed, nonvoid payments | Quiet post-job; new work starts a fresh lead for the same customer |

The shared engine scopes quote/job/invoice/payment context to the current lead's transaction. Phone/customer ID remains identity. Names never merge customers. A collision on another customer's email creates a contact-review action without merging or partially changing the name.

## Controlled writes and audit

Migration `20260915220000_ai_lifecycle_actions.sql` adds requested delivery fields to leads, quote preparation fields to quotes, and an exact acknowledgment message pointer for human handoff. No historical business status is rewritten.

Service-only `apply_ai_lifecycle` locks the customer/lead and requires the current customer message, matching conversation revision, no opt-out, high-confidence permitted proposal, and no clarification. It can update supplied names/email, verified delivery address, requested date/time, exact customer job notes, and eligible draft contents through the existing material/route RPCs. Ambiguous email/date or uncertain model facts cannot authorize a write.

Each application records source message, entity IDs, before/after contact, lead, quote/items, job and invoice state in existing `activity_history`. Source-message idempotency prevents repeated changes. Staff-only resolution RPC appends history rather than deleting requests.

Accepted/sent quotes, manual financial overrides and actual calendar bookings remain protected. Order/address/schedule requests become staff actions; route/price tools still calculate the requested change. Payment claims set the existing claim fields, never create a payment. Returning work preserves old quote/job/history.

## Quote Ready and staff workflow

Current material/quantity, verified route/pricing, resolved requested date/time, explicit quote request and exact current email confirmation are required. Eligible draft creation/calculation happens atomically. Staff-protected drafts require review rather than receiving a false ready marker.

`AI_ACTION_OPEN` and `AI_ACTION_RESOLVED` history events feed the existing Overview attention ranking. The staff view links to current quote/job/invoice/lead screens and accepts resolution notes. Quote-ready actions disappear when sent or invalidated; payment claims disappear when no longer outstanding; human requests disappear after resume. Quote or line-item edits invalidate readiness. The existing single realtime channel now includes these business records, with the same coalesced refresh.

## Conversation and settings

English/Spanish dates use America/Chicago. Explicit AM/PM/noon and windows are supported; morning-only or missing AM/PM gets clarification. Preferences never book capacity. Scheduled arrival answers use actual calendar data; access instructions append job notes.

An explicit human request reserves one acknowledgment through the existing leased outbox and atomically pauses ordinary AI. Only that exact message can pass the pause guard. New revisions, staff replies, STOP, consent and other dispatch rules still win. This is reservation-before-pause, not an unguarded send or a promise of provider delivery.

Settings exposes the actual assembled behavioral instructions and prompt version `mt-ai-lifecycle-v10`, read-only, with capability limits. Secrets and customer context are not part of that view. The sandbox adds synthetic lifecycle scenarios, context replay and handoff pause; it cannot write real customers or send SMS.

## Preserved behavior

Existing event-driven worker, revision/lease/idempotency controls, provider routing, double opt-in, STOP/START/HELP, business hours, deterministic pricing and human takeover remain in place. No new idle model calls. Invoice/job/new-lead/quote automations remain unchanged. Marketing/reactivation, review and voice readiness are not falsely enabled.

## Verification

Regression coverage includes identity/email collisions, current-message/revision rejection, name collection, dates/timezone/clarification, email correction, quote preparation and invalidation, protected financial/calendar values, payment claims, returning transactions, single handoff acknowledgment, paused sandbox continuation, Overview destinations/removal, and unchanged communication/automation tests. Database tests execute the production migrations/RPCs in isolated PGlite transactions; provider/model responses are mocked in local engine regressions. Sandbox tests do not send real SMS or change production customers.

## Initial rollout attempt

- Implementation pushed to main as `3211ae0`.
- Full regression suite: **450 passed across 56 files**.
- Application TypeScript check: passed. Changed-file ESLint: zero errors; one existing AppState fast-refresh warning. Production Vite build: passed; existing bundle-size/Browserslist warnings remain.
- **Not deployed or published.** Lovable Cloud paused the scoped deployment request because its credits were exhausted, displaying that five credits arrive in about three hours. No credit purchase or plan change was made.
- Read-only production SQL confirmed `apply_ai_lifecycle`, `finish_ai_handoff` and `quotes.ai_ready_at` are all absent. Cloud shows ai-control last updated two hours earlier. GitHub remains at the tested implementation commit; no managed migration commit was produced. There is no partial lifecycle migration to clean up.
- The current published site was intentionally preserved. Publishing the new frontend before its required RPC exists would break dashboard loading.
- Direct deployment connector/credentials are not available in this session, and the Cloud function UI exposes logs/code viewing, not a deployment control.

### Deployment sequence followed on resume

1. Restore/wait for Lovable credits and resume the already submitted deployment-only request. Apply the exact migration, then deploy ai-control, ai-draft and process-communications with shared dependencies. No source regeneration, customer mutations, SMS or email sends.
2. Verify new columns, service-only/staff-only RPC grants, dispatch guard, realtime tables and unchanged automation/compliance settings with read-only SQL.
3. Test the deployed model through isolated sandbox scenarios: name capture, quote/date/email flow, scheduled notes/change requests, paid returning work, and acknowledged handoff followed by a paused turn. Local model/provider mocks are not a substitute for this pending deployed verification.
4. Publish via the existing project UI, then check production instructions, Overview/staff-action views, console and responsive layout. Record final deployment evidence here.

## Completed deployment and publication

Credits became available and the existing scoped request was resumed without any purchase or plan change. Managed deployment commit `9d7cc15` applied migration `0018_ai_lifecycle_actions.sql` and deployed `ai-control`, `ai-draft`, and `process-communications`. The managed migration matches the tested SQL statements; only comments and the runner-managed outer transaction wrapper differ. Generated Supabase types were refreshed; application source was not rewritten.

Independent read-only production checks confirmed all 11 lifecycle columns, all five additional realtime tables, the exact acknowledgment dispatch guard, service-only write RPCs, and staff authorization inside the two authenticated action RPCs. Marketing approval remains false. Invoice, job, new-lead and quote follow-ups and human takeover remain ON. Reactivation, review and missed-call recovery retain their prior exact setup restrictions.

Current main passed TypeScript, production build, and all **450 tests in 56 files** again after merging generated deployment files. Historical Lovable build-failure cards were investigated; the latest revision was selected and rebuilt locally before publication. The current basic scan showed two database warnings: authenticated SECURITY DEFINER functions (new authenticated functions enforce `is_admin_or_staff()`), and the unchanged invoker trigger `protect_material_catalog_key` without a fixed search path. No finding was ignored and no protection was weakened.

Lovable confirmed **“Your website was updated.”** The live dashboard displays `mt-ai-lifecycle-v10`, the read-only effective instructions, and all six synthetic lifecycle choices, with the configured model unchanged. Live isolated sandbox checks confirmed unknown-name prompting and extraction, one human-handoff acknowledgment followed by a paused next turn, verified-route date recap, quote consent, email collection, and quote-ready preparation for staff send. Scheduled arrival used the synthetic job's actual date/time. No real customer records, quotes, jobs, payments, SMS or email were created by these sandbox checks. Persistent write/audit/duplicate behavior is covered by the isolated database regression tests, not claimed as a real-customer test.

Published Overview and AI settings loaded with no console errors. Final deployed sandbox checks also passed for side-gate/code instructions, a Friday 9am schedule change explicitly held for staff review without changing the calendar, and a PAID customer requesting another delivery. The last scenario's displayed tool results confirmed stage PAID and action NEW_WORK against the synthetic quote, not an edit of historical terms.

The published desktop instruction panel was visually inspected. A requested 390px browser override did not change the actual 1265px viewport, so this run does not claim a verified mobile screenshot; the override was reset. No release blocker remains. Existing marketing/review/voice setup restrictions are separate from this completed lifecycle release.
