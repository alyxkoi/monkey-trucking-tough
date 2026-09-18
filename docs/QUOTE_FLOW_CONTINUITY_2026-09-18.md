# Lead source, latency and quote continuity

## Production findings

Read-only audit of the latest clean-slate test showed a selected-material confirmation that never resolved the catalog identity. The previous selection detector required a numeric yard proposal; a direct yes to one named material was missed. The model subsequently asked for quote approval while material pricing was NOT_READY. The customer's `yes please` then encountered two model timeouts (25.007 s and 14.995 s), before lifecycle persistence. It was not a missing magic phrase or a slow Google calculation.

Recorded samples: provider occurrence to application ingestion 2.824–10.224 s; context load 0.261–0.438 s; Google route 0.092–0.168 s; lifecycle writes 0.074–0.219 s; generation 11.769–40.002 s including retries. Worker overhead was approximately under a second. The examined samples did not reproduce a two-minute response. Historical event records cannot distinguish direct webhook acquisition from reconciliation, so this audit does not attribute the entire ingress gap to provider webhook latency.

The normal website attribution bug came from browser-wide campaign storage lasting 30 days. Manual quote prefill required an audit tied exactly to the latest inbound message, so a failed acknowledgement made the prior safe calculation unusable. Route evidence was also discarded while material selection was unresolved.

## Targeted changes

- Versioned, per-tab campaign visits with 30-minute expiry; unrelated arrivals clear attribution, same-site navigation/reload preserves legitimate campaigns. Remove legacy persistent campaign state; validate freshness server-side against the existing canonical tracking-link lookup.
- Resolve direct confirmations of a single catalog material without requiring repeated quantity. Ambiguous comparisons remain unresolved.
- Use deterministic confirmation handling for material, quote and recipient questions in Lead only. Preserve normal model use for actual questions and all protected lifecycle/transport checks.
- Render the final delivered recap from verified subtotal, delivery, tax and total before asking for quote preparation. Requested dates are not represented as booked appointments.
- Preserve quote approval through subsequent turns; discard contradictory model missing-fact labels and repeated approval questions. Use concise recalculated-total acknowledgements for quantity corrections.
- Keep verified route evidence independent of material selection.
- Live smoke testing additionally caught a same-sentence scheduling suffix being passed to Google as part of the address. Strip explicit relative-date/time tails after the street while preserving the original message for date extraction and keeping street names intact.
- Address-reply clarification asks only for the unresolved material choice when quantity is already known, rather than requesting both material and yards again.
- Keep the verified final recap outside the model's restricted short-question field. A deployed sandbox named-material reply exposed that boundary; regression coverage now includes model-planned and deterministic confirmation branches.
- Reuse the latest recent audited calculation for manual quote preparation only across acknowledgement-only messages, never across unprocessed corrections/addresses/material changes. Existing transactional quote tools remain authoritative and idempotent.
- Add amber Quote Ready presentation using existing staff actions and attention architecture. Later successful replies supersede historical failed sends; unresolved send errors still remain failures.
- Add collapsed staff diagnostics spanning ingress, queue, context, tools/model, lifecycle, reservation and provider submission. Record whether the first committed inbound came from WEBHOOK or RECONCILIATION. Unknown historical timings stay unknown. Timing persistence cannot trigger a resend or fail a committed inbound.

## Existing behavior verified, not duplicated

`quotes.confirmed_email` remains the send recipient source of truth. Profile email is only a suggestion until confirmation. Manual alternate recipient confirmation does not update the customer profile. Staff can confirm then send. Existing View/Review Quote navigation opens the same draft. Newest-activity default and most-urgent sorting already use the established attention model.

Regression coverage exercises production conversation sandbox logic, actual PostgreSQL quote/lifecycle transactions in PGlite, manual fallback and duplicate protection, correction safety, recipient edit/confirm/send UI, amber readiness, attribution expiry and provenance, sorting, Accepted/Scheduled and human takeover. Provider/model calls in repeatable local tests are controlled fixtures, not customer sends.

## Deployment scope

Apply `drizzle/migrations/0030_quote_intake_continuity.sql` (mirrored in `supabase/migrations/20260918160000_quote_intake_continuity.sql`) once through the managed deployment workflow. It adds nullable diagnostic metadata to existing SMS events and updates the existing manual quote prefill function; no records are deleted, no parallel order/contact system is introduced.

Deploy shared-code consumers: ai-control, ai-draft, process-communications, sent-dm-webhook, reconcile-sent-conversations, send-contact-email, and any other deployed consumer of changed shared modules. Publish frontend. Customer approval/consent and staff quote review/send are intentionally not bypassed. No production messages or quote emails were sent during the local regression pass.
