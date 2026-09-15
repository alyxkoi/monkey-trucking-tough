# AI conversation hardening · September 15, 2026

## Root causes and changes

- The old action/send layer replaced normal conversational answers with a fixed price template. A small `response_plan` now separates objective, ordered answers, comparison/recommendation catalog identities, required tools, next question, and subtask/global escalation. `ANSWER_CUSTOMER` composes business statements from server-owned results, never model arithmetic.
- Alias and correction resolution happened before pricing but missed commercial/3x4 shorthand and unitless corrections. Current facts now have one owner: canonical material UUID/catalog key, latest quantity and unit, and latest resolved address. Material/load/tax totals are recomputed every turn; a verified route may be reused only for the same address/origin. Existing formulas and SQL quote protections are unchanged.
- Custom-work pricing used the same stop as human takeover. It is now a visible pending subtask; standard material/delivery intake continues. Genuine global handoffs (human requests, serious complaints/disputes, financial authorization and safety) latch the existing takeover flag using a revision-checked update; staff use the existing Resume AI action. Missing facts, transient tool refreshes and custom-work subtasks never latch it. Compliance keywords retain their separate provider/consent handling.
- Address clarification used to preempt unrelated questions. Address-only replies retain deterministic clarification/loop protection, while side questions can be answered before returning to address intake.
- Product guidance and recommendations can both be selected. Live testing exposed duplicated wording, now replaced by distinct guidance and recommendation outputs. Product-use comparisons no longer imply a price comparison.
- Zero-tax totals no longer say “with tax,” and material-only replies omit tax entirely when it is disabled. Introductions remain first-reply only. The composer reserves room for that introduction within the existing SMS length limit.

## Identity and sandbox

Source inspection found no first-name auto-merge in the production inbound SMS resolver, website intake preparation, or customer creation path: normalized phone/email and customer IDs select records. The sandbox never reads real leads/customers and performs no database mutations. Its old UI kept the current message list until Reset; this is a plausible source of apparent same-name carryover, not proof that the reported incident involved a production identity collision.

Each sandbox session now has an explicit synthetic UUID. Reset clears messages, form and results and creates another ID. Starting form data is locked once a conversation begins. In-flight actions are guarded; exact errors appear beside the test controls with the unsent input preserved. Disabled tests explain why, and subtask review is distinguished from an entire-conversation block. UI/UX guidance informed these controls without redesigning the dashboard.

## Validation and deployment

Final full suite: **382 tests / 51 files passed**, 14:02 CDT. Typecheck, production build, changed-file lint and diff checks passed. Existing PostgreSQL tests continue to cover quote snapshots, revisions, consent, takeover, authorization, idempotency and transport. There are 41 additional tests: 35 conversation-hardening cases, three sandbox UI cases, and three production-engine regressions covering corrected quote application, persistent global handoff and its concurrent-update failure path.

Frontend deployment: `dd1bebc`; hosting supplied a type-only record-index cast, integrated as `3b2dfd3`. Final backend `ai-draft`, `process-communications`, `ai-control`: **`bc078ec`**, including the correction, recommendation and persistent-handoff fixes. Hosting confirmed all three final function bundles deployed without further source edits. Unauthenticated endpoint checks return 401. No migrations, data cleanup, secrets, model selection, cron cadence, rates or compliance settings changed.

## Live verification

- Production UI reports direct OpenAI `gpt-5.6-terra`, prompt v9. Published sandbox displays its isolated session ID, disabled reason, input lock and subtask status.
- Initial multi-intent request retained Mike and 18 yards, answered the driveway service question, asked commercial clean versus 3x4 and flagged custom work without blocking standard intake.
- Product uses/recommendation now presents each product once and recommends commercial clean for driveway/base use without unsolicited prices. Live testing caught and fixed duplicate block rendering.
- Compound correction “commercial instead, actually make it 30 yards” now stores the catalog UUID/key and 30 yards independently. A second correction followed by a price/address question correctly supersedes 30 with 28; live testing caught the old whole-message correction anchor and regression coverage now tests clauses.
- The final 28-yard request to `424 Kent Dr 75149` returned **$510.00 material + $521.75 delivery = $1,031.75**, using the verified approximately **26.1-mile / two-load** route. It did not say “with tax” for zero tax and did not repeat the introduction. The custom-work subtask remained visible and standard conversation stayed active.
- “Why is delivery that much?” returned only the verified delivery explanation, not the full quote. A combined installation-scope and state-summary question answered both, correctly listing Mike, 28 yards, Commercial Crushed Concrete Clean, the latest Kent Drive address and the pending custom-work pricing. It did not resurrect the earlier 18/30-yard quantities.
- A requested price comparison used the same 28 yards: 3x4 material $980.00 versus commercial clean $510.00, difference $470.00. The current material remained commercial clean.
- Spanish quantity correction to 25 yards reused the address and returned $450.00 material + $521.75 delivery = $971.75 in Spanish. No repeated introduction or zero-tax wording.
- An explicit Spanish request to speak to Salvador produced no reply and displayed the exact whole-conversation block. Persistent production pause and concurrency safety are automated tests, not mutations of a real customer during this audit.
- Reset created a different session ID and cleared the old form/history. Another Mike requesting 10 yards of flexbase had no inherited Kent address, commercial material, 25/28-yard quantity or custom-work request. Browser console error list was empty, and the published sandbox was visually inspected.
- The final deployed material-only reply quoted 10 yards of flexbase at $380.00 and said only “delivery is calculated separately,” with no tax mention when disabled.
- At 14:07 CDT, read-only production SQL verified **zero new lead messages, zero new SMS outbox entries and zero updated quotes** during the sandbox window beginning 13:33 CDT. Provider reconciliation last succeeded at 19:07:01 UTC with no error.

These tests do not constitute a new carrier SMS round trip, real payment, or real quote mutation. The sandbox deliberately cannot perform those actions.
