// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Phase 05 Control Center contracts", () => {
  it("keeps every public route and mounts the full authenticated admin map", () => {
    const app = read("src/App.tsx");
    for (const route of ["/", "/services", "/materials", "/projects", "/contact", "/blog", "/blog/:slug"]) {
      expect(app).toContain(`path="${route}"`);
    }
    for (const route of ["attention", "leads", "jobs", "tickets", "customers", "money", "settings"]) {
      expect(app).toContain(`path="${route}"`);
    }
    expect(app).toContain("ControlCenterLayout");
    expect(app).not.toContain('element={<AdminTickets />}');
  });

  it("uses user_roles for the UI boundary and the database boundary", () => {
    const layout = read("src/control-center/ControlCenterLayout.tsx");
    const migration = read("supabase/migrations/20260826230000_phase05_control_center.sql");
    expect(layout).toContain("useAdminAccess");
    expect(layout).toContain("!access.authorized");
    expect(migration).toContain("public.is_admin_or_staff()");
    expect(migration).not.toContain("worker login");
  });

  it("never rewrites legacy ticket loads, snapshots, or the MT counter", () => {
    const migration = read("supabase/migrations/20260826230000_phase05_control_center.sql");
    expect(migration).not.toMatch(/update\s+public\.ticket_items\s+set\s+loads/i);
    expect(migration).not.toMatch(/update\s+public\.tickets\s+set\s+(materials_subtotal|tax_rate|grand_total)/i);
    expect(migration).not.toMatch(/next_ticket_number\s*=/i);
    expect(migration).toContain("from public.create_ticket_atomic($1,$2,$3::uuid,$4)");
    expect(migration).toContain("from public.create_ticket_atomic($1,$2,$3::text,$4)");
    expect(read("src/lib/admin/tickets.ts")).toContain('rawRpc("create_ticket_compat_atomic"');
  });

  it("keeps ticket and invoice amount sources separate", () => {
    const migration = read("supabase/migrations/20260826230000_phase05_control_center.sql");
    expect(migration).toContain("v_job.agreed_amount");
    expect(migration).toContain("v_ticket.grand_total");
    expect(migration).toContain("v_ticket.job_id is not null");
    expect(migration).toContain("not in ('saved','active')");
  });

  it("preserves historical and financial safety", () => {
    const migration = read("supabase/migrations/20260826230000_phase05_control_center.sql");
    expect(migration).toContain("No DELETE policy");
    expect(migration).toContain("enforce_financial_safe_write");
    expect(migration).toContain("void_financial_record");
    expect(migration).toContain("financial_history");
    expect(migration).toContain("create_worker_payment_pending");
    expect(migration).toContain("mark_worker_payment_paid");
  });

  it("keeps material-line loads separate from independently editable delivery loads on Quotes", () => {
    const details = read("src/control-center/details.tsx");
    expect(details).toContain("pricedMaterialLines");
    expect(details).toContain("suggestedDeliveryLoads");
    expect(details).toContain("deliveryLoadsTouched");
    expect(details).toContain("Delivery loads begin at the sum of material loads");
  });

  it("keeps the manual lead source list intentionally simple", () => {
    const layout = read("src/control-center/ControlCenterLayout.tsx");
    expect(layout).toContain('["Word of mouth", "Facebook", "Website", "Walk in", "Other"]');
    expect(layout).not.toContain("Billboard");
    expect(layout).not.toContain("Flyer");
    expect(layout).not.toContain("Google Search");
    expect(layout).not.toContain("Facebook Marketplace");
  });

  it("uses a keyboard-capable reusable CustomerPicker", () => {
    const components = read("src/control-center/components.tsx");
    const layout = read("src/control-center/ControlCenterLayout.tsx");
    const tickets = read("src/control-center/ticketPages.tsx");
    expect(components).toContain('event.key === "ArrowDown"');
    expect(components).toContain('event.key === "Enter"');
    expect(layout.match(/<CustomerPicker/g)?.length).toBeGreaterThanOrEqual(2);
    expect(tickets).toContain("<CustomerPicker");
  });

  it("does not introduce prototype mock persistence", () => {
    const data = read("src/control-center/data.ts");
    const context = read("src/control-center/context.tsx");
    expect(data).toContain("supabase");
    expect(context).toContain("loadControlData");
    expect(data).not.toContain("localStorage");
    expect(context).not.toContain("mockData");
  });
});
