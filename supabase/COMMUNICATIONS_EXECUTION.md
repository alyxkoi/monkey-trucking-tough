# Communications execution and release gates

Baseline: main `0f1e5bc`, production project `dugmcjpistrxxryaubkd`, sent.DM number `+19453750877`.

The user authorized implementing and auditing the existing dashboard SMS/AI plan. No dashboard redesign, provider substitution, or general customer campaign is authorized by a test run.

## Execution order

1. Verify source, deployed schema, secrets by name, provider account and recovery path.
2. Diagnose the failed handset test without inventing a carrier rejection reason.
3. Repair webhook routing and durable status reconciliation, including events before provider ID linking.
4. Add missing settings and contextual double opt-in with ordered consent events.
5. Use one immutable durable outbox for human, AI and scheduled sends. Bound retries and quarantine ambiguity.
6. Connect dashboard testing mode, actual delivery states, safe composer retries and realtime refresh.
7. Reuse AI drafting with latest context, deterministic safety, bilingual validation and fail-closed context loading.
8. Connect inbound events to durable AI jobs with takeover/consent/latest-message rechecks and audited resume.
9. Run existing scheduled rules with durable one-time keys, real business time, stop conditions and no historical catchup.
10. Test handlers, SQL concurrency/state transitions, frontend and full production build.
11. Deploy compatible database, functions and frontend with sending gates closed; stage real tests on the allowlisted handset.
12. Audit source versus deployed state; document passed tests and unresolved external dependencies; commit and push.

## Release gates

- SMS stays TESTING until real outbound, inbound, delivery/failure, compliance and deduplication tests pass.
- AI sending and scheduled sending default OFF independently of AI drafting readiness.
- Promotional/review/reactivation sends remain blocked until the actual registered campaign and consent cover them.
- Calling stays SETUP_REQUIRED until the approved number's voice API/webhooks are verified and exercised.
- Never retry an uncertain provider submission beyond sent.DM's 24-hour idempotency window. Local operation identity is permanent.
- A STOP or human takeover cancels work that has not begun dispatch. A request already accepted/in flight with the carrier cannot be recalled.
- Preserve real failed-test evidence. Do not label an API acceptance as handset delivery.

## Baseline external evidence

The first controlled SMS was sent through sent.DM Playground, not the dashboard endpoint. Provider ID `7e335b98-0651-4188-a31d-b18a31a11b63` ended FAILED. Local message `611406db-4cfa-4494-b3c2-6e92cc3e16a3` incorrectly remains SENT because the old deployed webhook ignored outbound events. Correcting reporting does not establish the cause of that provider failure.

Official references: [sent.DM idempotency](https://docs.sent.dm/reference/api/idempotency), [event types](https://docs.sent.dm/start/webhooks/event-types), [messaging](https://docs.sent.dm/start/guides/sending-messages), [compliance](https://docs.sent.dm/start/advanced/compliance-regulations), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
