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

The application appended its own STOP sentence to the **test alert**. That duplicate body sentence was removed. Staff transport still uses the existing configured approved sent.DM template (`SENT_DM_FIRST_CONTACT_TEMPLATE_ID`); its branding/footer and carrier requirements were not bypassed or changed. The provider dashboard was signed out during this pass, so no claim is made that its template footer can be removed.

## Verification

653 tests across 73 files passed before final deployment; TypeScript app check, changed-file ESLint and production build passed. Build retains existing bundle-size/Browserslist warnings.

Coverage includes burst correction/name/email writes, obsolete revision rejection, real versus automated takeover, silent full payment through actual PostgreSQL worker/outbox/dispatch with a stub carrier, ordinary inbound during review dispatch, STOP, authenticated short links, per-type/master toggles, duplicate events/retries, recovery, and the existing Accepted/Scheduled/pricing/payment/ticket regression suite.

Local no-write demo browser checks: Schedule Job at 320/375/390/430px has matching client/scroll widths and a working vertical scroll area. Draft quote totals clear its measured footer (103px normally, 167px when wrapped at 320px). At the bottom of the 320px page, final content ends 16px above the action footer. Sent quote final actions remain visible above navigation.

## Deployment order

Apply **one copy only**, in order (Drizzle and Supabase files are mirrors):

1. 0040 / 20260923100000 conversation origin and bursts
2. 0041 / 20260923101000 staff preferences and links
3. 0042 / 20260923102000 business-event attention
4. 0043 / 20260923103000 communication failure actions

Redeploy the functions bundling the changed engine/kick: `ai-draft`, `ai-control`, `process-communications`, `sent-dm-webhook`, `reconcile-sent-conversations`, `send-contact-email`. Keep secrets and schedules unchanged. Publish frontend after database/function verification.

`docs/sql/20260923_verified_test_conversation_repair.sql` is a separate, guarded repair for only the traced test conversation. It verifies the exact invoice notice and earlier staff resume, refuses to override later genuine staff replies/open requests/new AI activity, corrects only the proven malformed name, records before values, and invokes normal review planning. It does not alter payments, consent, invoices or sent payloads, replay old inbound texts, or launch a historical customer review campaign.
