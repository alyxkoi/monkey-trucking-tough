# sent.DM SMS production runbook

## Verified provider baseline, 2026-09-13

- Business number: `+19453750877`; controlled handset: `+12143568256`.
- Supabase project: `dugmcjpistrxxryaubkd`.
- First-contact template: Monkey Trucking Update, APPROVED,
  `48d013e5-debe-4efa-864b-c90798242ab4`.
- Template body: `Monkey Trucking: {{message}} Reply STOP to opt out.`
- Provider STOP, START and HELP auto-replies are approved.
- Existing webhook is active for all ten message events:
  https://dugmcjpistrxxryaubkd.supabase.co/functions/v1/sent-dm-webhook
- Registration shown in sent.DM is Customer Care. Promotional coverage and
  voice capability for this number are NOT verified.
- Existing Edge secrets: SENT_DM_API_KEY, SENT_DM_WEBHOOK_SECRET,
  SENT_DM_FIRST_CONTACT_TEMPLATE_ID. SENT_DM_PROFILE_ID is intentionally absent
  because no separate sender profile was established. Never print their values.
- SMS is TESTING, Calling SETUP_REQUIRED. AI READY describes drafting only.

The original foundation migration `20260913090000_sent_dm_sms_transport.sql`
was applied previously. Do not rerun historical broad UI/schema migrations.

## New deployment order

Apply these incremental migrations in order, exactly once:

1. `20260913170000_durable_sms_pipeline.sql`
2. `20260913171000_sms_consent_and_inbox.sql`
3. `20260913172000_communication_worker.sql`
4. `20260913180000_worker_vault_auth.sql`

Then deploy the checked source for `send-sms`, `sent-dm-webhook`, `ai-draft`
and `process-communications`, including their shared modules. Each implements
its own authentication; preserve the settings in `config.toml`.

The worker credential lives only in Vault as `communications_worker_secret`.
After deploying the worker and the service-only `verify_communications_worker`
procedure, run `install_communications_cron.sql`. It generates a 256-bit random
credential inside the database if absent and installs one minute worker wakeup.
The Edge Function passes only a SHA-256 digest to the private verifier; it never
retrieves the Vault value. No secret needs copying into chat or a second store.
An existing `COMMUNICATIONS_WORKER_SECRET` Edge secret is optional, not required.
Do not print secrets or rotate an existing credential. The installer preserves
the email cron and does not enable AI or scheduled customer sending.

Deploy the frontend AFTER the schema and functions. The new runtime settings
are required data. Verify the actual hosted build, not just GitHub sync.

## Safe operating state

The new singleton `communication_runtime` defaults to:

- test_numbers: controlled handset only
- ai_sending_enabled: false
- scheduled_sending_enabled: false
- marketing_approved: false
- activated_at: null
- business timezone America/Chicago, weekdays 09:00 to 17:00

In TESTING the normal dashboard composer works only for the server-side
allowlisted handset. Initial recorded consent is required. Use Request SMS
confirmation for the contextual double opt-in; an arbitrary YES does not grant
consent. START and STOP are ordered by provider event time. HELP changes no
consent. Provider-owned compliance replies never trigger AI duplicates.

Manual replies pause AI before dispatch and cancel undispatched automation.
Resume AI is explicit, audited and applies only to future messages.
A request already in flight with the carrier cannot be recalled.

All sends reserve one permanent operation identity and an immutable payload
in the same outbox. Retry uncertain submissions with that identity. Three
attempts or the conservative 23-hour retry window end in REVIEW; do not
generate a fresh ID to bypass ambiguity. Reconciliation reads provider status,
it does not resend.

## First failed handset test and reconciliation

The earlier test was sent using sent.DM Playground, NOT the dashboard:

- provider ID: `7e335b98-0651-4188-a31d-b18a31a11b63`
- local message: `611406db-4cfa-4494-b3c2-6e92cc3e16a3`
- lead: `d5500f93-448a-4ba2-acda-5c6e8acf08f9`
- sent.DM visibly ended FAILED; the activity detail exposed no carrier cause.
- The old deployed webhook left the local message SENT because it compared
  the outbound recipient against the business number.

After deploying, invoke authenticated send-sms with action `reconcile`,
the leadId and messageId above. This reads sent.DM's status endpoint, updates
the same row and records SMS_RECONCILED. Preserve the failed evidence.
Do not claim that repairing status reporting fixes the carrier failure.

## Release test matrix

Automated tests run locally are not evidence of handset delivery.
Before customer-wide READY, retain local/provider IDs and verify:

1. Dashboard first-contact template actually arrives from the approved number.
2. Real inbound reply creates one message on the correct conversation.
3. Contextual double opt-in, then dashboard free-form reply and delivery update.
4. Provider FAILED/FILTERED/BLOCKED remain distinguishable; later SENT cannot
   erase terminal outcomes. Events before ID linking reconcile.
5. Signed webhook replay creates no duplicate message/activity; invalid
   signature creates no database write.
6. Unknown inbound is captured safely.
7. STOP blocks manual and automated work, including already claimed but not
   dispatched work. START restores only appropriate consent. HELP is harmless.
8. Provider compliance reply arrives once, without AI duplicate.
9. Enable AI for the allowlisted test only: English/Spanish, latest context,
   deterministic material pricing, uncertainty escalation, missing-data failure,
   staff takeover during generation, and explicit future-only resume.
10. Enable one transactional scheduled rule at a time using a new activation
    timestamp; verify current-record guards, business time and frequency caps.
    Historical records must not create catchup blasts.
11. Verify browser conversation updates, actual status/error display, retained
    composer draft after failure, no duplicate send on double click/retry,
    and preservation of existing dashboard sync/realtime behavior.
12. Verify worker authentication, one cron job, bounded leases/retries and logs.

Promotional/reactivation/review sends require actual approved campaign coverage
AND explicit `sms_marketing_consent_at`, in addition to normal double opt-in.
Calling remains SETUP_REQUIRED until the exact number's supported voice API and
missed-call events are documented and exercised.

Only after applicable live evidence passes should SMS become READY. Enable AI,
scheduled sending and individual rules separately; do not conflate their gates.

## Recovery

For a sending incident, immediately set AI and scheduled runtime flags false,
and set sms_status to OFF to stop new dispatches. Inspect accepted/in-flight
provider IDs before any resend. Cancel only undispatched outbox/job work with
an audit; retain message/event evidence. Do not roll back by deleting schema,
messages or consent history. Redeploy the previous compatible code only after
checking the new database contracts. Existing email scheduling stays untouched.

## Local verification before deployment

- 264 tests across 41 files passed, including 16 executed PostgreSQL behavior
  cases and transport, AI, composer and realtime tests.
- Production Vite build and application TypeScript check passed.
- Deno native checks passed for all four Edge Function entrypoints.
- Targeted ESLint: zero errors, existing AppState fast-refresh warning.
- PGlite tests exercise actual PostgreSQL state transitions in memory but do
  not simulate independent database connections or real carrier traffic.

Deployment and live results must be appended to the execution audit; this
section is not a claim that the new release is already deployed.
