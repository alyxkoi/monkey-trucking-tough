# Monkey Trucking prelaunch operational reset

This is a one-time, guarded maintenance operation for managed Supabase project
`dugmcjpistrxxryaubkd`. It is deliberately **not** a migration and must never be
added to the deployment migration chain.

Run only from the Lovable-managed database tooling for the confirmed Monkey
Trucking project after a recoverable managed backup has been verified.

1. Run `prelaunch_operational_reset_preflight.sql` read-only.
2. Save its complete output, including counts, configuration snapshots, counter
   values, and `preflight_token`.
3. Verify the managed project is `dugmcjpistrxxryaubkd` and record the recoverable
   backup reference.
4. Open `prelaunch_operational_reset.sql` in the managed SQL editor. Replace only
   its three `PASTE_..._HERE` guard values with the confirmed project ref, backup
   reference, and current preflight token.
5. Execute the complete reset script once. It runs in one transaction and aborts
   if the live counts/counters changed after preflight, any required schema is
   missing, a preserved configuration checksum changes, a counter changes, or a
   post-reset operational count is nonzero.
6. Run `prelaunch_operational_reset_postflight.sql` independently and save the
   output with the maintenance record.

Intentionally preserved: Materials, Drivers, Workers, application settings,
Control Center settings, automation rules, tracking links, email transport state,
suppressed-email compliance records, users/roles/authentication, all provider
secrets, migrations/functions, numbering counters, public contact submissions,
and `ticket_deletion_audit` accountability rows.

