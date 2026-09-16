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

Local production build and TypeScript check pass. Changed-file ESLint passes; full-repository ESLint has eight pre-existing errors and nine warnings outside this change. All 473 tests across 58 files pass after the final follow-up correction. No real customer messages, payments, orders or consent were changed during sandbox tests.

## Rollout and live verification

- Initial implementation `1d1ff1a` was pushed to main. The managed deployment added `drizzle/migrations/0019_approved_change_confirmations.sql`; its normalized SQL matches the repository migration exactly. The deployed RPC permissions deny anonymous access, expose the two explicitly staff-guarded wrappers to authenticated callers, and keep helper functions service-only. Live database checks confirmed the dispatch approval guard and preserved human-takeover guard.
- The three affected functions were deployed. Live sandbox output reports lifecycle v11. Lead, accepted scheduling/email, and scheduled arrival/access/rescheduling scenarios were exercised without sending real SMS.
- Live pure-address processing took 348 ms: context 6 ms, route 338 ms, zero model attempts. The delivery explanation reused that address and returned the actual mileage/load-based charge, with installation excluded, in 7,986 ms (one model attempt). These are measured backend times, not SMS delivery guarantees. The original historical two-minute incident remains untraceable; the excessive timeout path is bounded and instrumented now.
- Live QA caught one remaining issue: the model classified a simple additional-yard request as a financial escalation, overriding the prepared acknowledgment. Follow-up `f536353` narrows that case to a high-confidence, server-prepared change-intake acknowledgment. It does not authorize an order change and does not bypass genuine disputes, uncertainty, negotiation or forced takeover. Regression tests pass, and the fix is pushed to main.
- **Initially blocked, now resolved:** Lovable exhausted its credits before the second deployment. After the user replenished credits, the follow-up was deployed and verified as described below. No credits were purchased by the agent.
- Frontend publication returned **Your website was updated**. After a brief deployment propagation screen, the authenticated production dashboard loaded successfully with no captured console errors. Its AI control center still reports v11, confirming that frontend publication did not deploy the pending v11.1 backend patch.
- Approval reservation, repeated clicks, rejection/cancellation/handled outcomes and changed-value dispatch protection were tested against executable PostgreSQL-compatible migrations locally. A real carrier-delivered staff-approval confirmation was not sent in this pass; do not count the sandbox or database assertions as a delivered SMS test.

## Final backend deployment verification

After credits were replenished, Lovable reported successful redeployment of `ai-control`, `ai-draft`, and `process-communications` from main `47e7886`, including the tested `f536353` fix. No migrations were rerun, source/settings were not changed, and no real customer messages were sent. The production AI control center now independently reports **mt-ai-lifecycle-v11.1**. Remote main remained unchanged after deployment.

The live ACCEPTED sandbox test, "also i actually might need 5 more yards than what i accepted", now replies: "got it, you may need 5 more yards. I'll have Salvador review the updated amount and price. your current order stays the same until that's confirmed."

The deterministic results retain the accepted order at 20 yards and its fixture total at $500. A separate staff-approval proposal contains 25 yards and a $1,315 material estimate using current catalog pricing. Delivery stays unresolved for the intentionally incomplete fixture address; it is not invented. The response completed in 8,464 ms, with one model attempt. The correction acknowledges the request without authorizing a financial change or stopping the entire conversation.

In the same sandbox conversation, the subsequent email-update request received "got it, I updated your email to treytest@gmail.com." The displayed email updated and the accepted quantity stayed at 20 yards. No browser console errors were captured. This verifies conversation continuity without writing a real customer's email.

The lifecycle sandbox, polish and database suites were rerun after resuming: **39 tests passed across three files**. The earlier full 473-test run applies to the same unchanged source. No remaining deployment blocker for this polish pass.
