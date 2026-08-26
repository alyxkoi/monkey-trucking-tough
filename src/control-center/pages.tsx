import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  MessageSquare,
  Plus,
  Settings2,
  Ticket as TicketIcon,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Button,
  CollectedChart,
  Empty,
  InlineSelect,
  Loading,
  PageHeader,
  Panel,
  SearchField,
  SelectField,
  SetupError,
  Sheet,
  Status,
  TextInput,
  TextArea,
  periodPayments,
} from "./components";
import { useControlCenter } from "./context";
import { confirmWorkerPayment, createWorkerPayment, customerFor, dateKey, dateLabel, invoiceStatus, markWorkerPaymentPaid, money, snoozeAttention, voidFinancialRecord } from "./data";
import { toast } from "sonner";

type Period = "7D" | "MTD" | "LAST";

function Guard({ children }: { children: (data: NonNullable<ReturnType<typeof useControlCenter>["data"]>) => React.ReactNode }) {
  const { data, loading, error } = useControlCenter();
  if (loading) return <Loading />;
  if (error) return <SetupError error={error} />;
  if (!data) return <Loading />;
  return <>{children(data)}</>;
}

const statusTone = (status: string) => {
  if (["PAID", "COMPLETED", "WON", "ACCEPTED"].includes(status)) return "ok" as const;
  if (["OVERDUE", "VOID", "LOST", "CANCELLED"].includes(status)) return "red" as const;
  if (["PENDING", "NEW", "DRAFT"].includes(status)) return "warn" as const;
  return "ice" as const;
};

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function Overview() {
  const { attention, setAction } = useControlCenter();
  const [period, setPeriod] = useState<Period>("MTD");
  return <Guard>{(data) => {
    const payments = periodPayments(data.payments, period);
    const collected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const open = data.invoices.filter((invoice) => ["DRAFT", "SENT"].includes(invoice.status));
    const outstanding = open.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const overdue = open.filter((invoice) => invoiceStatus(invoice) === "OVERDUE");
    const overdueTotal = overdue.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const todayKey = dateKey();
    const todayJobs = data.jobs.filter((job) => job.scheduled_date === todayKey && job.status !== "CANCELLED");
    const openQuotes = data.quotes.filter((quote) => ["DRAFT", "SENT"].includes(quote.status));
    const urgent = attention[0];
    const secondary = attention.slice(1, 5);
    return <>
      <div className="cc-header">
        <div><div className="cc-greeting">{greeting()}, <strong>Salvador</strong></div><h1 className="cc-page-title">Overview</h1><p className="cc-subtitle">What happened, what needs attention, and what to do next.</p></div>
        <Button primary icon={<Plus />} onClick={() => setAction("menu")}>New</Button>
      </div>

      <div className="cc-overview-grid">
        <div style={{ display: "grid", gap: 20 }}>
          {urgent ? <Link to={urgent.to} className="cc-field-red cc-urgent">
            <span className="cc-label">Needs attention · now</span><h3>{urgent.title}</h3><p>{urgent.detail}</p><span className="cc-btn" style={{ marginTop: 16, borderColor: "rgba(14,14,16,.25)", color: "#0e0e10", background: "rgba(255,255,255,.55)" }}>{urgent.action}<ArrowRight size={17} /></span>
          </Link> : <Panel><Empty title="Nothing urgent" detail="No unresolved business issue needs immediate action." /></Panel>}

          <Panel title="Needs attention" right={<Link className="cc-link-btn" to="/admin/attention">View all</Link>}>
            {secondary.length ? <div className="cc-attention-list">{secondary.map((item) => <Link key={item.id} to={item.to} className="cc-attention-row"><div><h3>{item.title}</h3><p>{item.detail}</p></div><Status tone={item.tone}>{item.action}</Status></Link>)}</div> : <Empty title="Queue is clear" detail="Items leave only when the underlying work is resolved." />}
          </Panel>
        </div>

        <section className="cc-today">
          <span className="cc-label">Today</span>
          <div className="cc-date-big">{new Date().getDate()}</div>
          <div className="cc-label" style={{ marginBottom: 13, color: "rgba(14,14,16,.72)" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long" })}</div>
          {todayJobs.length ? todayJobs.map((job) => <Link key={job.id} to={`/admin/jobs/${job.id}`} className="cc-today-row"><span className="cc-today-time">{job.all_day ? "All day" : job.scheduled_time?.slice(0, 5)}</span><span><span className="cc-today-title">{job.description}</span><span style={{ display: "block", marginTop: 3, fontSize: 13, opacity: .7 }}>{customerFor(data, job.customer_id)?.name}</span></span></Link>) : <p style={{ borderTop: "1px solid rgba(14,14,16,.18)", paddingTop: 15 }}>No active work scheduled today.</p>}
        </section>
      </div>

      <section className="cc-glass cc-money-hero">
        <div className="cc-money-head"><span className="cc-section-label" style={{ margin: 0 }}>Money</span><div className="cc-segments">{[["7D","7 Days"],["MTD","MTD"],["LAST","Last Month"]].map(([value,label]) => <button key={value} data-active={period === value} onClick={() => setPeriod(value as Period)}>{label}</button>)}</div></div>
        <div className="cc-collected"><span className="cc-label">Collected</span><strong className="cc-collected-value">{money(collected)}</strong></div>
        <CollectedChart payments={data.payments} period={period} />
        <div className="cc-money-support"><div className="cc-money-stat"><span className="cc-label">Outstanding</span><strong>{money(outstanding)}</strong><span className="cc-muted">{open.length} open invoice{open.length === 1 ? "" : "s"}</span></div><div className="cc-money-stat" style={overdueTotal ? { background: "rgba(255,49,49,.06)" } : undefined}><span className="cc-label" style={overdueTotal ? { color: "var(--cc-red)" } : undefined}>Overdue</span><strong style={overdueTotal ? { color: "var(--cc-red)" } : undefined}>{money(overdueTotal)}</strong><span className="cc-muted">{overdue.length} need follow up</span></div></div>
      </section>

      <Panel title="Pipeline" className="cc-pipeline">
        <div className="cc-pipe-cell"><span className="cc-label">New leads</span><strong className="cc-pipe-number">{data.leads.filter((lead) => lead.status === "NEW").length}</strong><span className="cc-muted">Waiting to be handled</span></div>
        <div className="cc-pipe-cell"><span className="cc-label">Open quotes</span><strong className="cc-pipe-number">{openQuotes.length}</strong><span className="cc-muted">{money(openQuotes.reduce((sum, quote) => sum + Number(quote.grand_total), 0))}</span></div>
        <div className="cc-pipe-cell"><span className="cc-label">Scheduled work</span><strong className="cc-pipe-number">{data.jobs.filter((job) => job.status === "SCHEDULED").length}</strong><span className="cc-muted">Across the active calendar</span></div>
      </Panel>
    </>;
  }}</Guard>;
}

export function NeedsAttention() {
  const { attention, refresh } = useControlCenter();
  const { user } = useAuth();
  const remindLater = async (fingerprint: string) => {
    if (!user?.id) return;
    const next = new Date();
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
    await snoozeAttention(user.id, fingerprint, next.toISOString());
    await refresh();
    toast.success(`Coming back ${next.toLocaleDateString("en-US", { weekday: "long" })} at 7:00 AM.`);
  };
  return <Guard>{() => <><PageHeader eyebrow="Overview" title="Needs Attention" subtitle="Derived from real records. Resolve the work, or snooze it until the next working day." />
    <Panel>{attention.length ? attention.map((item, index) => <div key={item.id} className="cc-attention-row" style={index === 0 ? { background: "var(--cc-red)", color: "#0e0e10" } : undefined}><Link to={item.to}><h3>{item.title}</h3><p style={index === 0 ? { color: "rgba(14,14,16,.7)" } : undefined}>{item.detail}</p></Link><div className="cc-toolbar"><Link className="cc-btn cc-btn-compact" to={item.to}>{item.action}</Link><Button compact onClick={() => void remindLater(item.id)}>Remind Later</Button></div></div>) : <Empty title="Nothing needs attention" detail="The queue will populate from unresolved records." />}</Panel>
  </>}</Guard>;
}

export function LeadsQuotes() {
  const { setAction } = useControlCenter();
  const [tab, setTab] = useState<"leads" | "quotes">("leads");
  const [search, setSearch] = useState("");
  return <Guard>{(data) => {
    const q = search.toLowerCase();
    const leads = data.leads.filter((lead) => {
      const customer = customerFor(data, lead.customer_id);
      return [customer?.name, customer?.phone, lead.need, lead.source].join(" ").toLowerCase().includes(q);
    });
    const quotes = data.quotes.filter((quote) => {
      const customer = customerFor(data, quote.customer_id);
      return [customer?.name, quote.quote_number, quote.description].join(" ").toLowerCase().includes(q);
    });
    return <><PageHeader title="Leads & Quotes" subtitle="Every opportunity and every price that went out the door." right={<Button primary icon={<Plus />} onClick={() => setAction("lead")}>New Lead</Button>} />
      <div className="cc-toolbar"><div className="cc-segments"><button data-active={tab === "leads"} onClick={() => setTab("leads")}>Leads</button><button data-active={tab === "quotes"} onClick={() => setTab("quotes")}>Quotes</button></div><SearchField value={search} onChange={setSearch} placeholder={`Search ${tab}`} /></div>
      <Panel className="cc-record-list" title={tab === "leads" ? `${leads.length} leads` : `${quotes.length} quotes`}>
        {tab === "leads" ? leads.map((lead) => { const customer = customerFor(data, lead.customer_id); return <Link key={lead.id} to={`/admin/leads/${lead.id}`} className="cc-record-row"><div><div className="cc-record-name">{customer?.name}</div><div className="cc-record-meta">{lead.need}</div></div><div className="cc-record-meta">{lead.source}{lead.campaign ? ` · ${lead.campaign}` : ""}</div><div className="cc-record-meta">{dateLabel(lead.updated_at)}</div><Status tone={statusTone(lead.status)}>{lead.status}</Status></Link>; }) : quotes.map((quote) => { const customer = customerFor(data, quote.customer_id); return <Link key={quote.id} to={`/admin/quotes/${quote.id}`} className="cc-record-row"><div><div className="cc-record-name">{customer?.name}</div><div className="cc-record-meta">{quote.quote_number} · {quote.description}</div></div><div className="cc-record-meta">{dateLabel(quote.updated_at)}</div><strong className="cc-money">{money(quote.grand_total)}</strong><Status tone={statusTone(quote.status)}>{quote.status}</Status></Link>; })}
        {(tab === "leads" ? leads : quotes).length === 0 && <Empty title={`No ${tab} found`} detail={search ? "Try a different search." : `Create the first ${tab === "leads" ? "lead" : "quote"} when the work arrives.`} />}
      </Panel>
    </>;
  }}</Guard>;
}

export function Customers() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  return <Guard>{(data) => {
    const q = search.toLowerCase().trim();
    const customers = data.customers.filter((customer) => [customer.name, customer.phone, customer.email].join(" ").toLowerCase().includes(q)).sort((a, b) => {
      if (sort === "az") return a.name.localeCompare(b.name);
      if (sort === "za") return b.name.localeCompare(a.name);
      const delta = new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
      return sort === "oldest" ? -delta : delta;
    });
    return <><PageHeader title="Customers" subtitle="One identity for every customer, with every opportunity and record behind it." />
      <div className="cc-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Search name, phone, or email" /><InlineSelect label="Sort customers" value={sort} onChange={setSort} options={[{ value: "recent", label: "Most recent" },{ value: "oldest", label: "Oldest" },{ value: "az", label: "A to Z" },{ value: "za", label: "Z to A" }]} /></div>
      <Panel className="cc-record-list" title={`${customers.length} customers`}>{customers.map((customer) => {
        const opportunityCount = data.leads.filter((lead) => lead.customer_id === customer.id).length + data.quotes.filter((quote) => quote.customer_id === customer.id).length;
        const jobCount = data.jobs.filter((job) => job.customer_id === customer.id).length;
        return <Link key={customer.id} to={`/admin/customers/${customer.id}`} className="cc-record-row"><div><div className="cc-record-name">{customer.name}</div><div className="cc-record-meta">{customer.phone || customer.email || "No contact detail"}</div></div><div className="cc-record-meta">{opportunityCount} opportunities</div><div className="cc-record-meta">{jobCount} jobs</div><span className="cc-record-meta">{dateLabel(customer.last_activity_at)}</span></Link>;
      })}{customers.length === 0 && <Empty title="No customers found" detail={search ? "Try another name, phone, or email." : "Customer identities are created through real work flows."} />}</Panel>
    </>;
  }}</Guard>;
}

function monthDays(cursor: Date) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const first = new Date(start); first.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => { const day = new Date(first); day.setDate(first.getDate() + index); return day; });
}

export function Jobs() {
  const { setAction } = useControlCenter();
  const [cursor, setCursor] = useState(new Date());
  const [showCancelled, setShowCancelled] = useState(false);
  return <Guard>{(data) => {
    const days = monthDays(cursor);
    const unscheduled = data.quotes.filter((quote) => quote.status === "ACCEPTED" && !data.jobs.some((job) => job.quote_id === quote.id));
    const cancelled = data.jobs.filter((job)=>job.status === "CANCELLED");
    return <><PageHeader title="Jobs" subtitle="Calendar first. Cancelled work stays in history and off the active schedule." right={<div className="cc-toolbar"><Button compact onClick={()=>setShowCancelled((current)=>!current)}>{showCancelled?"Hide":"Show"} Cancelled</Button><Button primary icon={<Plus />} onClick={() => setAction("job")}>New Job</Button></div>} />
      {unscheduled.length > 0 && <Panel><div className="cc-waiting-head"><span className="cc-label" style={{ color: "rgba(14,14,16,.68)" }}>Waiting on a date</span><strong className="cc-display" style={{ display: "block", fontSize: 30, marginTop: 5 }}>Accepted work needs scheduling</strong></div>{unscheduled.map((quote) => <Link key={quote.id} to={`/admin/quotes/${quote.id}`} className="cc-attention-row"><div><h3>{customerFor(data, quote.customer_id)?.name}</h3><p>{quote.quote_number} · {quote.description}</p></div><Button compact primary>Schedule</Button></Link>)}</Panel>}
      <Panel title={cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })} right={<div className="cc-toolbar"><Button compact onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Previous</Button><Button compact onClick={() => setCursor(new Date())}>Today</Button><Button compact onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</Button></div>}>
        <div className="cc-calendar">{days.map((day) => {
          const key = dateKey(day);
          const jobs = data.jobs.filter((job) => job.scheduled_date === key && job.status !== "CANCELLED");
          const today = key === dateKey();
          return <div key={key} className="cc-calendar-day" data-today={today}><div className="cc-calendar-num">{day.getDate()}</div>{jobs.map((job) => <Link key={job.id} to={`/admin/jobs/${job.id}`} className="cc-job-chip"><strong>{job.all_day ? "ALL DAY" : job.scheduled_time?.slice(0,5)}</strong><span style={{ display: "block", marginTop: 2 }}>{job.description}</span><Status tone={job.status === "COMPLETED" ? "ok" : statusTone(job.status)}>{job.status}</Status></Link>)}</div>;
        })}</div>
      </Panel>
      {showCancelled&&<Panel title={`Cancelled history · ${cancelled.length}`}>{cancelled.length?cancelled.map((job)=><Link key={job.id} to={`/admin/jobs/${job.id}`} className="cc-attention-row"><div><h3>{customerFor(data,job.customer_id)?.name} · {job.description}</h3><p>{job.cancellation_reason} · was scheduled {dateLabel(job.scheduled_date)}</p></div><Status tone="red">Cancelled</Status></Link>):<Empty title="No cancelled jobs" detail="Cancelled work remains preserved here when it exists." />}</Panel>}
    </>;
  }}</Guard>;
}

export function Tickets() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  return <Guard>{(data) => {
    const q = search.toLowerCase();
    const tickets = data.tickets.filter((ticket) => [ticket.ticket_number, ticket.customer_name, ticket.customer_phone, ticket.job_site_address].join(" ").toLowerCase().includes(q));
    return <><PageHeader title="Tickets" subtitle="Proof of material and delivery, with historical pricing kept exactly as charged." right={<Button primary icon={<Plus />} onClick={() => navigate("/admin/tickets/new")}>New Ticket</Button>} />
      <SearchField value={search} onChange={setSearch} placeholder="Search customer, ticket number, or job site" />
      <Panel className="cc-record-list" title={`${tickets.length} tickets`}>{tickets.map((ticket) => <Link key={ticket.id} to={`/admin/tickets/${ticket.id}`} className="cc-record-row"><div><div className="cc-record-name">{ticket.customer_name || "Unnamed customer"}</div><div className="cc-record-meta">{ticket.ticket_number} · {ticket.job_site_address}</div></div><div className="cc-record-meta">{dateLabel(ticket.created_at)}</div><strong className="cc-money">{money(ticket.grand_total)}</strong><Status tone={ticket.status === "void" ? "red" : "ice"}>{ticket.status === "void" ? "Void" : "Finalized"}</Status></Link>)}{tickets.length === 0 && <Empty title="No tickets found" detail={search ? "Try a different search." : "Create the first delivery Ticket."} />}</Panel>
    </>;
  }}</Guard>;
}

export function Money() {
  const { setAction, refresh } = useControlCenter();
  const [tab, setTab] = useState<"invoices" | "payments" | "worker">("invoices");
  const [workerOpen, setWorkerOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ type: "PAYMENT" | "WORKER_PAYMENT"; id: string; label: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  return <Guard>{(data) => {
    const collected = data.payments.filter((payment) => !payment.voided_at).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const open = data.invoices.filter((invoice) => ["DRAFT","SENT"].includes(invoice.status));
    const overdue = open.filter((invoice) => invoiceStatus(invoice) === "OVERDUE");
    const workerPaid = data.workerPayments.filter((payment) => payment.status === "PAID" && !payment.voided_at).reduce((sum, payment) => sum + Number(payment.amount), 0);
    return <><PageHeader title="Money" subtitle="Who owes us, what came in, and what workers were actually paid. This is not bookkeeping." right={<Button primary icon={<Banknote />} onClick={() => setAction("payment")}>Record Payment</Button>} />
      <div className="cc-money-grid"><div className="cc-field-ice cc-number-card"><span className="cc-label" style={{ color: "rgba(14,14,16,.65)" }}>Collected</span><strong>{money(collected)}</strong><span>Confirmed payments</span></div><div className="cc-surface cc-number-card"><span className="cc-label">Outstanding</span><strong>{money(open.reduce((sum, invoice) => sum + Number(invoice.amount), 0))}</strong><span className="cc-muted">{open.length} open invoices</span></div><div className="cc-warm-surface cc-number-card"><span className="cc-label cc-red">Overdue</span><strong className="cc-red">{money(overdue.reduce((sum, invoice) => sum + Number(invoice.amount), 0))}</strong><span className="cc-muted">{overdue.length} need attention</span></div></div>
      <div className="cc-segments" style={{ width: "fit-content" }}><button data-active={tab === "invoices"} onClick={() => setTab("invoices")}>Invoices</button><button data-active={tab === "payments"} onClick={() => setTab("payments")}>Payments</button><button data-active={tab === "worker"} onClick={() => setTab("worker")}>Worker Pay</button></div>
      <Panel className="cc-record-list" title={tab === "invoices" ? "Invoices" : tab === "payments" ? "Payments received" : `Worker pay · ${money(workerPaid)} actually paid`} right={tab === "worker" ? <Button compact icon={<Plus />} onClick={() => setWorkerOpen(true)}>Hourly Entry</Button> : undefined}>
        {tab === "invoices" && data.invoices.map((invoice) => { const status = invoiceStatus(invoice); return <Link key={invoice.id} to={`/admin/money/invoices/${invoice.id}`} className="cc-record-row"><div><div className="cc-record-name">{customerFor(data, invoice.customer_id)?.name}</div><div className="cc-record-meta">Invoice {invoice.invoice_number} · {invoice.description}</div></div><div className="cc-record-meta">{invoice.due_at ? `Due ${dateLabel(invoice.due_at)}` : "Draft"}</div><strong className="cc-money">{money(invoice.amount)}</strong><Status tone={statusTone(status)}>{status}</Status></Link>; })}
        {tab === "payments" && data.payments.map((payment) => <div key={payment.id} className="cc-record-row"><div><div className="cc-record-name">{customerFor(data, payment.customer_id)?.name}</div><div className="cc-record-meta">{payment.method.replace("_", " ")} · {payment.confirmed_by.toLowerCase()} confirmed</div></div><div className="cc-record-meta">{dateLabel(payment.received_at)}</div><strong className="cc-money">{money(payment.amount)}</strong><div className="cc-toolbar"><Status tone={payment.voided_at ? "red" : "ok"}>{payment.voided_at ? "Void" : "Received"}</Status>{!payment.voided_at && <Button compact onClick={() => { setVoidReason(""); setVoidTarget({ type: "PAYMENT", id: payment.id, label: `${money(payment.amount)} payment` }); }}>Void</Button>}</div></div>)}
        {tab === "worker" && data.workerPayments.map((payment) => <div key={payment.id} className="cc-record-row"><div><div className="cc-record-name">{data.workers.find((worker) => worker.id === payment.worker_id)?.name ?? "Worker"}</div><div className="cc-record-meta">{payment.period_start} to {payment.period_end} · {payment.source.replace("_", " ")}</div></div><div className="cc-record-meta">{payment.paid_at ? dateLabel(payment.paid_at) : "Not paid"}</div><strong className="cc-money">{money(payment.amount)}</strong><div className="cc-toolbar"><Status tone={statusTone(payment.status)}>{payment.status}</Status>{payment.status === "PENDING" && <Button compact onClick={async () => { await confirmWorkerPayment(payment.id); await refresh(); toast.success("Details confirmed. This is still not paid."); }}>Confirm</Button>}{["PENDING","CONFIRMED"].includes(payment.status) && <Button compact primary onClick={async () => { await markWorkerPaymentPaid(payment.id); await refresh(); toast.success("Worker payment marked paid."); }}>Mark Paid</Button>}{payment.status !== "VOID" && <Button compact onClick={() => { setVoidReason(""); setVoidTarget({ type: "WORKER_PAYMENT", id: payment.id, label: `${money(payment.amount)} worker payment` }); }}>Void</Button>}</div></div>)}
        {(tab === "invoices" ? data.invoices : tab === "payments" ? data.payments : data.workerPayments).length === 0 && <Empty title={`No ${tab === "worker" ? "worker pay" : tab}`} detail="Records will appear when the real flow creates them." />}
      </Panel>
      <WorkerPaySheet open={workerOpen} onClose={() => setWorkerOpen(false)} />
      <Sheet open={Boolean(voidTarget)} onClose={() => setVoidTarget(null)} title={`Void ${voidTarget?.label ?? "record"}`} actions={<><Button onClick={() => setVoidTarget(null)}>Keep Record</Button><Button red disabled={!voidReason.trim()} onClick={async () => { if (!voidTarget) return; await voidFinancialRecord(voidTarget.type, voidTarget.id, voidReason.trim()); await refresh(); setVoidTarget(null); toast.success("Record voided with history."); }}>Void with History</Button></>}><TextArea label="Reason" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Required. The record stays preserved with who changed it and when." /></Sheet>
    </>;
  }}</Guard>;
}

function WorkerPaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, refresh } = useControlCenter();
  const [workerId, setWorkerId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = Number(hours || 0) * Number(rate || 0);
  const selectWorker = (id: string) => {
    setWorkerId(id);
    const worker = data?.workers.find((entry) => entry.id === id);
    setRate(worker?.hourly_rate == null ? "" : String(worker.hourly_rate));
  };
  const save = async () => {
    if (!workerId || !start || !end || amount <= 0) { toast.error("Worker, pay period, hours, and rate are required."); return; }
    setBusy(true);
    try {
      await createWorkerPayment({ workerId, periodStart: start, periodEnd: end, hours: Number(hours), rate: Number(rate), amount, source: "MANUAL" });
      await refresh(); onClose(); toast.success("Pending worker pay created. It does not count until Salvador marks it paid.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Worker pay could not be saved."); }
    finally { setBusy(false); }
  };
  return <Sheet open={open} onClose={onClose} title="Hourly Worker Pay" actions={<><Button onClick={onClose}>Cancel</Button><Button primary disabled={busy} onClick={() => void save()}>{busy ? "Saving" : "Create Pending Pay"}</Button></>}><div style={{ display:"grid",gap:16 }}><SelectField label="Worker" value={workerId} onChange={(event)=>selectWorker(event.target.value)}><option value="">Choose worker</option>{data?.workers.filter((worker)=>worker.is_active).map((worker)=><option key={worker.id} value={worker.id}>{worker.name}</option>)}</SelectField><div className="cc-form-grid"><TextInput label="Period start" type="date" value={start} onChange={(event)=>setStart(event.target.value)}/><TextInput label="Period end" type="date" value={end} onChange={(event)=>setEnd(event.target.value)}/><TextInput label="Hours" type="number" step=".25" value={hours} onChange={(event)=>setHours(event.target.value)}/><TextInput label="Rate" inputMode="decimal" value={rate} onChange={(event)=>setRate(event.target.value)}/></div><div className="cc-field-ice" style={{padding:17}}><span className="cc-label" style={{color:"rgba(14,14,16,.62)"}}>Calculated pending amount</span><strong className="cc-display cc-money" style={{display:"block",fontSize:38}}>{money(amount)}</strong></div><p className="cc-muted" style={{fontSize:13}}>Driver invoice AI extraction stays setup-required until an AI provider and attachment workflow are connected. Confirmation only confirms extracted details; it never means paid.</p></div></Sheet>;
}

const SETTINGS = [
  { key: "business", title: "Business", description: "Contact details, tax, due dates, and accepted payment methods.", icon: Settings2 },
  { key: "materials", title: "Materials & Delivery", description: "The same pricing source used by Quotes and Tickets.", icon: TicketIcon },
  { key: "workers", title: "Workers", description: "Worker records and pay setup. Workers do not log in.", icon: Users },
  { key: "communication", title: "Communication & AI", description: "Business number, SMS, calling, AI, and human takeover.", icon: MessageSquare },
  { key: "tracking", title: "Tracking Links", description: "Simple sources with campaign-specific attribution.", icon: FileText },
  { key: "users", title: "Users & Access", description: "Admin and staff roles from the existing user_roles table.", icon: UserRound },
  { key: "printing", title: "Printing & System", description: "4x6 label path, copies, queue, and system readiness.", icon: Wrench },
] as const;

export function SettingsHome() {
  return <Guard>{(data) => {
    const blockers = [
      data.controlSettings?.custom_work_tax_rule === "PENDING" && "Custom work tax treatment",
      !data.appSettings?.company_phone && "Business phone",
      data.controlSettings?.printable_logo_status !== "READY" && "Printable logo",
      data.controlSettings?.sms_status !== "READY" && "Business number for SMS and calling",
      "Final printer path",
    ].filter(Boolean);
    return <><PageHeader title="Settings" subtitle="Dedicated controls for the business, system, communication, and historical safety rules." />
      {blockers.length > 0 && <Panel title={`${blockers.length} prelaunch items`} className="cc-warm-surface"><div className="cc-panel-body"><p className="cc-muted">Internal setup items only. This language never appears on a customer quote or invoice.</p><div className="cc-toolbar" style={{ marginTop: 13 }}>{blockers.map((blocker) => <Status key={String(blocker)} tone="warn">{blocker}</Status>)}</div></div></Panel>}
      <div className="cc-settings-grid">{SETTINGS.map((item) => <Link key={item.key} to={`/admin/settings/${item.key}`} className="cc-surface cc-settings-link"><item.icon size={25} /><div><h3>{item.title}</h3><p className="cc-muted" style={{ marginTop: 7, fontSize: 14, lineHeight: 1.4 }}>{item.description}</p></div><ChevronRight size={18} /></Link>)}</div>
    </>;
  }}</Guard>;
}
