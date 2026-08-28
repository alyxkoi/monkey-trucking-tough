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

  it("keeps Monkey red for brand actions while the Money graph uses the acid operational accent", () => {
    const tickets = read("src/control-center/approved/screens/Tickets.tsx");
    const ticketDetail = read("src/control-center/approved/screens/TicketDetail.tsx");
    const jobDetail = read("src/control-center/approved/screens/JobDetail.tsx");
    const invoiceDetail = read("src/control-center/approved/screens/InvoiceDetail.tsx");
    const customers = read("src/control-center/approved/screens/Customers.tsx");
    const picker = read("src/control-center/approved/components/ui/CustomerPicker.tsx");
    const avatar = read("src/control-center/approved/components/ui/CustomerInitialAvatar.tsx");
    const chart = read("src/control-center/approved/components/money/CollectedChart.tsx");
    const printPreview = read("src/control-center/approved/components/tickets/TicketLabelPreview.tsx");

    for (const source of [tickets, ticketDetail, jobDetail, invoiceDetail]) {
      expect(source).toContain("text-mt-red");
    }
    expect(customers).toContain("<CustomerInitialAvatar");
    expect(picker).toContain("<CustomerInitialAvatar");
    expect(avatar).toContain("bg-mt-red");
    expect(avatar).toContain("text-canvas");
    expect(avatar).toContain("font-black");
    expect(avatar).toContain("toUpperCase()");
    expect(chart).toContain('className="block h-full w-full text-ice"');
    expect(chart).toContain('stopColor="currentColor"');
    expect(chart).not.toContain("#8FCBFF");
    expect(printPreview).not.toContain("text-mt-red");
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

  it("preloads main admin routes without replacing the authenticated shell", () => {
    const app = read("src/App.tsx");
    const loaders = read("src/control-center/adminRouteLoaders.ts");
    const shell = read("src/control-center/approved/components/shell/AppShell.tsx");
    const sideNav = read("src/control-center/approved/components/shell/SideNav.tsx");
    const mobileNav = read("src/control-center/approved/components/shell/MobileTabBar.tsx");

    for (const section of ["overview", "leads", "jobs", "tickets", "customers", "money", "settings"]) {
      expect(loaders).toContain(`${section}: () => import(`);
      expect(app).toContain(`lazy(mainAdminRouteLoaders.${section})`);
    }
    expect(shell).toContain("requestIdleCallback");
    expect(shell).toContain("<Suspense fallback={<AdminRouteFallback />}>");
    expect(sideNav).toContain("onMouseEnter={() => void preloadMainAdminRoute");
    expect(mobileNav).toContain("onFocus={() => void preloadMainAdminRoute");
    expect(sideNav).toContain("lg:fixed");
    expect(shell).toContain("lg:pl-[280px]");
  });

  it("uses solid acid-green selections with red-to-snow primary actions", () => {
    const tailwind = read("tailwind.config.ts");
    const buttons = read("src/control-center/approved/components/ui/Button.tsx");
    const panels = read("src/control-center/approved/components/ui/Panel.tsx");
    const settings = read("src/control-center/approved/screens/SettingsHome.tsx");

    expect(tailwind).toContain('DEFAULT: "#B7FF35"');
    expect(tailwind).not.toContain('#8FCBFF');
    expect(buttons).toContain("bg-mt-red text-canvas");
    expect(buttons).toContain("hover:bg-ink");
    expect(buttons).toContain("motion-safe:hover:-translate-y-0.5");
    expect(panels).toContain("primary = false");
    expect(panels).toContain("bg-mt-red");
    expect(settings).toContain("bg-ice text-canvas");
    expect(settings).toContain("{active && (");
  });

  it("keeps the refined Overview tied to real operational records", () => {
    const overview = read("src/control-center/approved/screens/Overview.tsx");

    expect(overview).toContain("collectedSeries({ period, payments })");
    expect(overview).toContain("attention.slice(0, expanded ? 6 : 4)");
    expect(overview).toContain("Next Scheduled Date");
    expect(overview).toContain("job.status === 'SCHEDULED'");
    expect(overview).toContain("label: 'New Leads'");
    expect(overview).toContain("label: 'Open Quotes'");
    expect(overview).toContain("label: 'Scheduled Jobs'");
  });

  it("keeps profile avatars private, owner-scoped, and immediately replacing", () => {
    const avatar = read("src/control-center/approved/components/shell/ProfileAvatar.tsx");
    const sheet = read("src/control-center/approved/components/shell/Sheet.tsx");
    const service = read("src/control-center/profile/profileAvatar.ts");
    const migration = read("supabase/migrations/20260828213000_profile_avatar_storage.sql");

    expect(avatar).toContain("PROFILE_AVATAR_ACCEPT");
    expect(avatar).toContain("uploadProfileAvatar(user, file)");
    expect(avatar).not.toContain("Save profile");
    expect(sheet).toContain("createPortal");
    expect(service).toContain("10 * 1024 * 1024");
    expect(service).toContain("image/jpeg");
    expect(service).toContain("image/png");
    expect(service).toContain("image/webp");
    expect(service).toContain("upsert: true");
    expect(service).toContain("`${userId}/avatar`");
    expect(service).not.toMatch(/service.role|base64/i);
    expect(migration).toContain("public = excluded.public");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("name = auth.uid()::text || '/avatar'");
    expect(migration).not.toMatch(/public\.(customers|leads|jobs|tickets|materials|invoices|payments)/i);
  });
});
