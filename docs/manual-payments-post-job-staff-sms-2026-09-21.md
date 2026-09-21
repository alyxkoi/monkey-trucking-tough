# Manual payments, post-job reviews and staff SMS

## Findings

- Manual payment UI was full-balance-only; its RPC ignored a requested partial amount and retained the invoice surcharge.
- Manual takeover alone projected `HUMAN_REQUIRED`, and LeadDetail displayed the last successful quote-intake rationale. A completed/paid job must not turn a retained AI pause into unfinished intake. Genuine open actions, later unanswered messages and delivery failures remain visible.
- Review eligibility and dispatch both used internal business hours. Friday 7 PM became Monday 9 AM. The old 30-minute candidate window also risked losing events; backdated receipt dates were not suitable event timestamps.

## Changes

- Transactional, staff-authorized manual payment RPC: invoice lock, idempotent request, editable surcharge, partial amount, optimistic total check, audit. Existing Stripe payments and active checkout sessions are protected. Nonvoid payment rows remain the balance source of truth.
- Durable `review_eligible_at` is stamped on the second of completion/full confirmed payment; existing planner/10-second worker handles one review per job. Only review-specific internal quiet hours are removed. Consent, STOP, takeover, dispute, runtime and provider gates remain. No historical invoice backfill campaign.
- Paid/completed projection suppresses obsolete intake alerts while retaining takeover. Exact fulfilled quote-ready tasks receive append-only resolution entries; unrelated tasks remain.
- Separate internal staff outbox/settings, same provider dispatcher and signed receipt ingestion. Deterministic new-lead, accepted-quote and staff-action alerts. Event keys, leases, immutable payload, bounded retries, status/error logs. Internal phone replies never create customer records. STOP/START are respected. Staff SMS does not alter dashboard alerts.
- Partial invoice emails/reminders/receipts and financial outstanding totals use the remaining balance.

## Deployment

Apply the six mirrored migrations **once**, in order:

1. `0034_manual_payment_fees` / `20260921100000_manual_payment_fees`
2. `0035_post_job_review_events` / `20260921101000_post_job_review_events`
3. `0036_staff_sms_notifications` / `20260921102000_staff_sms_notifications`
4. `0037_resolve_obsolete_quote_actions` / `20260921103000_resolve_obsolete_quote_actions`
5. `0038_historical_staff_sms_isolation` / `20260921104000_historical_staff_sms_isolation`
6. `0039_staff_sms_receipt_reconciliation` / `20260921105000_staff_sms_receipt_reconciliation`

The production read-only check found one historical customer with the staff number. Migration 0038 preserves that record and all history, while blocking customer SMS reservation/dispatch and new leads for configured internal numbers. Inbound replies already use the internal route.

The Drizzle and Supabase versions are identical mirrors, not separate migrations. Keep the existing Cloud journal/schema workflow; do not execute both copies. Deploy `send-sms`, `process-communications`, `customer-document-email` and any deployed function bundling the changed shared dispatcher/worker/response modules. Publish frontend after backend verification.

## Verification before push

620 tests / 70 files pass. TypeScript app check and Vite production build pass. Changed-file ESLint has no errors (existing AppState fast-refresh warning). PostgreSQL integration covers both completion/payment orders, partial fees, Stripe protection, duplicate events, Friday evening, real worker/transport with stub carrier, delivery receipts, staff toggle gates, historical staff-contact isolation and resolved-action cancellation. Component tests cover manual fee/partial amount, stable retry ID and staff settings/test interaction.

## Live verification follow-up

The authorized internal test was accepted by sent.DM in one attempt, but no delivery webhook updated its queued receipt. Migration 0039 and the shared receipt reconciler add internal records to the existing bounded status-only reconciliation job, preserving customer behavior and avoiding a second send. No new polling interval or customer timeline is created. Redeploy `send-sms` and `reconcile-sent-conversations` with the updated shared reconciler.

Production was already in SMS TESTING mode. The explicitly authorized Salvador destination was appended to its existing test-number list, with a `STAFF_SMS_TEST_NUMBER_APPROVED` audit entry, only after migration 0038 was verified active. Global SMS mode and customer permissions were not broadened; historical staff-number customer traffic is blocked.

Production test must use the explicit internal test button and verify delivery in `staff_sms_outbox`, with no synthetic lead, invoice, or payment. Financial end-to-end fixtures are isolated locally; never mark a real invoice paid for testing.
