# Conversation reliability and staff alerts

## Production evidence

The completed September 22 test job/invoice was traced through database records, not inferred from the screen:

- Job completed at 14:34:58 UTC; invoice fully paid and review eligibility stamped at 14:36:49 UTC. Confirmed payments equal the invoice balance.
- Invoice email notice reserved at 14:36:21 UTC used `HUMAN`, which paused the lead. The real staff reply at 14:18:12 had already been explicitly resumed at 14:18:15. The invoice notice was the later false takeover.
- Consent/double opt-in exist, no STOP is active, SMS is READY, scheduled sending is enabled. The review guard rejected the paused conversation before any review job was created.
- The delivery-audit trigger used `NULL <> 'review-request'`. SQL's nullable condition fell through, incorrectly logging the invoice delivery as `REVIEW_REQUEST_SENT`. Migration 0040 corrects this and relabels provably false historical audit entries without deleting them.
- The name parser accepted “it's okay” and failed to recognize “What name should we put this under?” as a name question. The customer subsequently answered “tyrone”, which the AI used in its reply but did not persist.

## Implementation

- Same customer outbox, new verified `TRANSACTIONAL` origin for invoice notices and approved business confirmations. Neither pauses AI nor resumes an existing pause. Only a real HUMAN reply triggers takeover. First-contact opt-in no longer creates a false pause.
- Inbound storage remains immediate. Durable reply due time is 3 seconds; targeted background wake is 3.1 seconds, with the existing fast cron as fallback. Ordered adjacent messages within 10 seconds (maximum six) form a turn. Newer revisions invalidate obsolete generations/reservations. Original messages remain unchanged.
- Contextual name extraction rejects acknowledgments, supports the actual name question, and shares ordered evidence with database writes. Email corrections retain identity collision and document-only recipient protections. Sandbox historical turns no longer receive artificial millisecond spacing; explicit timestamps can model bursts.
- Reviews retain completion/full-payment eligibility, current consent/runtime/provider checks and one-send-per-job keys. Ordinary inbound does not cancel a review or invalidate it merely by advancing a conversation revision. STOP and actual takeover still block it.
- Business-record triggers clear stale intake missing facts and append resolutions only for fulfilled quote-ready/payment/custom-work/human requests. Genuine unresolved actions remain. Terminal delivery/generation failures become staff actions; confirmed recovery resolves matching failures.
- Staff alerts remain deterministic and use the existing internal outbox. Eight action-required categories and four optional business categories have real enqueue/dispatch preferences. Short locators resolve only after staff authentication, with no public record lookup. STOP/START and internal-number isolation remain.
- Existing dashboard toggles are shared, staff history refreshes automatically while visible, and the manual refresh button is removed. Shared sheets constrain horizontal layout. A ResizeObserver measures the actual action footer, including wrapping, so page padding clears navigation and safe-area space.

## Footer finding

The application appended its own STOP sentence to the **test alert**. That duplicate body sentence was removed. The legacy approved template remains unchanged. A live staff test then found sent.DM rejects newlines inside template variables (HTTP 400 / `VALIDATION_008`). Migration 0044 adds a dedicated template layout with four single-line variables and a valid legacy one-line fallback. The dedicated template keeps one opt-out line; removal has not been verified as permitted. No claim is made that sent.DM automatically appends it or that it is legally mandatory on every internal message.

Official provider contracts: [variable validation](https://docs.sent.dm/reference/api/error-catalog), [template body rules](https://docs.sent.dm/reference/api/template-definition). Template line breaks must be literal layout, and adjacent variables require non-whitespace labels. An authenticated staff test can provision the fixed template once with provider idempotency; only a verified published, approved SMS template becomes active. Rejected/pending setup is shown as an actionable error. Customer templates and immutable sent payloads stay untouched.

## Verification

653 tests across 73 files passed before the initial deployment; final provider-layout/error/approval regression coverage brings this to **661 tests across 74 files, all passing**. TypeScript app check, changed-file ESLint and production build passed. Build retains existing bundle-size/Browserslist warnings.

Coverage includes burst correction/name/email writes, obsolete revision rejection, real versus automated takeover, silent full payment through actual PostgreSQL worker/outbox/dispatch with a stub carrier, ordinary inbound during review dispatch, STOP, authenticated short links, per-type/master toggles, duplicate events/retries, recovery, and the existing Accepted/Scheduled/pricing/payment/ticket regression suite.

Local no-write demo browser checks: Schedule Job at 320/375/390/430px has matching client/scroll widths and a working vertical scroll area. Draft quote totals clear its measured footer (103px normally, 167px when wrapped at 320px). At the bottom of the 320px page, final content ends 16px above the action footer. Sent quote final actions remain visible above navigation.

## Deployment order

Apply **one copy only**, in order (Drizzle and Supabase files are mirrors):

1. 0040 / 20260923100000 conversation origin and bursts
2. 0041 / 20260923101000 staff preferences and links
3. 0042 / 20260923102000 business-event attention
4. 0043 / 20260923103000 communication failure actions
5. 0044 / 20260923110000 provider-safe staff template layout

Redeploy the functions bundling the changed engine/kick: `ai-draft`, `ai-control`, `process-communications`, `sent-dm-webhook`, `reconcile-sent-conversations`, `send-contact-email`. Keep secrets and schedules unchanged. Publish frontend after database/function verification.

`docs/sql/20260923_verified_test_conversation_repair.sql` is a separate, guarded repair for only the traced test conversation. It verifies the exact invoice notice and earlier staff resume, refuses to override later genuine staff replies/open requests/new AI activity, corrects only the proven malformed name, records before values, and invokes normal review planning. It does not alter payments, consent, invoices or sent payloads, replay old inbound texts, or launch a historical customer review campaign.

## Verified production results

- Initial implementation `65f986b`, deployment-path correction `cfd4fec`, metadata `30ee3a7`. Migrations 0040–0043 applied once, six functions redeployed, frontend published. Prompt v18 and all 12 staff preference toggles observed live.
- Guarded repair succeeded: Tyrone's lead revision 20 → 21, false takeover removed, malformed customer name corrected with audit history. No consent/financial records changed.
- Exactly one review message `1e120fb7-da65-4162-9655-b8caaee47c09` was submitted once and is **DELIVERED**, provider `f62996be-f519-4c13-9850-c146ec13d614`. Confirmed directly in Cloud SQL, including the correct Google review URL and preserved warm wording.
- Live no-SMS sandbox handled “I need 20 yards of flexbase, please and thank you” naturally in **12.67 seconds**, asking for the delivery address without escalating.
- Authenticated `/a/A9793CE927` redirected to the intended Tyrone lead. Database grants deny public link-table access and anonymous resolver calls. Authentication/role handling is regression tested.
- Tyrone has no false attention banner. Remaining Overview cards were inspected: Alexander has an unfinished draft and unanswered request, Alex has a failed opt-in, BigBoy Ricky has unresolved custom pricing. They were correctly retained.
- Provider-layout correction `581f52a`, migration metadata `97e24a1`, actionable-error UI `922454d`, template-content contract fix `7300b59`. Only `send-sms` needed additional backend deployments; customer/review paths were untouched.
- Staff fallback test `4529b5af-ea7d-4472-985b-31c1e60fa800` is **DELIVERED**, observed in the auto-refreshing live settings log. The earlier rejected multiline-variable test remains FAILED in history; it was not silently reset or resent.
- Dedicated template `64c74095-7b67-4c56-bb4c-856790ace415` was created once. Final provider readiness inspection returned HTTP 200, **PENDING**, `is_published=false`, channels SMS/WhatsApp/RCS. It is not marked ready. The existing approved fallback remains in use.
- Queued staff sends now recheck an existing pending template with a 5-second limit before authorizing a new payload. Only APPROVED + published + SMS support activates it. Idle worker ticks never poll/create templates, previously reserved payloads stay immutable, and an approval-check outage falls back to the existing approved route. `send-sms` and `process-communications` are the only internal dispatch callers requiring this final shared-helper deployment. No customer send path changes.
- Pre-existing migration-journal omission for 0028 was reported by the deployment tool and left unchanged; this pass appended only its own migrations.
