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
    const layout = read("src/control-center/ExactControlCenterLayout.tsx");
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

  it("allocates demo MT numbers in offline queue creation order", () => {
    const state = read("src/control-center/approved/state/AppState.tsx");
    expect(state).toContain(".sort((a, b) => a.created_at.localeCompare(b.created_at)");
    expect(state).toContain("allocated.set(row.id");
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

  it("requires reasons for Job and Worker Pay cancellation paths", () => {
    const job = read("src/control-center/approved/screens/JobDetail.tsx");
    const money = read("src/control-center/approved/screens/Money.tsx");
    expect(job).toContain('label="Cancellation reason"');
    expect(job).toContain("cancelJob(job.id, cancelReason.trim())");
    expect(job).not.toContain("cancelJob(job.id, 'Cancelled by Salvador')");
    expect(money).toContain('title="Void worker payment"');
    expect(money).toContain("voidWorkerPayment(voidingPaymentId, reason)");
  });

  it("does not permit a historical Ticket correction without a reason", () => {
    const builder = read("src/control-center/approved/screens/TicketBuilder.tsx");
    expect(builder).toContain("editing && editNote.trim().length === 0");
    expect(builder).toContain("updateTicket(editing.id, input, editNote.trim())");
    expect(builder).not.toContain("'Edited after it was finalised'");
  });

  it("keeps local payment dates stable and reopens an invoice when its payment is voided", () => {
    const sheets = read("src/control-center/approved/components/money/MoneySheets.tsx");
    const state = read("src/control-center/approved/state/AppState.tsx");
    expect(sheets).toContain("receivedAt: parseDateKey(date).getTime()");
    expect(sheets).not.toContain("receivedAt: new Date(date).getTime()");
    expect(state).toContain("status: 'SENT', paid_at: null");
    expect(state).toContain("record_type: 'PAYMENT'");
    expect(state).toContain("event_type: 'VOIDED'");
  });

  it("keeps material-line loads separate from independently editable delivery loads on Quotes", () => {
    const pricing = read("src/control-center/approved/state/pricing.ts");
    const quote = read("src/control-center/approved/screens/QuoteScreen.tsx");
    expect(pricing).toContain("loads: number | null");
    expect(pricing).toContain("suggestedDeliveryLoads");
    expect(quote).toContain("setQuoteDeliveryLoads");
    expect(quote).toContain('title="Delivery"');
    expect(quote).toContain("Loads");
  });

  it("keeps the manual lead source list intentionally simple", () => {
    const leadSheet = read("src/control-center/approved/components/shell/NewLeadSheet.tsx");
    expect(leadSheet).toContain("['Word of mouth', 'Facebook', 'Website', 'Walk in', 'Other']");
    expect(leadSheet).not.toContain("Billboard");
    expect(leadSheet).not.toContain("Flyer");
    expect(leadSheet).not.toContain("Google Search");
    expect(leadSheet).not.toContain("Facebook Marketplace");
  });

  it("uses a keyboard-capable reusable CustomerPicker", () => {
    const components = read("src/control-center/approved/components/ui/CustomerPicker.tsx");
    const leadSheet = read("src/control-center/approved/components/shell/NewLeadSheet.tsx");
    const jobSheet = read("src/control-center/approved/components/jobs/ScheduleJobSheet.tsx");
    const tickets = read("src/control-center/approved/screens/TicketBuilder.tsx");
    expect(components).toContain("event.key === 'ArrowDown'");
    expect(components).toContain("event.key === 'Enter'");
    expect(leadSheet).toContain("<CustomerPicker");
    expect(jobSheet).toContain("<CustomerPicker");
    expect(tickets).toContain("<CustomerPicker");
  });

  it("does not introduce prototype mock persistence", () => {
    const data = read("src/control-center/data.ts");
    const context = read("src/control-center/context.tsx");
    expect(data).toContain("supabase");
    expect(context).toContain("loadControlData");
    expect(data).not.toContain("localStorage");
    expect(context).not.toContain("mockData");
    expect(() => read("src/control-center/approved/state/PrototypeAppState.reference.tsx")).toThrow();
  });

  it("keeps the exact UI support migration additive and outside Ticket history", () => {
    const migration = read("supabase/migrations/20260826234500_exact_control_center_ui_support.sql");
    expect(migration).toContain("alter table public.leads add column if not exists notes text");
    expect(migration).toContain("create_quote_draft_from_lead");
    expect(migration).toContain("update_quote_draft_atomic");
    expect(migration).toContain("LIGHT_CLEARING");
    expect(migration).not.toMatch(/update\s+public\.tickets/i);
    expect(migration).not.toMatch(/update\s+public\.ticket_items/i);
    expect(migration).not.toContain("next_ticket_number");
  });
});
