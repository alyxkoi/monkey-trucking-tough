# Lifecycle sandbox polish and approval confirmations

## Causes and changes

- The service block advertised the whole supported catalog. It now selects only the service scopes in the current customer question.
- Ton recommendations rounded to half yards. They now use `ceil(raw loose yards + the existing one-yard reserve)`; raw/estimated volume remains internal. Density factors and lack of scale verification are unchanged.
- Address recovery already combined street and ZIP, but early/sandbox conversations had no reusable quote route. A bounded, server-only five-minute route cache now reuses successful results and always recalculates charges from current settings. Draft route evidence expires after 24 hours. Known addresses are not requested again during an unavailable route check.
- `COLLECT_RESCHEDULE_PREFERENCE` bypassed the composer, allowing the model's internal `draft_reply` description to escape. All planned continuing responses now enter composition; accepted preferences receive deterministic date/time acknowledgments and staff actions even before a job exists. The final transport also rejects instruction-like text. Reactive lifecycle stages no longer qualify for a first introduction.
- Protected order increments now acknowledge the exact additional yards. When one accepted material item is unambiguous, a separate current-rate proposal contains accepted yards, additional yards, proposed material pricing and delivery pricing when available. Accepted item quantities remain authoritative; no accepted terms are changed by the AI.
- Contact updates confirm the exact email. The existing atomic lifecycle write must return APPLIED/ALREADY_APPLIED before a production response can be reserved; collision, opt-out, stale revision and write failures cannot claim success.
- Existing scheduled arrival, gate/access instructions and staff-controlled scheduling remain intact.

## Latency evidence and limits

The original sandbox does not persist its requests or per-stage timings. Its reported historical two-minute incident cannot be retrospectively attributed to one provider. The fresh live baseline successfully explained the saved address and $318.97 delivery fee. It was complete at the observation taken within 29 seconds; this is an upper bound, not precise execution timing. Recent persisted production model evaluations were approximately 4.8–14.9 seconds.

The inspected slow path allowed 12 seconds of routing plus two 45-second model attempts. The new model budget is 40 seconds total (first attempt at most 25 seconds, one retry using the remaining budget). Context, routing, model time, attempt count, total time and provider usage are recorded in existing tool results/audits. Pure address/ZIP messages with verified tools bypass the model; side questions still use it. Transient routing failure acknowledges the known address without inventing mileage or asking for it again. Model/business failures remain fail-closed.

## Approval confirmation architecture

Migration `20260916120000_approved_change_confirmations.sql` extends existing activity history and the existing SMS outbox. It adds no separate lifecycle, scheduler, marketing permission or transport.

1. Staff reviews and saves the actual job/order/contact values through existing business controls.
2. The action card previews a server-owned snapshot, clearly separate from the customer's requested values, and requires a resolution note.
3. Explicit **Approve saved values & notify customer** checks the snapshot again under transaction locks, records APPROVED, and reserves one deterministic confirmation keyed by the request ID.
4. Mark handled, rejected, cancelled and superseded actions never create that confirmation. Repeated approval returns the same reservation.
5. The existing HUMAN outbox route preserves staff takeover. It does not resume AI. Confirmations honor confirmed SMS consent, opt-out, current provider readiness and business hours. Before dispatch, the saved values and approved resolution must still match. Otherwise the message is cancelled, with existing message/outbox audit visibility.

Supported approval snapshots: current job schedule, saved material order quantity and total, matching saved quote/job address, saved contact email and sent/accepted custom-work quote total. Missing actual records or unsaved values remain blocked with a specific error; approval is not a backdoor for changing accepted finances, confirming payments or booking work. Staff still owns those protected business actions. Proposed pricing is visible in the staff request context.

## Verification

Regression coverage includes whole-yard conversions, focused services, internal-plan rejection, reused address/delivery explanations, transient route failure, cache fee recalculation, accepted schedule/increment/email behavior, scheduled arrival/notes, real PGlite approval transactions, duplicate clicks, rejected/cancelled/handled requests, stale previews, changed-value preflight cancellation and React approval controls.

Local production build and TypeScript check pass. Full-repository ESLint has pre-existing errors outside this change; changed-file lint is checked separately. Deployment/live verification results will be appended after rollout. No real customer messages, payments, orders or consent were changed during sandbox tests.
