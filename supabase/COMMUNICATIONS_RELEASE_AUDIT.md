# Communications release audit — 2026-09-13

## Source checkpoint

Implementation commits: `aef5a62` and `0de87bf`, pushed to `origin/main`.
Previous baseline: `0f1e5bc`.

Implemented one durable outbox for dashboard, AI and scheduled SMS; immutable
operation identities; bounded retries and ambiguity quarantine; atomic webhook
ingestion and early/out-of-order status reconciliation; ordered compliance and
contextual double opt-in; human takeover and future-only resume; durable AI
jobs and guarded existing scheduled rules; truthful UI status, retained drafts,
server-side test allowlist and conversation realtime refresh.

No public-page redesign, provider substitution, customer campaign or call
integration was made. Existing dashboard refresh and email cron are preserved.

## Verified locally

- Full suite: 41 files, 264 tests passed after final source edits.
- Includes 16 executed PostgreSQL behavior tests, transport/HMAC/AI tests,
  composer tests and realtime scheduling/cleanup tests.
- Application TypeScript check and production Vite build passed.
- Deno 2.9.6 checks passed for all 12 Edge Function entrypoints. The four
  communications functions pin Supabase JS to 2.116.0.
- Targeted ESLint: zero errors; one existing AppState fast-refresh warning.
- Git whitespace/diff check passed.

PGlite is in-memory PostgreSQL, not proof of multi-connection concurrency or
carrier delivery. Remaining library/router/build warnings are not zero-warning
certification. The dependency installation reported 25 dependency audit
findings; no broad or unreviewed dependency upgrade was attempted.

## Production observed before this release

- Correct sent.DM 10DLC number and approved utility template confirmed.
- Three existing provider secret names present; no values displayed or changed.
- Customers 3, leads 2, messages 1; no historical data deleted.
- Four prior outbound webhook events were IGNORED by the old deployed handler.
- The earlier real handset test was FAILED in sent.DM, but incorrectly SENT
  locally. This historical discrepancy is now corrected, as recorded below.
- SMS TESTING; Calling SETUP_REQUIRED; AI READY describes draft generation,
  not autonomous sending. No fully double-opted-in customer was established.
- Existing email cron only; Vault has email_queue_cron_secret only.
- sent.DM registration is Customer Care. Promotional coverage and voice are
  unverified. Keep both gated.

## Production deployment and independent verification

The owner confirmed production permissions, private worker provisioning,
deployment and controlled tests to their handset. Backend deployment completed:

- Applied the three canonical migrations ending 170000, 171000 and 172000 once.
- Applied `20260913180000_worker_vault_auth.sql` verbatim through Cloud SQL.
  The migration tool rejects Vault references, so this last migration was not
  recorded by that tool. Verify its live function before any future migration
  runner attempts to apply it again.
- Deployed send-sms, sent-dm-webhook, ai-draft; redeployed process-communications
  with the Vault verifier from `0de87bf`.
- Installed `install_communications_cron.sql`: one named private Vault secret,
  one minute communications cron, existing five-minute email cron unchanged.
  No secret value was retrieved, printed, committed or copied to Edge secrets.
- Independent SQL checks observed three successive worker HTTP 200 responses:
  `{"planned":0,"job":{"processed":false},"dispatches":0}` before the test.
- Live HTTP checks rejected absent staff/worker credentials, forged role claims,
  an invalid 64-hex Vault token, and forged webhook signatures. Missing webhook
  signature headers return 400; other invalid credentials return 401.
- Independent function privilege checks found zero anon/authenticated execution
  grants on enqueue_sms, verify_communications_worker and wake_communication_worker.
- AI/scheduled/marketing gates remain false; one test handset; SMS TESTING;
  Calling SETUP_REQUIRED. Customer and lead counts remain 3 and 2.

Legacy hosted-check blockers were fixed minimally: two email callback type
annotations, a SupabaseClient type annotation, and the exact already-imported
Stripe 20.4.0 development dependency. The connected build tool reports build OK;
historical GitHub cards still display old failed-preview labels.

**Frontend published after separate owner confirmation.** Lovable displayed
"Your website was updated." Independent public HTTP checks returned 200 and
verified build ID `df63a47a512b` in `/assets/index-ClIGfU0g.js`, loaded from the
published entry `/assets/index-BnHsrNYZ.js`. The live LeadDetail bundle contains
request-opt-in and resume-ai actions; AppState invokes the real send-sms function.
This supersedes the earlier permission-review publication block. The live admin
page still requires sign-in; no admin session was minted or authentication
bypassed. Backend tests and bundle inspection are not a claim that the live
authenticated dashboard composer has been exercised.

## Controlled real provider test

One owner-authorized confirmation request was reserved through the deployed
enqueue_sms RPC using the existing admin actor and dispatched by the real worker.
Preflight required the exact owner phone after normalization, existing initial
consent, no opt-out, SMS TESTING, the single-recipient allowlist and closed gates.
No double opt-in was fabricated.

- Permanent operation: `release_opt_in_20260913_owner_8256`.
- Local message: `7e59233c-6def-4160-a0c1-8f17f8c4d9d3`.
- Provider message: `c5cf44f4-3734-4742-a27b-c0b75d449f79`.
- sent.DM queued at 17:01:03 CDT, sent at 17:01:04, FAILED at 17:01:05,
  September 13, 2026. The approved utility template rendered two SMS segments.
- One outbox attempt, one local message, provider accepted the submission.
  Outbox ACCEPTED describes provider submission, not successful delivery.
- All four real signed queued/routed/sent/failed webhooks were PROCESSED and
  updated that same message to FAILED. No duplicate message or resend occurred.
- sent.DM Activities shows no carrier reason/code beyond FAILED. Actual handset
  delivery, inbound replies and provider-side cause are still unverified.

The earlier test `611406db-4cfa-4494-b3c2-6e92cc3e16a3` / provider
`7e335b98-0651-4188-a31d-b18a31a11b63` was corrected to FAILED through the existing
status RPC, based on independently observed sent.DM Activities. An idempotent
SMS_RECONCILED audit explicitly identifies UI evidence, not a provider API GET.
No historical message or webhook evidence was deleted and no message was resent.

Final independent SQL check: customers 3, leads 2, messages 2, outbox 1,
pending/retry/leased outbox 0, jobs 0, consent events 0, webhook events 8.
The historical correction has exactly one reconciliation audit entry.
The report retained in `SENT_DM_DELIVERY_SUPPORT_DRAFT.md` was sent to
support@sent.dm from contact@kyokaforge.com after explicit owner confirmation.
Gmail confirmed SENT, message/thread ID `1a09cd368ff4a681`. No delivery cause
or resolution has yet been established. Sending the report does not prove that
support received or acted on it.

## Further audit items and live evidence still required

- Actual first-contact delivery and inbound/compliance replies from the handset.
- Diagnose the provider-side FAILED result before any further paid resend.
- Complete authenticated dashboard composer verification; frontend is published.
- Real signed event replay and unknown-number routing; no forged customer
  inbound traffic should be represented as a real provider test.
- AI English/Spanish, escalation, latest context, takeover race and resume.
- One transactional scheduled rule at a time; cron auth, lease recovery,
  frequency limits, timezone and no historical catchup verified in production.
- The existing client-side automation dry-run previews are advisory legacy
  calculations; the new server guards and durable jobs govern actual sending.
  Verify preview/history consistency before enabling each rule broadly.
- Pre-existing process-email-queue authorization decodes service_role JWT
  claims without verifying that token's signature. This is outside the changed
  SMS pipeline and remains a separate security finding. The new communications
  worker verifies the actual credential and does not use that pattern.
- Lovable's basic scan also flags a public contact write-policy warning and
  authenticated SECURITY DEFINER execution. These generic findings were not
  auto-fixed, suppressed or treated as proof that the new private worker RPCs
  are exposed; their direct privilege checks passed.

Do not mark SMS or Calling READY solely because this source audit passed.
