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

Deployment evidence and final verification results are recorded below after rollout.
