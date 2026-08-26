# Phase 05 Ticket Safety Baseline

Branch: `codex/phase-05-ticket-safety`

Repository baseline: `aa282d3e7dbdc7728e30ece917cc446e972e9161`

## Locked preservation decisions

- `ticket_items.loads` is nullable and has no default.
- Existing item rows remain `NULL`; no historical value is inferred or backfilled.
- `tickets.load_count` remains the independently editable delivery load count.
- `user_roles` is the authorization source for `admin` and `staff`.
- Workers receive no authentication.
- `drivers` remains the Ticket driver table during this pass.
- The public routes and current `/admin` shell remain in place.
- Database changes are prepared as Lovable-managed migrations and are not applied directly from Codex.

## Repository-confirmed baseline

- `next_ticket_number()` is present in generated Supabase types, accepts no arguments and returns text.
- Current Ticket creation calls `next_ticket_number()` before inserting `tickets`, then inserts `ticket_items` separately.
- Material, delivery and tax settings are read from `materials` and `app_settings`.
- Existing item snapshots are `material_name`, `yards`, `is_full_load`, `rate_used` and `line_total`.
- The offline queue key is `mt_ticket_queue_v1`; queued drafts receive a number only when inserted.
- Printing renders an 812 by 1218 black-and-white image and supports share/download or direct 4 by 6 printing.
- Admin styles are scoped under `.adm`; public and admin routes share one React application.

## Lovable preflight required before applying the migration

Run `supabase/preservation/phase05_ticket_safety_preflight.sql` through the existing Lovable Supabase workflow and retain the output. This records:

- Actual schema, policies, indexes and triggers
- The exact `next_ticket_number()` body
- Current `MT` prefix and counter without incrementing it
- Current pricing and print settings
- Role-row counts
- Redacted representative legacy Ticket snapshots

The migration deliberately fails without the expected Ticket objects, counter function, settings row and at least one `admin` or `staff` role. It never calls `next_ticket_number()` during migration.

## Dependency baseline

`package-lock.json` is not synchronized with `package.json`, so `npm ci` fails before tests start. Dependencies can be installed without rewriting the lock using `npm install --package-lock=false`. Resolving the repository's canonical lockfile remains a separate preservation item and is not mixed into the Ticket safety changes.
