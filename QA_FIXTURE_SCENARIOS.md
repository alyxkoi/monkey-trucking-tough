# Phase 06 QA Fixture Scenarios

The fixture layer is available only when Vite is running in development mode with:

```text
VITE_DEMO_MODE=true
```

Open `/admin`, then use the small **Enable demo data** control. Fixture state lives only in React memory for the current browser tab. It never calls the Control Center query, Supabase mutations, the production ticket queue, or local ticket storage. **Reset demo** restores the same IDs, names, amounts, messages, and relative dates. **Use real data** removes the session flag and remounts the normal authenticated data path.

The fixture clock anchors records to the local day when the browser session starts so “today” and “tomorrow” remain testable. That reference is pinned for the session, so every reset is byte-for-byte deterministic even if QA crosses midnight.

## Named scenarios

| Scenario | Where to find it | Expected behavior |
| --- | --- | --- |
| Maya Turner | Leads, Needs Attention | New Facebook lead from “August Driveway Campaign,” no reply yet, generates New Lead attention. |
| Rancho La Esperanza | Leads → Rancho La Esperanza | Spanish customer/AI conversation about material delivery. |
| Kaufman Feed | Leads or Customers → Kaufman Feed | Spanglish conversation, repeat paid work, photos, ticket, payment, and timeline history. |
| Natalie Briggs | Leads, Needs Attention | AI escalated custom driveway pricing instead of guessing; Salvador reply guidance is visible. |
| Cedar Creek Storage | Jobs → Waiting on a date, Needs Attention | Accepted quote with no Job generates Schedule Job attention. |
| Lopez Materials | Jobs calendar | Scheduled material-delivery job today. |
| Marisol Vega | Jobs calendar | Material-delivery job tomorrow. |
| Ortiz Ranch | Overview, Needs Attention, Jobs → Ortiz Ranch | Today’s job is blocked by a missing gate code. Open Job should guide/pulse Call and Text. |
| Ellis Construction | Jobs, Money | Completed job with no invoice; Create Invoice is the contextual next step. |
| Arturo Martinez | Customers, Tickets | Existing customer used for duplicate phone/email matching and a finalized standalone ticket. |
| Mixed material loads | Tickets → MT1108 | One ticket has 3 Flexbase loads and 2 Crushed Concrete loads while its independently editable delivery load count is 5. |
| Standalone ticket | Tickets → MT1109 | No Job; ticket total is eligible to create its invoice. |
| Offline ticket | Tickets → Saved on device / sync indicator | Pending ticket has no MT number. Sync assigns the next number from the fixture counter in memory. Reset returns it to pending. |
| Voided ticket | Tickets → MT1107 | Preserved void reason and history; cannot create an invoice. |
| Missing Delivery validation | `/admin/tickets/new?fixture=missing-delivery` | Arturo and one Flexbase load are prefilled, Delivery is deliberately unset. Save guidance must move to Delivery. |
| Nina Cho | Money | Invoice due soon. |
| Joe Alvarez | Money, Needs Attention | Overdue invoice with three completed follow-ups generates overdue attention. |
| Riverbend Estates | Money, Needs Attention | Disputed invoice remains open and chasing is paused. |
| Dwayne Roth | Money, Needs Attention | Customer says Zelle was sent, invoice stays unpaid, and Verify Payment attention appears. |
| Kaufman Feed paid invoice | Money | Paid invoice and confirmed Check payment. |
| Miguel Santos | Money → Worker Pay | Pending hourly pay; not included in paid worker totals. |
| Luis Ramirez | Money → Worker Pay | Driver invoice extracted and waiting for Salvador to confirm the detected details; it is not paid. |
| Salvador Alvarez worker payment | Money → Worker Pay | Completed worker payment; this is the only fixture worker pay that counts as paid. |
| Angela Price | Customers | Completed and paid work eligible for review-request UI. External sending remains setup-required. |
| Parker Family Farm | Customers | Prior paid work more than 60 days ago, eligible for reactivation. |
| Empty State Test | Customers → Empty State Test | Deliberately has no leads, quotes, jobs, tickets, invoices, payments, photos, or activity. |
| Disconnected providers | Settings → Communication & AI | OpenAI drafts are internal-only; SMS, calling, and payment transport are setup-required and no provider is faked. |

## Stable fixture IDs

- Ortiz Ranch Job: `qa-job-ortiz`
- Dwayne Roth Invoice: `qa-invoice-zelle`
- Rancho La Esperanza Lead: `qa-lead-spanish`
- Kaufman Feed Lead: `qa-lead-spanglish`
- Mixed-load Ticket: `qa-ticket-mixed`
- Offline Ticket: `qa-ticket-offline`
- Missing Delivery customer: `qa-customer-arturo`

Runtime actions mutate only the in-memory fixture copy. Reset discards those actions and recreates the documented baseline.

## OpenAI draft and automation dry run

| Scenario | Stable record | Expected internal behavior |
|---|---|---|
| Spanish material delivery | `qa-lead-spanish` | Detect Spanish, retain known load and city context, ask only for the next missing delivery fact. |
| Spanglish with takeover | `qa-lead-spanglish` | Human takeover blocks conversational AI. |
| Custom driveway pricing | `qa-lead-escalation` | No invented price, Salvador required, draft remains internal. |
| Spouse-aware quote follow up | `qa-quote-followup` | Dry run references the earlier wife context instead of generic copy. |
| Zelle claim | `qa-invoice-zelle` | Invoice remains unpaid and human verification is required. |
| Review request | `qa-job-review` | One dry-run preview after completed and paid work. |
| 60-day reactivation | `qa-customer-reactivation` | One warm preview with no recurring schedule. |

Every AI result in fixture mode is deterministic and in memory. SMS, email and calling remain `SETUP_REQUIRED`.
