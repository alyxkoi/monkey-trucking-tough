# Communications release audit — 2026-09-13

## Source checkpoint

Implementation commit: `aef5a62`, pushed to `origin/main`.
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

- Full suite: 39 files, 253 tests passed after final source edits.
- Includes 15 executed PostgreSQL behavior tests, transport/HMAC/AI tests,
  composer tests and realtime scheduling/cleanup tests.
- Application TypeScript check and production Vite build passed.
- Deno 2.9.6 checks passed for send-sms, sent-dm-webhook, ai-draft and
  process-communications with Supabase JS pinned to 2.116.0.
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
- The only real handset test remains FAILED in sent.DM, but incorrectly SENT
  locally. Carrier cause is not exposed in the activity detail.
- SMS TESTING; Calling SETUP_REQUIRED; AI READY describes draft generation,
  not autonomous sending. No fully double-opted-in customer was established.
- Existing email cron only; Vault has email_queue_cron_secret only.
- sent.DM registration is Customer Care. Promotional coverage and voice are
  unverified. Keep both gated.

## Deployment status at this checkpoint

**New production migrations/functions/cron/frontend have NOT been deployed.**

GitHub main sync is visible in Lovable. Its preview reports Build unsuccessful
and Preview is out of date for this and older commits despite the passing local
build. This must be diagnosed/verified before claiming the hosted frontend is
current. Git push is not proof of production publication.

Deployment through the available browser-based Cloud controls will apply new
database permissions and establish a persistent private worker credential.
An action-time security confirmation is required before those operations.
No new secret, cron job, live SMS or readiness promotion was performed during
this implementation pass.

After confirmation, use the exact staged order in SENT_DM_SMS_RUNBOOK.md:
three incremental migrations; four checked Edge Functions; dedicated worker
credential in Edge secrets and Vault; single minute cron; compatible frontend;
provider reconciliation; then only allowlisted real handset tests. Keep global
AI/scheduled/marketing gates off until their individual live tests pass.

## Further audit items and live evidence still required

- Actual first-contact delivery and inbound/compliance replies from the handset.
- Correct the old FAILED record using provider reconciliation, retaining audit.
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

Do not mark SMS or Calling READY solely because this source audit passed.
