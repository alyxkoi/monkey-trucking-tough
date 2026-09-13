# sent.DM delivery investigation — sent support report

Sent after explicit owner confirmation on September 13, 2026, from
`contact@kyokaforge.com`. Gmail confirmed the SENT label.
Message/thread ID: `1a09cd368ff4a681`.

To: support@sent.dm

Subject: Monkey Trucking 10DLC SMS routes and sends, then fails without carrier reason

Hello sent.DM support,

We are integrating Monkey Trucking LLC's dedicated number +19453750877 with
our dashboard. Two controlled, owner-consented tests using the approved
Monkey Trucking Update utility template failed after reaching SENT:

1. Message `7e335b98-0651-4188-a31d-b18a31a11b63`, September 13, 2026,
   15:18:46–15:18:48 America/Chicago, submitted through your Playground.
2. Message `c5cf44f4-3734-4742-a27b-c0b75d449f79`, September 13, 2026,
   queued 17:01:03, SENT 17:01:04, FAILED 17:01:05 America/Chicago,
   submitted through our server-side API integration. One submission attempt.

Both target the same owner's test handset, ending 8256. The template ID is
`48d013e5-debe-4efa-864b-c90798242ab4`. The second test's queued, routed, sent
and failed signed webhooks were received and processed correctly. Activities
shows only FAILED with no actionable carrier reason. We have stopped further
test sends and kept all automated customer messaging disabled.

Please provide the exact carrier rejection code and description for these
message IDs, and confirm:

- The number is fully bound to an approved, carrier-active Customer Care
  campaign, not just allocated or submitted to TCR.
- Outbound routing and inbound SMS are enabled for this number.
- Whether a sender profile header or any remaining activation step is required.
- Whether recipient suppression, a test restriction or template configuration
  caused these failures.
- Whether this number supports inbound voice/call-status webhooks and missed
  calls through sent.DM, and the relevant documented setup if supported.

Please do not change the existing webhook URL, rotate credentials or enable
promotional traffic while investigating.

Thank you.

---

The report above was emailed as plain text to support@sent.dm.
No API key, webhook signing secret, tax ID or unrelated customer data is included.
