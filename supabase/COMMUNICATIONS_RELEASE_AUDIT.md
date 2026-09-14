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

## September 14: live inbound and consent cleanup

- Owner confirmed handset receipt of Playground SMS
  `942bf740-c26d-4a7e-bf61-31c79f895eea`; this verifies provider delivery,
  not the authenticated dashboard composer.
- Real inbound `Test`, provider `5ebcc567-f340-4140-94db-8ae5060fd12f`,
  was received at 15:19:05 UTC and processed at 15:19:07 UTC. Local message
  `1dd16b17-ec66-49ab-ad30-26dac5a0e25c` belongs to the existing owner lead
  `d5500f93-448a-4ba2-acda-5c6e8acf08f9`. Read-only SQL verified one message,
  one processed webhook, one audit entry, no consent granted, takeover true,
  and no active AI jobs or queued automation. This is not a replay test.
- `send-sms` consent copy cleanup pushed as `6c602b8` and deployed through
  Lovable on September 14. Deployment reports success and unauthenticated
  POST returns 401. The approved template provides branding and STOP once;
  the message parameter retains YES, HELP, frequency and rates information.
- Runtime remains SMS TESTING, Calling SETUP_REQUIRED, AI/scheduled/marketing
  off. The communications cron reported success at 15:37 UTC, queues empty.
- Live preflight found yesterday's opt-in outbox ACCEPTED while its linked
  delivery status is FAILED. The old seven-day pending check incorrectly
  blocked a new request. Migration `20260914154000_failed_consent_retry.sql`
  excludes confirmed FAILED/FILTERED/BLOCKED deliveries from that check,
  retaining pending/ambiguous protection and historical evidence. Three
  regression cases failed before the fix; all 47 focused tests pass after it.
  Migration applied through Lovable, recorded as
  `drizzle/migrations/0007_failed_consent_retry.sql`. Deployment verified the
  new predicate, preserved service-only execution permissions, unchanged
  failed-message evidence, and zero blocking requests before the next test.
- Owner signed into the production dashboard. Its Request SMS confirmation
  action sent local message `360df139-abd0-4cc6-b267-345d0d0714e9`, provider
  `3726c9db-c334-4906-a086-f5435efac5e2`, at 15:43 UTC. Delivery was recorded
  at 15:43:54 UTC, one attempt and four processed status events. The dashboard
  updated to delivered automatically.
- Owner replied YES at 15:44:15 UTC. Local message
  `c8309d1c-881f-473e-b6ac-55be32a6c640`, provider
  `5a947451-bea1-49e1-8cc0-ff85d8aa1f6f`, classified COMPLIANCE. SQL verified
  sms_double_opt_in_at equals that real inbound time and the request pointer
  was cleared. Dashboard removed the confirmation request control.
- The authenticated dashboard composer sent: "Got it, thanks. What address
  should we deliver the gravel to?" Local `cd6f3503-3a71-4961-a052-716b9589f0d3`,
  provider `88f1ed0c-d396-42e1-8cec-734771b75dc4`. SQL verifies FREEFORM,
  DELIVERED, one attempt, and the exact text in the immutable outbound payload.
  Dashboard displayed delivered and cleared the composer after success.
  Each consent, YES and free-form message has exactly one provider-linked row.
- Owner confirmed the free-form reply looked clean on the handset, without
  the template prefix/footer. Real STOP arrived at 15:49:54 UTC, local
  `98928a2a-d63d-4d62-b300-2bd8da0574f4`, provider
  `b1e64cc5-3caa-4229-aeb4-f48b4b0f624a`. SQL verified PROCESSED, one OPT_OUT
  event, matching sms_opted_out_at, source SENT_DM_STOP, takeover true, and
  zero active jobs/outbox. A subsequent authenticated dashboard send was
  rejected with "Customer has opted out of SMS"; the composer retained the
  draft, and SQL verified zero message rows for the blocked test body. The
  test draft was then cleared. Marketing consent remains null.
- Real START arrived at 15:54:04 UTC, local
  `343665a9-620b-40f5-9710-888ba053904d`, provider
  `c177d959-1da7-40fc-ba9f-4b3db80c3bec`. Its processed OPT_IN event cleared
  sms_opted_out_at and restored sms_double_opt_in_at at that event time.
  Marketing consent remains null.
- Real HELP arrived at 15:55:05 UTC, local
  `a84c180a-a6c1-4917-a4b6-f2afa0477739`, provider
  `de089374-e4b1-4448-975c-718a37ed7fe6`. Its processed HELP event left
  restored consent unchanged. Owner acknowledged the handset test; exact
  provider auto-reply counts have not been independently verified.
- After HELP verification, the dashboard Resume AI action cleared takeover
  for the owner lead and recorded future-only resume activity. A guarded
  runtime update enabled AI only with SMS TESTING, the single owner handset
  allowlist, restored consent, no active jobs, and scheduled/marketing gates
  false. SQL returned the updated row with ai_sending_enabled true and the
  exact test allowlist. No historical message was backfilled as an AI job.
- Signed replay, unknown-number production evidence, controlled AI and
  scheduled-rule tests remain launch gates. SMS remains TESTING; calling and
  marketing remain unverified and disabled.

## September 14: first controlled autonomous conversation

- Real English inquiry arrived at 16:00:15 UTC, local
  `6ba5598b-1898-44f8-bc46-e5d5d8377104`, provider
  `7419689c-5978-47fc-a4e0-db95d28beed7`. One AI_REPLY job
  `ad731be5-a199-4e4c-9828-7ae8de046af6` was created and attempted once.
- The configured `gpt-5.6-terra` model completed successfully at 16:01:08 UTC,
  drafted a question about the delivery address, but classified unspecified
  gravel type/load size as uncertain_facts. The unchanged autonomous guard
  rejected this with `AI decision needs human review`; no outgoing message
  was created. This verifies safe blocking, not autonomous delivery.
- Prompt v3 distinguishes ordinary missing intake details from conflicting
  facts or uncertainty in proposed claims. It explicitly prohibits assuming
  truckload yardage or a catalog material. The uncertainty guard is unchanged.
  A prompt-contract regression failed before the edit; 34 focused AI/SMS tests
  pass afterward, including continued rejection of conflicting facts. Mocked
  model tests are not live model behavior proof. Targeted lint also passed.
- `dd316bc` was pushed to main and Lovable deployed only ai-draft and
  process-communications with their shared modules. It reported HTTP 401 for
  unauthenticated requests to both, unchanged runtime gates and no frontend
  publish. Its description of ACCEPTED outbox rows as awaiting delivery is
  not authoritative: these submission states persist after terminal delivery;
  the previously verified linked message delivery statuses remain the evidence.
- An authenticated dashboard draft-only recheck completed at 16:08:57 UTC,
  audit `e5b8608e-ddc6-441d-8ffa-d993373948f3`. Independent SQL verified
  prompt mt-ai-draft-v3, model gpt-5.6-terra, SUCCESS, HIGH confidence and empty
  uncertain_facts. The displayed draft asks which gravel type the customer
  wants; missing_facts includes specific type, yard quantity and exact address.
  This confirms live revised draft behavior, not automatic SMS delivery.
  A fresh handset inquiry was requested for that next end-to-end test.
- The fresh inquiry arrived at 16:10:51 UTC, local
  `b72135ff-a7c1-46af-868f-ab0ea0540812`, provider
  `0f809328-b090-428c-a2ae-9e7e9fd6a514`. AI job
  `bc188d4b-dcf9-4d6d-a298-38e23838fb66` completed DONE with one attempt and
  no error. Prompt-v3 audit `e59d0f3e-9a69-4601-9ecf-8c14d651a2c5` is SUCCESS
  with empty uncertain_facts.
- Automatic reply: "hi Alexander, what type of gravel and how many yards do
  you need?" Local `d1f76336-0210-4f9d-af0d-4eece913bb43`, provider
  `5c99f251-3ee6-4d4b-8137-f63a874be282`. SQL verified DELIVERED, one send
  attempt, one provider-linked message row, four processed status events and
  exact free-form payload text without template branding/footer. The terminal
  row update was 16:11:50 UTC. The live dashboard changed queued to delivered
  automatically. This is a real autonomous English SMS delivery test.
- Independent empty, unauthenticated POST checks after deployment returned
  HTTP 401 for both ai-draft and process-communications. Spanish/context and
  subsequent staff-takeover handset checks are next; broad sending stays off.

## September 14: Spanish, latest context and manual takeover

- Owner sent two real Spanish texts specifying 50 yards of flexbase, then
  delivery to Kaufman. Local inbound IDs `b16539fe-3f22-4720-a604-32881998e5ae`
  and `00eb0918-96fa-4136-85f6-c8ff8d06d6a4`; provider IDs
  `42ab7493-f0bd-4c97-bb99-1342b1cf9151` and
  `d9979d0d-bce2-43cf-8d61-2171aaf3a56d`.
- The second inbound cancelled older queued job
  `1b474ca3-238f-4c83-be49-eb530aea2a64` before any attempt. Latest-context
  job `fb087184-956b-4f1a-93a3-d93b447850d8` completed once. Audit
  `e3e0a252-4f6d-48fe-acdb-f0a94cf264c1` shows SPANISH, 50 yards, flexbase,
  Kaufman, HIGH confidence and empty uncertain_facts. The reply asks only for
  the exact address, without repeating supplied quantity or material.
- Spanish AI message `7cc41f04-d1a9-409d-b360-7d3c93f70a49`, provider
  `8e28f005-07f0-4ee9-9f63-585ed5541570`, was DELIVERED with one send attempt:
  "claro. ¿Me comparte la dirección exacta de entrega?"
- After the owner supplied an address, the AI asked about 1-inch versus
  3-inch flexbase. Message `716dafa5-f307-4712-ae4a-7f767cb01027`, provider
  `3f9656ab-b433-4442-9721-3706d2b853e0`, was reserved at 16:16:06 UTC,
  before manual takeover, and delivered once. This is not a cancelled
  in-flight-send test; previously submitted carrier messages cannot be recalled.
- The authenticated dashboard then sent a labeled manual takeover test at
  16:16:09 UTC: local `38efb914-07a6-48cc-8ff3-d4354b78c742`, provider
  `4d47fb62-9c57-4b10-b84c-e97d99ad7115`, DELIVERED, one attempt. The
  composer cleared, human_takeover became true and the dashboard disabled
  Generate AI Draft, displayed AI PAUSED, and offered explicit future resume.
- Real post-takeover text "1 pulgada" arrived at 16:16:49 UTC, local
  `0fa742dc-4211-48cf-8017-c76fb6f4a859`, provider
  `258bdaf9-b6c3-4147-a3f7-6478b469c0ae`. It appeared in the conversation
  while takeover remained true. Runtime still permits only the owner test
  handset; scheduled sending and marketing remain false.
- At 16:17:44 UTC, SQL verified takeover true, zero jobs for the paused
  inbound, zero AI messages after the manual response and zero active jobs.
  After explicit dashboard resume, a 16:19:35 UTC recheck showed takeover
  false with all three counts still zero. Resume did not backfill the paused
  text. A fresh material-price inquiry was requested to test pricing next.

## September 14: material-pricing resume regression

- Real price inquiry `a7b4625e-f16c-4e78-adbd-20552fea3a19`, provider
  `8cbb3787-d1f1-4af9-bb0e-0c3a94afd817`, arrived at 16:20:31 UTC.
  Job `f69a52a1-2102-42c8-adeb-b5868e05ced6` attempted once and failed safely.
  No price SMS was created. Audit `c17f14b7-bffb-4be2-923f-094ca37bf847`
  incorrectly inferred current takeover from the earlier manual-test text,
  despite the persisted explicit resume, and also held a material-only request
  because delivery remained unpriced. The stored material calculation was
  50 yards, total 1820, with delivery, tax and grand total unconfirmed.
- Prompt v4 now receives an explicit current_human_takeover boolean and states
  historical manual replies cannot override current resumed state. It clarifies
  material-only pricing with separate delivery/tax caveats and the existing
  canonical material/quantity fact contract. Server takeover, consent,
  uncertainty, pricing validation and deterministic rendering are unchanged.
- A new context/prompt regression failed before the change. All 36 focused
  tests and targeted lint pass afterward. Additional renderer tests prove
  model-supplied amounts cannot replace calculated amounts, mismatched material
  or quantity and unavailable official prices still block, and current takeover
  still skips the model. Live v4 deployment and pricing retest are pending.
- Commit `f1375ee` was pushed and deployed through Lovable to ai-draft and
  process-communications only. Independent unauthenticated empty POST checks
  returned 401 for both after deployment. Model, secrets, crons, frontend,
  schema and sending gates were unchanged.
- Independent SQL read of the active material confirms 20 yards per full
  load at 720, and 38 per remainder yard: 2 x 720 + 10 x 38 = 1820 for
  50 yards. No delivery/tax/grand-total value was invented. Draft-only audit
  `a7abbe52-7ada-4461-8962-3bc12773ec65` at 16:26:45 UTC verified prompt v4,
  HIGH confidence, no uncertainty, requires_human false and canonical
  confirmed material/quantity facts after the explicit resume.
- Real repeated price inquiry arrived at 16:27:17 UTC, local
  `5420c164-041d-4153-bcd6-a905a8bf523c`, provider
  `801a19c8-9aae-4e83-9940-29c0df70a0db`. Job
  `2485028d-6333-4700-a66a-dcf3a88215c0` completed DONE with one attempt and
  no error. Audit `a465c03e-3688-4c0c-ac3c-8e604a022a82` used prompt v4 and
  PROVIDE_STANDARD_PRICE with the verified 1820 material calculation.
- Automatic price SMS `99e43203-27f1-4173-883f-c44aca018728`, provider
  `32e76f3c-6a82-47ce-9e89-a2c0ea76f74b`, was created at 16:28:09 UTC and
  DELIVERED with one send attempt. Its immutable payload exactly matches the
  deterministic renderer: material price $1820.00; delivery and taxes confirmed
  separately. Dashboard displayed delivered. The renderer uses the catalog's
  literal bilingual name (including both 1-inch/3-inch options); it did not
  invent a variant-specific price or a booking. Human-request escalation is
  the next controlled conversational test; SMS remains TESTING.

## September 14: explicit human request and operational checkpoint

- Real request for Salvador arrived at 16:30:22 UTC, local
  `c97648af-767e-4d41-b5b3-a48088a84a69`, provider
  `5b6807d8-2458-41bf-b6ca-97ae549145ff`. Prompt-v4 audit
  `f663a95d-5410-45f9-9c6b-2f7d282a2e24` records requires_human true,
  ai_may_continue false and reason "Customer requested a human."
- Job `9f3e81a3-ebb4-499c-a15b-d9b5920ec03e` ended in the existing FAILED
  safety-stop state after one evaluation, with no outbound reply. Activity
  `a881dda3-a2d0-447d-8ce5-f2019eb8709d` records AI_REQUIRES_HUMAN at
  16:31:07 UTC. This is a successful escalation test, not a provider failure.
- Operational checkpoint: one process-communications-minute cron, most recent
  16:33 UTC run succeeded, zero active jobs, zero active outbox and zero REVIEW
  outbox. Runtime remains SMS TESTING, AI enabled only for the owner handset,
  scheduled/marketing false, activated_at null and Calling SETUP_REQUIRED.
  Cron SQL execution success alone is not proof of downstream SMS delivery;
  the separate provider-linked tests above supply that evidence.
- Owner restored the sent.DM browser session. The active production webhook
  `584720ad-a0ff-418b-beb9-bf37c33dd51a` still listens to ten event types.
  Its price-message delivered event shows HTTP 200 and the correct existing
  local message/customer/lead IDs in the endpoint response. No webhook settings
  or credentials were changed or exposed.
- Inspected per-event details and webhook test controls. The available test
  form sends sample events, not a selected historical event; no sample event
  was sent. Current provider documentation confirms message-based deduplication
  rather than treating the webhook-configuration ID as a unique delivery ID:
  https://docs.sent.dm/start/webhooks/handling-retries . The deployed handler
  already uses provider message ID plus status, consistent with that contract.
- Controlled database-level replay invoked the deployed ingest_sms_event for
  the already-PROCESSED human-request inbound and price DELIVERED transition.
  Both returned duplicate:true. Follow-up SQL confirms one local message and
  one matching event row per provider ID, only the original human-request job,
  no triggered outbox, and unchanged RECEIVED/DELIVERED statuses. This proves
  live database duplicate handling, not a full signed HTTP replay.
- Remaining release evidence: a genuinely unknown handset, signed HTTP replay,
  controlled scheduled transactional rule and broader scheduling/lease guards.
  Owner was asked to have a different phone send a labeled integration test;
  it must not be enrolled or automatically contacted. No additional number
  was assumed, no historical consent fabricated, and no scheduled rule enabled.

## September 14: unknown-number capture and scheduling gate audit

- A genuinely unknown handset sent the labeled integration test at 16:50 UTC.
  The production webhook created customer `bbb0f0c4-4f5a-493a-a36d-852929af4c13`,
  lead `eccd87ab-e16c-4b55-b506-4c669ce5cf58` and inbound message
  `5b1e344b-7f9e-49b6-80b1-54ff5dc0c664` with provider ID
  `afe21112-b681-49f5-81ea-52a9ec7233a1`. The phone is intentionally not
  recorded in this repository; the audit query masked it to the final four
  digits.
- The live dashboard displayed a separate `Unknown SMS` lead and the inbound
  body once. Production SQL independently verified RECEIVED plus one PROCESSED
  webhook event, one inbound row, zero outbound rows, zero communication jobs
  and zero outbox rows. The customer has no recorded SMS consent, no double
  opt-in and no fabricated opt-out. Human takeover remains false, while the
  testing allowlist keeps the reply composer disabled for this number.
- This proves that an unknown sender is retained safely without being enrolled,
  discarded, answered by AI or contacted automatically. The row remains as a
  real inbound lead for staff follow-up under the normal consent rules.
- The follow-up scheduling audit found `scheduled_sending_enabled=false`,
  `activated_at=null`, `marketing_approved=false`, zero due candidates, zero
  active jobs and zero active/review outbox rows. Only `human-takeover` is ON;
  every message-producing automation rule remains SETUP_REQUIRED. Business
  hours remain 09:00-17:00, Monday-Friday, America/Chicago. SMS remains TESTING
  with AI restricted to the owner handset; Calling remains SETUP_REQUIRED.
- Unknown-number production evidence is complete. A full provider-signed HTTP
  replay and a controlled scheduled transactional send remain release gates;
  the database-level duplicate replay is already verified above. No production
  gate was broadened during this test.
- Final regression: all 270 repository tests passed across 41 files, the
  production build completed, and targeted communications lint returned zero
  errors (one pre-existing Fast Refresh warning in AppState). At 16:56 UTC the
  minute worker's latest run was succeeded, the unknown provider ID still had
  exactly one event, active jobs/outbox remained zero, and every production
  gate above was unchanged.
