// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Phase 05 preservation contracts", () => {
  it("keeps every existing public route and the admin route boundary", () => {
    const app = readProjectFile("src/App.tsx");
    for (const route of ["/", "/services", "/materials", "/projects", "/contact", "/blog", "/blog/:slug"]) {
      expect(app).toContain('path="' + route + '"');
    }
    expect(app).toContain('path="/admin"');
  });

  it("adds nullable item loads with no default or legacy backfill", () => {
    const migration = readProjectFile("supabase/migrations/20260826210000_phase05_ticket_safety.sql");
    expect(migration).toContain("add column if not exists loads integer");
    expect(migration).toContain("alter column loads drop default");
    expect(migration).not.toMatch(/update\s+public\.ticket_items\s+set\s+loads/i);
  });

  it("keeps the existing MT function and allocates inside the atomic transaction", () => {
    const migration = readProjectFile("supabase/migrations/20260826210000_phase05_ticket_safety.sql");
    expect(migration).toContain("v_ticket_number := public.next_ticket_number()");
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function\s+public\.next_ticket_number/i);
    expect(migration).toContain("revoke execute on function public.next_ticket_number() from authenticated");
    expect(migration.indexOf("where t.client_request_id = p_client_request_id")).toBeLessThan(
      migration.indexOf("v_ticket_number := public.next_ticket_number()"),
    );
    expect(migration).toContain("tickets_client_request_id_unique");
    expect(migration).toContain("perform public.validate_ticket_payload");
    expect(migration).toContain("Legacy Ticket pricing snapshots cannot be changed or reinterpreted");
  });

  it("preserves 812 by 1218 and direct 4 by 6 printing", () => {
    const print = readProjectFile("src/lib/admin/print.ts");
    expect(print).toContain("const W = 812, H = 1218");
    expect(print).toContain("@page{size:4in 6in;margin:0}");
    expect(print).toContain("width:4in;height:6in");
  });

  it("replaces Ticket hard delete with void and immutable correction history", () => {
    const detail = readProjectFile("src/control-center/approved/screens/TicketDetail.tsx");
    const mapper = readProjectFile("src/control-center/approved/state/databaseMap.ts");
    const migration = readProjectFile("supabase/migrations/20260826210000_phase05_ticket_safety.sql");
    expect(detail).not.toContain('.from("tickets").delete()');
    expect(detail).toContain("voidTicket");
    expect(migration).toContain("phase05_no_hard_delete");
    expect(migration).toContain("superseded_at = now()");
    expect(migration).toContain("coalesce(auth.jwt()->>'email', auth.uid()::text)");
    expect(mapper).toContain("ticketHistory");
    expect(mapper).toContain("entry.reason");
  });

  it("requires an admin or staff role at both the UI and database boundaries", () => {
    const layout = readProjectFile("src/control-center/ExactControlCenterLayout.tsx");
    const migration = readProjectFile("supabase/migrations/20260826210000_phase05_ticket_safety.sql");
    expect(layout).toContain("useAdminAccess");
    expect(layout).toContain("!access.authorized");
    expect(migration).toContain("phase05_role_guard");
    expect(migration).toContain("public.is_admin_or_staff()");
    expect(migration).toContain("phase05_anon_guard");
  });
});
