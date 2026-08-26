import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Banknote,
  CalendarDays,
  Gauge,
  LogOut,
  MessagesSquare,
  Plus,
  Settings2,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/monkey-trucking-logo.webp";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/admin/useAdminAccess";
import { Button, CustomerPicker, Field, SelectField, Sheet, TextArea, TextInput } from "./components";
import { createJob, createLead, dateKey, recordPayment, type Job, type Lead, type Payment } from "./data";
import { ControlCenterProvider, useControlCenter } from "./context";
import "@/styles/control-center.css";

const NAV = [
  { key: "overview", label: "Overview", tab: "Overview", to: "/admin", icon: Gauge },
  { key: "leads", label: "Leads & Quotes", tab: "Leads", to: "/admin/leads", icon: MessagesSquare },
  { key: "jobs", label: "Jobs", tab: "Jobs", to: "/admin/jobs", icon: CalendarDays },
  { key: "tickets", label: "Tickets", tab: "Tickets", to: "/admin/tickets", icon: Ticket },
  { key: "customers", label: "Customers", tab: "Customers", to: "/admin/customers", icon: Users },
  { key: "money", label: "Money", tab: "Money", to: "/admin/money", icon: Banknote },
  { key: "settings", label: "Settings", tab: "Settings", to: "/admin/settings", icon: Settings2 },
] as const;

function sectionFor(pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/attention")) return NAV[0];
  if (pathname.startsWith("/admin/quotes")) return NAV[1];
  return NAV.find((item) => item.to !== "/admin" && pathname.startsWith(item.to)) ?? NAV[0];
}

function TopBar() {
  const { pathname } = useLocation();
  const { pendingTickets, syncing, setAction } = useControlCenter();
  const [floating, setFloating] = useState(false);
  const floatingRef = useRef(false);
  const section = sectionFor(pathname);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      if (!floatingRef.current && y > 28) { floatingRef.current = true; setFloating(true); }
      if (floatingRef.current && y < 8) { floatingRef.current = false; setFloating(false); }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return (
    <div className="cc-top-wrap">
      <div className="cc-top" data-floating={floating}>
        <div className="cc-top-copy"><span className="cc-date">{date}</span><span className="cc-top-title">{section.label}</span></div>
        <div className="cc-top-actions">
          <div className="cc-sync" title={pendingTickets ? `${pendingTickets} tickets waiting to sync` : "All records synced"}>
            <span className="cc-sync-dot" style={pendingTickets ? { background: "var(--cc-warn)", boxShadow: "0 0 0 3px rgba(255,159,10,.12)" } : undefined} />
            <span>{syncing ? "Syncing" : pendingTickets ? `${pendingTickets} queued` : "Synced"}</span>
          </div>
          <Button primary compact icon={<Plus />} onClick={() => setAction("menu")}><span>New</span></Button>
        </div>
      </div>
    </div>
  );
}

function SideNav() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const current = sectionFor(pathname);
  return (
    <aside className="cc-side">
      <img className="cc-side-logo" src={logo} alt="Monkey Trucking" />
      <nav className="cc-nav" aria-label="Control Center">
        {NAV.map((item) => <NavLink key={item.key} to={item.to} className="cc-nav-link" data-active={current.key === item.key}><item.icon size={19} /><span>{item.label}</span></NavLink>)}
      </nav>
      <div className="cc-side-foot">
        <div className="cc-account">{user?.email}</div>
        <button className="cc-nav-link" style={{ width: "100%", border: 0, background: "transparent" }} onClick={() => void signOut()}><LogOut size={19} /><span>Sign out</span></button>
      </div>
    </aside>
  );
}

function MobileNav() {
  const { pathname } = useLocation();
  const { setAction } = useControlCenter();
  const current = sectionFor(pathname);
  return (
    <>
      <button className="cc-fab" aria-label="New" onClick={() => setAction("menu")}><Plus size={28} /></button>
      <nav className="cc-mobile-nav" aria-label="Control Center sections">
        {NAV.map((item) => <NavLink key={item.key} to={item.to} className="cc-mobile-link" data-active={current.key === item.key}><item.icon size={21} /><span>{item.tab}</span></NavLink>)}
      </nav>
    </>
  );
}

function NewMenu() {
  const { action, setAction } = useControlCenter();
  const navigate = useNavigate();
  return (
    <Sheet open={action === "menu"} onClose={() => setAction(null)} title="New">
      <div style={{ display: "grid", gap: 10 }}>
        <Button primary onClick={() => setAction("lead")}>New Lead</Button>
        <Button onClick={() => setAction("job")}>New Job</Button>
        <Button onClick={() => { setAction(null); navigate("/admin/tickets/new"); }}>New Ticket</Button>
        <Button onClick={() => setAction("payment")}>Record Payment</Button>
      </div>
    </Sheet>
  );
}

const SOURCES: Lead["source"][] = ["Word of mouth", "Facebook", "Website", "Walk in", "Other"];

function NewLeadSheet() {
  const { action, setAction, refresh, data } = useControlCenter();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<Lead["source"]>("Word of mouth");
  const [campaign, setCampaign] = useState("");
  const [need, setNeed] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim() || !phone.trim() || !need.trim()) { toast.error("Name, phone, and what they need are required."); return; }
    setBusy(true);
    try {
      const rows = await createLead({ name, phone, email, source, campaign, need });
      await refresh();
      setAction(null);
      if (rows[0]?.matched_existing) toast.success("Existing customer matched. A new lead was added without a duplicate.");
      else toast.success("Lead created.");
      navigate(`/admin/leads/${rows[0]?.lead_id}`);
      setCustomerId(""); setName(""); setPhone(""); setEmail(""); setCampaign(""); setNeed("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Lead could not be saved."); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={action === "lead"} onClose={() => setAction(null)} title="New Lead" actions={<><Button onClick={() => setAction(null)}>Cancel</Button><Button primary disabled={busy} onClick={() => void save()}>{busy ? "Saving" : "Create Lead"}</Button></>}>
      {data && <CustomerPicker customers={data.customers} value={customerId} onChange={(id) => {
        const customer = data.customers.find((entry) => entry.id === id);
        setCustomerId(id); setName(customer?.name ?? ""); setPhone(customer?.phone ?? ""); setEmail(customer?.email ?? "");
      }} allowCreate onCreate={(query) => { setCustomerId(""); setName(query); setPhone(""); setEmail(""); }} />}
      <div className="cc-form-grid" style={{ marginTop: 17 }}>
        <TextInput label="Customer name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
        <TextInput label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(972) 555 0182" inputMode="tel" />
        <TextInput label="Email, optional" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@email.com" type="email" />
        <SelectField label="Source" value={source} onChange={(event) => setSource(event.target.value as Lead["source"])}>{SOURCES.map((value) => <option key={value}>{value}</option>)}</SelectField>
        <TextInput label="Campaign, optional" value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Specific campaign attribution" className="sm:col-span-2" />
        <TextArea label="What they need" value={need} onChange={(event) => setNeed(event.target.value)} placeholder="The work, material, quantity, location, or next missing detail" className="sm:col-span-2" />
      </div>
      <p className="cc-muted" style={{ marginTop: 15, fontSize: 13 }}>Search selects an existing customer immediately. Phone and email are matched again server-side before any identity is created. Source stays simple; campaign holds detailed attribution.</p>
    </Sheet>
  );
}

function NewJobSheet() {
  const { action, setAction, data, refresh } = useControlCenter();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [category, setCategory] = useState<Job["category"]>("MATERIAL_DELIVERY");
  const [date, setDate] = useState(dateKey());
  const [time, setTime] = useState("08:00");
  const [allDay, setAllDay] = useState(false);
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if ((!customerId && (!newName.trim() || !newPhone.trim())) || !date || !address.trim() || !description.trim()) { toast.error("Customer, date, address, and work description are required."); return; }
    setBusy(true);
    try {
      const id = await createJob({ customerId: customerId || undefined, name: newName, phone: newPhone, email: newEmail, category, date, time, allDay, address, description, agreedAmount: Number(amount || 0), notes });
      await refresh(); setAction(null); toast.success("Job scheduled."); navigate(`/admin/jobs/${id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Job could not be saved."); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={action === "job"} onClose={() => setAction(null)} title="New Job" actions={<><Button onClick={() => setAction(null)}>Cancel</Button><Button primary disabled={busy} onClick={() => void save()}>{busy ? "Saving" : "Schedule Job"}</Button></>}>
      {data && <CustomerPicker customers={data.customers} value={customerId} onChange={(id) => { setCustomerId(id); setNewName(""); }} allowCreate onCreate={(query) => { setCustomerId(""); setNewName(query); }} />}
      {!customerId && newName && <div className="cc-form-grid" style={{ marginTop: 15 }}><TextInput label="New customer name" value={newName} onChange={(event) => setNewName(event.target.value)} /><TextInput label="Phone" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} inputMode="tel" /><TextInput label="Email, optional" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} type="email" /></div>}
      <div className="cc-form-grid" style={{ marginTop: 17 }}>
        <SelectField label="Work type" value={category} onChange={(event) => setCategory(event.target.value as Job["category"])}>{["MATERIAL_DELIVERY","DRIVEWAY","DIRT_GRADING","POND","DEMOLITION","OTHER"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</SelectField>
        <TextInput label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Field label="Schedule"><label style={{ display: "flex", alignItems: "center", minHeight: 52, gap: 10 }}><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} /> All day</label></Field>
        {!allDay && <TextInput label="Time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />}
        <TextInput label="Job site" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Where the work happens" />
        <TextInput label="Agreed amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="$0" />
        <TextArea label="Work description" value={description} onChange={(event) => setDescription(event.target.value)} className="sm:col-span-2" />
        <TextArea label="Internal notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="sm:col-span-2" />
      </div>
    </Sheet>
  );
}

function PaymentSheet() {
  const { action, setAction, data, refresh } = useControlCenter();
  const navigate = useNavigate();
  const [invoiceId, setInvoiceId] = useState("");
  const [method, setMethod] = useState<Payment["method"]>("ACH");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const openInvoices = data?.invoices.filter((invoice) => invoice.status === "SENT" || invoice.status === "DRAFT") ?? [];
  const selected = openInvoices.find((invoice) => invoice.id === invoiceId);
  const save = async () => {
    if (!invoiceId) { toast.error("Choose an invoice."); return; }
    setBusy(true);
    try { await recordPayment(invoiceId, method, note); await refresh(); setAction(null); toast.success("Full outstanding balance recorded."); navigate(`/admin/money/invoices/${invoiceId}`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Payment could not be recorded."); }
    finally { setBusy(false); }
  };
  return <Sheet open={action === "payment"} onClose={() => setAction(null)} title="Record Payment" actions={<><Button onClick={() => setAction(null)}>Cancel</Button><Button primary disabled={busy || !invoiceId} onClick={() => void save()}>{busy ? "Recording" : "Record Full Balance"}</Button></>}>
    <div style={{ display: "grid", gap: 16 }}>
      <SelectField label="Invoice" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}><option value="">Choose invoice</option>{openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>#{invoice.invoice_number} · {invoice.description}</option>)}</SelectField>
      {selected && <div className="cc-field-ice" style={{ padding: 18 }}><span className="cc-label" style={{ color: "rgba(14,14,16,.65)" }}>Full outstanding balance</span><strong className="cc-display cc-money" style={{ display: "block", fontSize: 38, marginTop: 5 }}>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(selected.amount)}</strong><p style={{ fontSize: 13 }}>v1 records the full balance. Split payment controls are intentionally not exposed.</p></div>}
      <SelectField label="Method" value={method} onChange={(event) => setMethod(event.target.value as Payment["method"])}>{["ACH","CARD","ZELLE","APPLE_PAY","CHECK","OTHER"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</SelectField>
      <TextArea label="Note, optional" value={note} onChange={(event) => setNote(event.target.value)} />
    </div>
  </Sheet>;
}

function ActionSheets() {
  return <><NewMenu /><NewLeadSheet /><NewJobSheet /><PaymentSheet /></>;
}

function Shell() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
  return (
    <div className="cc">
      <Helmet><title>Control Center · Monkey Trucking</title><meta name="robots" content="noindex, nofollow" /><meta name="googlebot" content="noindex, nofollow" /><meta name="theme-color" content="#0E0E10" /></Helmet>
      <div className="cc-root">
        <SideNav />
        <div className="cc-content">
          <TopBar />
          <main className="cc-main"><div key={pathname} className="cc-page"><Outlet /></div></main>
        </div>
        <MobileNav />
        <ActionSheets />
      </div>
    </div>
  );
}

export default function ControlCenterLayout() {
  const { user, loading } = useAuth();
  const access = useAdminAccess(user?.id);
  if (loading || (!!user && access.isLoading)) {
    return <div className="cc" style={{ minHeight: "100vh" }}><Helmet><meta name="robots" content="noindex, nofollow" /></Helmet></div>;
  }
  if (!user || !access.authorized) return <Navigate to="/" replace />;
  return <ControlCenterProvider><Shell /></ControlCenterProvider>;
}
