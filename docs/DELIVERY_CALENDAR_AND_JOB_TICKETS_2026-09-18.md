# Focused staff actions, delivery calendar, and job tickets

## Evidence and root causes

Read-only production tracing of the reported September 18 conversation found:

- `can we do today at 1 PM?`: two model timeouts (25,008 ms and 14,994 ms). Total generation 40,500 ms; routes 2 ms. Inbound provider-to-ingestion was 11,781 ms. This was not a slow route calculation or a calendar conflict.
- The later `hello?` failed response wording validation after 15,625 ms of model processing.
- `1pm today` subsequently succeeded, but needed 15,916 ms of model processing. No real calendar availability tool existed; only delivery preferences were recorded.
- Jobs contain start date/time and an all-day flag, not durations/end times.
- Staff resolution, rejection, preview, and notification already have distinct guarded RPCs. The labels exposed those internals instead of guiding staff.
- TicketBuilder carried customer/job/address but initialized material lines empty, delivery unset, loads to one. Accepted quote item snapshots already contain the correct order.

## Changes

- Simple delivery-time questions and statements use deterministic intake without a model call. Mixed requests, disputes, and established lifecycle changes retain existing protections. Bare daytime hours are resolved only when one AM/PM interpretation falls within 08:00–17:00; ambiguous hours/noon still clarify. This inference window does not change SMS business hours.
- Read-only calendar check plus atomic lifecycle reservation. Existing jobs and pre-acceptance lead reservations must be at least 60 minutes apart; exactly 60 minutes is allowed. All-day/un-timed jobs block their day. No guessed alternatives or availability.
- Reservations live on the existing lead and appear separately in Jobs. They do not accept/send quotes, create final jobs, or price custom work. Staff-created jobs consume their associated reservation. Lost/pickup leads and declined/void quotes release it. Historical records are not backfilled.
- All staff job scheduling and AI reservations share a database advisory transaction lock. A racing booking is checked again at commit; a conflict replaces the confirmation with an alternate-time question. Read failure cannot produce a booking claim.
- Existing lifecycle RPC is wrapped, not replaced. Identity, revision, consent, opt-out, pricing, quote, and takeover checks still run. Accepted/Scheduled conversation behavior remains staff-reviewed.
- Staff cards use request-specific titles, customer wording, an actual quote-pricing action, and a collapsed resolution area. Completion/decline do not send SMS; confirmation still requires the existing saved-record preview and a staff note.
- Job material order and new ticket prefill project accepted quote snapshots. Lines, yards, loads, address and notes remain editable copies; existing tickets take precedence. A stable per-builder request ID reuses the existing atomic ticket RPC/offline dedupe.

## Regression coverage

- Natural questions/declarations, available/conflicting/unavailable calendars, no model calls, quote approval/recipient progression, missing/ambiguous/past dates.
- Executed PostgreSQL: exact hour boundaries, all-day and near-time conflicts, stale/read-to-write races, replay idempotency, own-hold conversion, takeover/opt-out/accepted/revision guards.
- Existing Accepted/Scheduled, quote recipient, human takeover, SMS compliance and lifecycle regression suites.
- Actual UI components: plain staff actions with unchanged approval guards, multi-material job display, ticket prefill/edit/save double-click, existing-ticket preservation, data-loading initialization. Snapshot and request-ID/offline tests.

## Deployment

Apply `0031_delivery_calendar_reservations.sql` (mirrored in the Supabase migration directory) using the existing managed ledger. Redeploy `ai-control`, `ai-draft`, and `process-communications` with shared dependencies (prompt version `mt-ai-lifecycle-v17`). Publish the frontend. No production SMS, emails, bookings, quotes, or tickets should be created for verification; use read-only checks and the isolated conversation sandbox.
