# Phase 05 Ticket Safety Implementation

Branch: codex/phase-05-ticket-safety

This branch contains only the preservation gate and the existing Ticket safety
vertical. It does not add Leads, Jobs, Money, AI, the standalone material-order
flow, or the prototype Control Center shell.

## Lovable-managed deployment gate

No live Supabase access or mutation was performed from Codex.

Before a coordinated code-and-migration release in Lovable:

1. Create or verify a recoverable database backup through the managed project.
2. Run supabase/preservation/phase05_ticket_safety_preflight.sql read-only.
3. Retain the output with the deployment record and confirm:
   - the exact next_ticket_number() definition;
   - the current MT prefix and counter;
   - no duplicate Ticket numbers;
   - at least one existing admin or staff role;
   - actual RLS policies, indexes, triggers, settings and redacted legacy fixtures.
4. Compare the live output to the migration assumptions. Stop on any mismatch.
5. Apply supabase/migrations/20260826210000_phase05_ticket_safety.sql through
   Lovable in the same release as the updated admin Ticket code.
6. Run supabase/preservation/phase05_ticket_safety_postflight.sql read-only and
   compare the MT counter to the preflight value. The migration itself must not
   consume a number.
7. Smoke-test an authorized online Ticket, an offline retry using the same
   request ID, view, and the existing 4x6 print path before broad access.

## Implemented safety contracts

- New ticket_items.loads is nullable, has no default, and is never backfilled.
- tickets.load_count remains the independent delivery-pricing load count.
- New Tickets require explicit delivery selection and a tax-on-delivery snapshot.
- The existing next_ticket_number() body remains untouched.
- Direct client access to the counter is removed after cutover.
- One security-definer transaction validates snapshots, allocates the MT number,
  inserts the Ticket and its items, and records history.
- client_request_id and an advisory transaction lock make retries idempotent.
- New offline entries are stored under an account-scoped v2 key.
- Existing mt_ticket_queue_v1 entries drain first and keep unknown item loads
  and tax-on-delivery values as NULL.
- Corrections preserve superseded item rows and before/after snapshots.
- Legacy pricing with an unknown tax-on-delivery snapshot is locked against
  reinterpretation; contact, driver, address and notes may still be corrected.
- Voids require a reason and preserve the Ticket, items, actor and timestamp.
- Application hard-delete actions for Tickets, materials and drivers are removed.
- user_roles is enforced for both the admin UI and database access.
- drivers remains the existing Ticket driver source.
- The public route tree and 812x1218 / 4x6 print engine are unchanged.

## Verification

- TypeScript: pass.
- Vitest: 23 tests pass.
- Production Vite build: pass.
- Changed-file ESLint: pass.
- Public route build smoke: /, /services, /materials, /projects,
  /contact, /blog and /admin all return the built application.
- Repository-wide ESLint still reports the baseline 9 errors and 14 warnings in
  pre-existing public/shared files outside this Ticket safety change.

## Known repository blocker

package-lock.json is not synchronized with package.json, so a clean npm ci is not
currently reproducible. The canonical lockfile should be repaired as its own
reviewed maintenance change rather than mixed into this safety branch.
