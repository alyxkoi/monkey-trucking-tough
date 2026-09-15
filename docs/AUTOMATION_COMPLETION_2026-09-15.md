# Automation completion audit

## Baseline and implementation

The existing architecture is retained: business-time candidate SQL → durable communication job → contextual composition → final eligibility check → immutable SMS outbox → sent.DM → reconciled delivery status. One scheduler and the existing provider reconciliation remain in place. No pricing, AI conversation, consent, STOP/START/HELP or marketing-approval gates were removed.

Live baseline: job reminder, new-lead follow-up and quote follow-up ON. The other four rules SETUP_REQUIRED. SMS READY, calling SETUP_REQUIRED, marketing_approved=false, review_url=null. No call-event tables exist.

Changes:

- Invoice reminders use real invoice number, amount, due date, language and sequence step. They stop on customer response, invoice edits, dispute, payment claims, recorded payment, opt-out or takeover. Pending invoice jobs and unsubmitted SMS are cancelled immediately when the invoice/payment changes. Final dispatch still rechecks authoritative records.
- Weekend-adjusted invoice steps cannot create a simultaneous burst. The latest due step wins if business-hour adjustments collapse multiple steps. Original due / +1 / +3 day timing remains.
- Review/reactivation require a completed job and nonvoided confirmed payment records covering the invoice, not just a PAID label. Timing starts from the later of payment and completion. Existing marketing approval and marketing consent remain mandatory. Reactivation stops after renewed activity or more recent paid work.
- Review wording is neutral and work-type-aware; it does not select only happy customers or invent a successful outcome. Reactivation keeps the optional tone, Spanish “a su servicio,” and STOP instructions. Deterministic financial facts are not delegated to model arithmetic. Lead and quote follow-ups retain the existing shared AI engine.
- Existing customer/invoice history now records automation states and an idempotent sent-reminder event. A final reminder creates the existing staff-attention condition even when business hours caused an earlier step to be skipped.
- Settings displays the real setup reason. The migration itself enables no rule.
- A bounded invoice verification path allows exactly one invoice on the existing test-number allowlist for at most 30 minutes while its rule still displays SETUP_REQUIRED. It preserves every normal consent, eligibility, business-hour and dispatch safeguard, and does not enable other customer traffic. Verification is closed after testing.

## Provider and compliance findings

The [sent.DM event reference](https://docs.sent.dm/start/webhooks/event-types) documents message and template events, not a missed-call event contract. No voice credentials, number capability or signed inbound voice integration may be inferred from successful SMS or connected WhatsApp. The current browser session is signed out of sent.DM.

The [sent.DM registration guide](https://docs.sent.dm/start/advanced/10dlc-registration) distinguishes messaging use cases. The available campaign evidence is Customer Care; the runtime's marketing approval is false. Offering another project/material after 60 days is promotional. Reactivation must remain blocked until the campaign coverage is verified and customer marketing consent is recorded. Review requests also retain their existing campaign gate until verified, and need the business's actual review URL.

## Verification

- 403 tests across 52 files passed, including 21 new tests (9 composition cases, 4 PostgreSQL integration scenarios with multiple assertions, 3 receipt reconciliation cases, and 5 invoice attention state cases).
- Database tests execute the production migration, scheduler, worker, outbox and delivery reconciliation. The carrier HTTP response is simulated in these local tests.
- Tests cover due/one/three day scheduling, weekend collisions, exact-subject/time-limited verification, non-allowlisted denial, payment cancellation after reservation, changed due dates, customer replies, paid/completed ledger evidence, marketing/review URL blocks, one-time duplicate guards, missed-call fail-closed behavior, and the three previously ON rules.
- TypeScript, changed-file lint, production build and diff checks pass. Existing chunk-size/Browserslist/React Router warnings remain.

## Live verification

- Managed migration 0016 is byte-equivalent to the repo's 20260915193000 migration. process-communications was deployed from ad81348. The managed deployment confirmed no calling/voice-specific credential names are configured.
- The existing opted-in test recipient ending 8256 had no human takeover. Exactly one non-billable invoice TEST ONLY NO PAYMENT 20260915 ($0.01) was created under a ten-minute exact-subject verification window. The rule remained SETUP_REQUIRED throughout testing; no other customer was enabled.
- The existing scheduler generated job e73cb9af-e672-4b1e-b6d2-f78c2d456d10 and message 1ed6468f-97df-49be-89dc-5db3b77808b3, submitted once. sent.DM ID 5c994c32-ccf8-45b6-811f-2c3cfc3f38a9 was QUEUED/SENT at 19:45:05 UTC and DELIVERED at 19:45:08 UTC. An authenticated provider lookup verified this and reconciled the same record. No resend occurred.
- A live rollback-only transaction verified eligibility before payment and rejection after a confirmed payment record; zero test payments persisted.
- The test invoice was voided through the normal authenticated history-writing dashboard workflow at 14:53 CDT. The record/history are retained; no payment was requested or collected.
- This exposed a real receipt gap: no outbound status callbacks were recorded today. The existing ten-second reconciliation only ingested inbound messages, so it could not repair stale outbound QUEUED states. The follow-up migration adds bounded GET-only receipt claims to the same worker: two records per run, each at most once per minute, seven-day lookback, no new timer, and no resubmission. Terminal delivered/failed messages are not polled. Unchanged background checks do not spam activity history; lookup failures remain visible without preventing inbound processing.

## Deployment and final readiness

- Receipt reconciliation deployed from 32af034, with managed migration 0017 matching the source function (the managed runner omits the outer transaction wrapper). Live checks found ten receipt records checked, the test message DELIVERED with one attempt, a fresh successful sync and no sync error. Both existing cron entries remain active at ten seconds; no duplicate cron was added.
- Invoice follow-up was promoted to ON only after those assertions and the live payment-stop check passed. enabled_at prevents historical reminder catch-up. The exact-invoice verification fields were cleared. A VERIFIED_AND_ENABLED event records the test message and verification results.
- Job reminder, new-lead follow-up, quote follow-up and human takeover remain ON.
- 60-day reactivation remains SETUP_REQUIRED: current campaign evidence is Customer Care, not approved promotional traffic. Existing marketing approval and recipient marketing consent must be verified before enabling.
- Review request remains SETUP_REQUIRED: no verified business review URL, and campaign coverage has not been verified. Its actual completed/paid trigger, safeguards and one-time scheduling are implemented but no live review request was sent.
- Missed-call recovery remains SETUP_REQUIRED: no inbound/missed-call event source or configured voice credentials. Connected SMS/WhatsApp is not evidence of a calling integration. No fake call events/readiness were added.
- The controlled invoice is VOID with audit history preserved and no persisted payments. Blocked marketing/review/calling paths have regression-tested denial, not claimed live sending success.

## Publication security review

The first frontend publish attempt was blocked by auto-review. The refreshed Lovable scan displayed three warnings. These were investigated without ignoring findings or weakening policies:

- The contact form deliberately invokes send-contact-email; only that server function writes contact_submissions with its service credential. Anonymous direct INSERT remains forbidden, as documented in the existing consent migration. This release does not alter that path.
- Live pg_proc checks confirm every added automation helper, trigger, guard and receipt claim uses a fixed public, pg_temp search_path and is not executable by anon/authenticated roles. Existing authenticated business RPCs are not newly exposed by this release.
- The only public mutable-search-path function is protect_material_catalog_key, an invoker-security trigger already present in published baseline dd1bebc. This release does not change it.
- Frontend diff against dd1bebc is limited to automation setup explanations and final-reminder attention/data mapping, plus generated types/tests. A precedence issue found during final review was corrected and covered for SENT, PAID, VOID, disputed and claimed-paid invoices.

Frontend commit 499f608 was pushed to main and published successfully after this evidence review; Lovable confirmed “Your website was updated.” The live /admin/settings/communication page shows Invoice follow up ON, the other three previously enabled rules ON, and all three blocked rules with their exact setup reasons. No new console errors occurred on that page after publication. The browser's earlier retained error was an operator navigation to the wrong invoice URL; the correct /admin/money/invoices route worked and retained the void/audit history.
