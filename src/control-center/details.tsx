import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Banknote,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Ticket as TicketIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Button,
  Empty,
  Field,
  Loading,
  PageHeader,
  Panel,
  SelectField,
  SetupError,
  Sheet,
  Status,
  TextArea,
  TextInput,
} from "./components";
import { useControlCenter } from "./context";
import {
  controlDb,
  createInvoiceFromJob,
  createJob,
  createTrackingLink,
  createWorker,
  customerFor,
  dateKey,
  dateLabel,
  invoiceStatus,
  money,
  recordPayment,
  saveControlSettings,
  saveQuote,
  updateInvoice,
  updateJob,
  updateLead,
  updateQuote,
  type Job,
  type Payment,
  type QuoteDraft,
  type TrackingLink,
  type Worker,
} from "./data";

function useDataGuard() {
  const control = useControlCenter();
  return control;
}

function Missing({ area, back }: { area: string; back: string }) {
  return <Panel><Empty title={`${area} not found`} detail="The record may not exist, or access is no longer available." action={<Link className="cc-btn" to={back}>Back</Link>} /></Panel>;
}

export function LeadDetail() {
  const { leadId = "" } = useParams();
  const { data, loading, error, refresh } = useDataGuard();
  const navigate = useNavigate();
  const [quoteOpen, setQuoteOpen] = useState(false);
  if (loading) return <Loading />;
  if (error) return <SetupError error={error} />;
  if (!data) return <Loading />;
  const lead = data.leads.find((entry) => entry.id === leadId);
  if (!lead) return <Missing area="Lead" back="/admin/leads" />;
  const customer = customerFor(data, lead.customer_id);
  const quotes = data.quotes.filter((quote) => quote.lead_id === lead.id);
  const messages = data.messages.filter((message) => message.lead_id === lead.id);
  return <>
    <PageHeader eyebrow={`Lead · ${lead.source}`} title={customer?.name ?? "Lead"} subtitle={[customer?.phone, customer?.email].filter(Boolean).join(" · ")} backTo="/admin/leads" right={<Status tone={lead.status === "WON" ? "ok" : lead.status === "LOST" ? "red" : "ice"}>{lead.status}</Status>} />
    <section className="cc-field-ice" style={{ padding: "24px 26px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 22, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px" }}><span className="cc-label" style={{ color: "rgba(14,14,16,.62)" }}>What they need</span><h2 style={{ marginTop: 8, fontSize: 24, fontWeight: 700, lineHeight: 1.18 }}>{lead.need}</h2>{lead.campaign && <p style={{ marginTop: 9, opacity: .7 }}>Campaign · {lead.campaign}</p>}</div>
        <Button style={{ borderColor: "rgba(14,14,16,.24)", background: "rgba(255,255,255,.55)", color: "#0e0e10" }} icon={<CalendarPlus />} onClick={() => quotes[0] ? navigate(`/admin/quotes/${quotes[0].id}`) : setQuoteOpen(true)}>{quotes[0] ? "Open Quote" : "Create Quote"}</Button>
      </div>
    </section>
    <div className="cc-detail-grid">
      <Panel title="Conversation" className="cc-conversation">
        <div className="cc-messages">{messages.length ? messages.map((message) => <div key={message.id} className="cc-bubble" data-sender={message.sender_type}><span>{message.body}</span><span className="cc-message-time">{message.sender_type} · {new Date(message.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>) : <Empty title="No conversation yet" detail="SMS and AI are setup-required. Nothing is shown as sent until a provider confirms it." />}</div>
        <div className="cc-composer"><input className="cc-input" disabled placeholder="Connect the business number to reply here" /><Button disabled icon={<Send />}>Setup required</Button></div>
      </Panel>
      <div style={{ display: "grid", alignContent: "start", gap: 20 }}>
        <Panel title="Contact"><div className="cc-panel-body"><div className="cc-toolbar">{customer?.phone && <a className="cc-btn cc-btn-primary" href={`tel:${customer.phone}`}><Phone size={18} /> Call</a>}{customer?.phone && <a className="cc-btn" href={`sms:${customer.phone}`}><MessageSquare size={18} /> Text</a>}</div><div className="cc-facts" style={{ marginTop: 20 }}><div className="cc-fact"><span>Source</span><strong>{lead.source}</strong></div><div className="cc-fact"><span>Created</span><strong>{dateLabel(lead.created_at)}</strong></div><div className="cc-fact"><span>AI state</span><strong>{lead.human_takeover ? "Human takeover" : "Setup required"}</strong></div><div className="cc-fact"><span>Customer</span><strong>{customer?.name}</strong></div></div></div></Panel>
        <Panel title="Next"><div className="cc-panel-body"><div className="cc-toolbar"><Button primary onClick={() => setQuoteOpen(true)}>Create Quote</Button>{lead.status !== "LOST" && <Button onClick={async () => { await updateLead(lead.id, { status: "LOST", lost_reason: "Closed by Salvador" }); await refresh(); }}>Close Lead</Button>}</div></div></Panel>
      </div>
    </div>
    <QuoteBuilder open={quoteOpen} onClose={() => setQuoteOpen(false)} customerId={lead.customer_id} leadId={lead.id} />
  </>;
}

function QuoteBuilder({ open, onClose, customerId, leadId }: { open: boolean; onClose: () => void; customerId: string; leadId?: string }) {
  const { data, refresh } = useControlCenter();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [materialLines, setMaterialLines] = useState(() => [{ id: crypto.randomUUID(), materialId: "", loads: "1", fullLoad: true, yards: "20" }]);
  const [customLines, setCustomLines] = useState(() => [{ id: crypto.randomUUID(), description: "", amount: "" }]);
  const [delivery, setDelivery] = useState("");
  const [deliveryLoads, setDeliveryLoads] = useState("1");
  const [deliveryLoadsTouched, setDeliveryLoadsTouched] = useState(false);
  const [miles, setMiles] = useState("");
  const [busy, setBusy] = useState(false);
  const pricedMaterialLines = materialLines.flatMap((line) => {
    const material = data?.materials.find((entry) => entry.id === line.materialId);
    if (!material) return [];
    const loads = Math.max(1, Number(line.loads || 1));
    const yards = Math.max(0, Number(line.yards || 0));
    const lineTotal = line.fullLoad ? Number(material.full_load_price) * loads : Number(material.price_per_yard) * yards;
    return [{ ...line, material, loads, yards, lineTotal }];
  });
  const pricedCustomLines = customLines.flatMap((line) => {
    const amount = Math.max(0, Number(line.amount || 0));
    return amount > 0 ? [{ ...line, amount }] : [];
  });
  const suggestedDeliveryLoads = Math.max(1, pricedMaterialLines.reduce((sum, line) => sum + line.loads, 0));
  useEffect(() => {
    if (!deliveryLoadsTouched) setDeliveryLoads(String(suggestedDeliveryLoads));
  }, [deliveryLoadsTouched, suggestedDeliveryLoads]);
  if (!data) return null;
  const materialTotal = pricedMaterialLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const settings = data.appSettings;
  let deliveryFee = 0;
  if (delivery === "tier1") deliveryFee = Number(settings?.delivery_tier_1_fee ?? 0);
  if (delivery === "tier2") deliveryFee = Number(settings?.delivery_tier_2_fee ?? 0);
  if (delivery === "tier3") deliveryFee = Number(settings?.delivery_tier_3_fee ?? 0);
  if (delivery === "over") deliveryFee = Number(settings?.delivery_overage_base_fee ?? 0) + Math.max(0, Number(miles || 0) - Number(settings?.delivery_tier_3_max_miles ?? 10)) * Number(settings?.delivery_overage_per_mile ?? 0);
  const deliveryTotal = deliveryFee * Math.max(1, Number(deliveryLoads || 1));
  const custom = pricedCustomLines.reduce((sum, line) => sum + line.amount, 0);
  const taxRate = Number(settings?.tax_rate ?? 0) > 1 ? Number(settings?.tax_rate ?? 0) / 100 : Number(settings?.tax_rate ?? 0);
  const taxable = materialTotal + (settings?.tax_applies_to_delivery ? deliveryTotal : 0) + (data.controlSettings?.custom_work_tax_rule === "TAXED" ? custom : 0);
  const tax = Math.round(taxable * taxRate * 100) / 100;
  const total = materialTotal + deliveryTotal + custom + tax;
  const save = async () => {
    if ((!pricedMaterialLines.length && !pricedCustomLines.length) || !delivery || !address.trim()) { toast.error("Add material or custom work, a job site, and choose delivery explicitly."); return; }
    const items: QuoteDraft["items"] = [];
    for (const line of pricedMaterialLines) items.push({ kind: "MATERIAL", materialId: line.material.id, description: line.material.name, loads: line.loads, yards: line.fullLoad ? Number(line.material.full_load_yards) * line.loads : line.yards, isFullLoad: line.fullLoad, rateUsed: line.fullLoad ? Number(line.material.full_load_price) : Number(line.material.price_per_yard), lineTotal: line.lineTotal });
    for (const line of pricedCustomLines) items.push({ kind: "CUSTOM_WORK", description: line.description || "Custom work", isFullLoad: false, rateUsed: line.amount, lineTotal: line.amount });
    setBusy(true);
    try {
      const rows = await saveQuote({ customerId, leadId, description: description || items.map((item) => item.description).join(" + "), address: address.trim(), deliveryType: delivery, deliveryMiles: Number(miles || 0), deliveryFeePerLoad: deliveryFee, deliveryLoadCount: Number(deliveryLoads), deliveryTotal, materialsSubtotal: materialTotal, customWorkSubtotal: custom, taxRate, taxOnDelivery: Boolean(settings?.tax_applies_to_delivery), customWorkTaxRule: data.controlSettings?.custom_work_tax_rule ?? "PENDING", taxAmount: tax, grandTotal: total, items });
      await refresh(); onClose(); toast.success(`Quote ${rows[0]?.quote_number} created.`); navigate(`/admin/quotes/${rows[0]?.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Quote could not be saved."); }
    finally { setBusy(false); }
  };
  return <Sheet open={open} onClose={onClose} title="New Quote" actions={<><Button onClick={onClose}>Cancel</Button><Button primary disabled={busy} onClick={() => void save()}>{busy ? "Saving" : `Save ${money(total)}`}</Button></>}>
    <div style={{ display: "grid", gap: 17 }}><TextInput label="Description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this quote covers" /><TextInput label="Job site address" value={address} onChange={(event)=>setAddress(event.target.value)} placeholder="Where the work happens" />
      <div><div className="cc-toolbar" style={{ marginBottom: 10 }}><span className="cc-section-label" style={{ margin: 0 }}>Material</span><Button compact icon={<Plus />} onClick={() => setMaterialLines((current) => [...current, { id: crypto.randomUUID(), materialId: "", loads: "1", fullLoad: true, yards: "20" }])}>Add Material</Button></div>{materialLines.map((line, index) => <div key={line.id} className="cc-form-band" style={{ marginBottom: 10 }}><div className="cc-form-band-head"><strong>Material {index + 1}</strong>{materialLines.length > 1 && <button type="button" className="cc-icon-btn" aria-label={`Remove material ${index + 1}`} onClick={() => setMaterialLines((current) => current.filter((entry) => entry.id !== line.id))}>×</button>}</div><div className="cc-form-grid"><SelectField label="Material" value={line.materialId} onChange={(event) => setMaterialLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, materialId: event.target.value } : entry))}><option value="">Choose material</option>{data.materials.filter((entry) => entry.is_active).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</SelectField><TextInput label="Material loads" type="number" min="1" value={line.loads} onChange={(event) => setMaterialLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, loads: event.target.value } : entry))} /><Field label="Pricing"><label style={{ minHeight: 52, display: "flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={line.fullLoad} onChange={(event) => setMaterialLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, fullLoad: event.target.checked } : entry))} /> Full load rate</label></Field>{!line.fullLoad && <TextInput label="Yards" type="number" min="0.01" step="0.01" value={line.yards} onChange={(event) => setMaterialLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, yards: event.target.value } : entry))} />}</div></div>)}</div>
      <div><div className="cc-toolbar" style={{ marginBottom: 10 }}><span className="cc-section-label" style={{ margin: 0 }}>Custom Work</span><Button compact icon={<Plus />} onClick={() => setCustomLines((current) => [...current, { id: crypto.randomUUID(), description: "", amount: "" }])}>Add Custom Work</Button></div>{customLines.map((line, index) => <div className="cc-form-grid" key={line.id} style={{ marginBottom: 10 }}><TextInput label={`Custom work ${index + 1}`} value={line.description} onChange={(event) => setCustomLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, description: event.target.value } : entry))} /><TextInput label="Custom amount" inputMode="decimal" value={line.amount} onChange={(event) => setCustomLines((current) => current.map((entry) => entry.id === line.id ? { ...entry, amount: event.target.value } : entry))} />{customLines.length > 1 && <Button compact onClick={() => setCustomLines((current) => current.filter((entry) => entry.id !== line.id))}>Remove</Button>}</div>)}</div>
      <div className="cc-form-grid"><SelectField label="Delivery" value={delivery} onChange={(event) => setDelivery(event.target.value)}><option value="">Choose delivery</option><option value="pickup">Customer pickup</option><option value="tier1">0 to {settings?.delivery_tier_1_max_miles} miles</option><option value="tier2">{Number(settings?.delivery_tier_1_max_miles)+1} to {settings?.delivery_tier_2_max_miles} miles</option><option value="tier3">{Number(settings?.delivery_tier_2_max_miles)+1} to {settings?.delivery_tier_3_max_miles} miles</option><option value="over">Over {settings?.delivery_tier_3_max_miles} miles</option></SelectField><TextInput label="Delivery loads" type="number" min="1" value={deliveryLoads} onChange={(event) => { setDeliveryLoads(event.target.value); setDeliveryLoadsTouched(true); }} />{delivery === "over" && <TextInput label="Total miles" type="number" value={miles} onChange={(event) => setMiles(event.target.value)} />}</div>
      <p className="cc-muted" style={{ fontSize: 13 }}>Delivery loads begin at the sum of material loads, then remain independently editable for the actual physical deliveries.</p>
      <div className="cc-field-ice" style={{ padding: 18 }}><span className="cc-label" style={{ color: "rgba(14,14,16,.62)" }}>Quote total</span><strong className="cc-display cc-money" style={{ display: "block", fontSize: 42, marginTop: 7 }}>{money(total)}</strong></div>
    </div>
  </Sheet>;
}

export function QuoteDetail() {
  const { quoteId = "" } = useParams();
  const { data, loading, error, refresh } = useControlCenter();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  if (loading) return <Loading />;
  if (error) return <SetupError error={error} />;
  if (!data) return <Loading />;
  const quote = data.quotes.find((entry) => entry.id === quoteId);
  if (!quote) return <Missing area="Quote" back="/admin/leads" />;
  const customer = customerFor(data, quote.customer_id);
  const items = data.quoteItems.filter((item) => item.quote_id === quote.id);
  const job = data.jobs.find((entry) => entry.quote_id === quote.id);
  return <><PageHeader eyebrow={`Quote ${quote.quote_number}`} title={customer?.name ?? "Quote"} subtitle={quote.description} backTo="/admin/leads" right={<Status tone={quote.status === "ACCEPTED" ? "ok" : quote.status === "VOID" ? "red" : "ice"}>{quote.status}</Status>} />
    <div className="cc-detail-grid"><div style={{ display: "grid", gap: 20 }}><section className="cc-field-platinum"><div style={{ padding: 25, display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}><div><span className="cc-label" style={{ color: "rgba(14,14,16,.62)" }}>Quote</span><strong className="cc-display" style={{ display: "block", fontSize: 52 }}>{quote.quote_number}</strong></div><div style={{ textAlign: "right" }}><span className="cc-label" style={{ color: "rgba(14,14,16,.62)" }}>Total</span><strong className="cc-display cc-money" style={{ display: "block", fontSize: 48 }}>{money(quote.grand_total)}</strong></div></div></section>
      <Panel title="Price"><div className="cc-panel-body"><p style={{fontWeight:700,marginBottom:14}}>{quote.address || "No job site on file"}</p>{items.map((item) => <div key={item.id} className="cc-material-line"><div className="cc-load-block">{item.loads ?? "•"}</div><div><strong>{item.description}</strong><div className="cc-muted" style={{ marginTop: 4, fontSize: 13 }}>{item.kind === "MATERIAL" ? `${item.yards} yd · ${item.is_full_load ? "full load rate" : `${money(item.rate_used)}/yd`}` : "Custom work"}</div></div><strong className="cc-money">{money(item.line_total)}</strong></div>)}<div className="cc-facts" style={{ marginTop: 18 }}><div className="cc-fact"><span>Materials</span><strong>{money(quote.materials_subtotal)}</strong></div><div className="cc-fact"><span>Delivery</span><strong>{money(quote.delivery_total)}</strong></div><div className="cc-fact"><span>Tax</span><strong>{money(quote.tax_amount)}</strong></div><div className="cc-fact"><span>Delivery loads</span><strong>{quote.delivery_load_count}</strong></div></div></div></Panel></div>
      <div style={{ display: "grid", alignContent: "start", gap: 20 }}><Panel title="Next"><div className="cc-panel-body"><div style={{ display: "grid", gap: 10 }}>{quote.status === "DRAFT" && <Button primary onClick={async () => { await updateQuote(quote.id, { status: "SENT", sent_at: new Date().toISOString() }); await refresh(); toast.success("Quote marked sent. Messaging remains setup-required."); }}>Mark Sent</Button>}{quote.status === "SENT" && <Button primary onClick={async () => { await updateQuote(quote.id, { status: "ACCEPTED", accepted_at: new Date().toISOString() }); await refresh(); }}>Accept Quote</Button>}{quote.status === "ACCEPTED" && !job && <Button red icon={<CalendarPlus />} onClick={() => setScheduleOpen(true)}>Schedule Job</Button>}{job && <Link className="cc-btn cc-btn-primary" to={`/admin/jobs/${job.id}`}>Open Job</Link>}</div></div></Panel><Panel title="Customer"><div className="cc-panel-body"><strong>{customer?.name}</strong><p className="cc-muted" style={{ marginTop: 5 }}>{customer?.phone}</p></div></Panel></div></div>
    <ScheduleAcceptedQuote open={scheduleOpen} onClose={() => setScheduleOpen(false)} quote={quote} />
  </>;
}

function ScheduleAcceptedQuote({ open, onClose, quote }: { open: boolean; onClose: () => void; quote: NonNullable<ReturnType<typeof useControlCenter>["data"]>["quotes"][number] }) {
  const { refresh } = useControlCenter();
  const navigate = useNavigate();
  const [date, setDate] = useState(dateKey());
  const [time, setTime] = useState("08:00");
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState<Job["category"]>(Number(quote.custom_work_subtotal) > 0 ? "OTHER" : "MATERIAL_DELIVERY");
  const [address, setAddress] = useState(quote.address);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => { if (!address.trim()) { toast.error("Job site is required."); return; } setBusy(true); try { const id = await createJob({ customerId: quote.customer_id, quoteId: quote.id, category, date, time, allDay, address, description: quote.description, agreedAmount: Number(quote.grand_total), notes }); await refresh(); onClose(); navigate(`/admin/jobs/${id}`); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not schedule job"); } finally { setBusy(false); } };
  return <Sheet open={open} onClose={onClose} title="Schedule Job" actions={<><Button onClick={onClose}>Cancel</Button><Button primary disabled={busy} onClick={() => void save()}>Schedule</Button></>}><div className="cc-form-grid"><SelectField label="Job type" value={category} onChange={(event)=>setCategory(event.target.value as Job["category"])}>{["MATERIAL_DELIVERY","DRIVEWAY","DIRT_GRADING","POND","DEMOLITION","OTHER"].map((value)=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</SelectField><TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Field label="Schedule"><label style={{minHeight:48,display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={allDay} onChange={(event)=>setAllDay(event.target.checked)}/> All day</label></Field>{!allDay&&<TextInput label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />}<TextInput label="Job site" value={address} onChange={(e) => setAddress(e.target.value)} className="sm:col-span-2" /><TextArea label="Notes" value={notes} onChange={(event)=>setNotes(event.target.value)} className="sm:col-span-2" /><div className="cc-field-ice" style={{ padding: 16 }}><span className="cc-label" style={{ color: "rgba(14,14,16,.62)" }}>Agreed amount</span><strong className="cc-display cc-money" style={{ display: "block", fontSize: 34 }}>{money(quote.grand_total)}</strong></div></div></Sheet>;
}

export function JobDetail() {
  const { jobId = "" } = useParams();
  const { data, loading, error, refresh } = useControlCenter();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("08:00");
  const [rescheduleAllDay, setRescheduleAllDay] = useState(false);
  if (loading) return <Loading />;
  if (error) return <SetupError error={error} />;
  if (!data) return <Loading />;
  const job = data.jobs.find((entry) => entry.id === jobId);
  if (!job) return <Missing area="Job" back="/admin/jobs" />;
  const customer = customerFor(data, job.customer_id);
  const tickets = data.tickets.filter((ticket) => ticket.job_id === job.id);
  const invoice = data.invoices.find((entry) => entry.job_id === job.id && entry.status !== "VOID");
  const updateStatus = async (status: Job["status"]) => { await updateJob(job.id, { status, completed_at: status === "COMPLETED" ? new Date().toISOString() : job.completed_at }); await refresh(); };
  return <><PageHeader eyebrow={job.category.replaceAll("_", " ")} title={customer?.name ?? "Job"} subtitle={job.description} backTo="/admin/jobs" right={<Status tone={job.status === "COMPLETED" ? "ok" : job.status === "CANCELLED" ? "red" : "ice"}>{job.status.replace("_", " ")}</Status>} />
    {job.blocked_reason && <section className="cc-field-red cc-urgent"><span className="cc-label">Work blocked</span><h3>{job.blocked_reason}</h3><div className="cc-toolbar" style={{ marginTop: 14 }}>{customer?.phone && <a className="cc-btn" style={{ color: "#0e0e10", borderColor: "rgba(14,14,16,.25)" }} href={`tel:${customer.phone}`}><Phone size={18} /> Call</a>}{customer?.phone && <a className="cc-btn" style={{ color: "#0e0e10", borderColor: "rgba(14,14,16,.25)" }} href={`sms:${customer.phone}`}><MessageSquare size={18} /> Text</a>}</div></section>}
    <div className="cc-detail-grid"><div style={{ display: "grid", gap: 20 }}><Panel title="Job"><div className="cc-panel-body"><div className="cc-facts"><div className="cc-fact"><span>Date</span><strong>{dateLabel(job.scheduled_date)}</strong></div><div className="cc-fact"><span>Time</span><strong>{job.all_day ? "All day" : job.scheduled_time?.slice(0,5)}</strong></div><div className="cc-fact"><span>Job site</span><strong>{job.address}</strong></div><div className="cc-fact"><span>Agreed amount</span><strong>{money(job.agreed_amount)}</strong></div></div>{job.notes && <p className="cc-muted" style={{ marginTop: 20 }}>{job.notes}</p>}</div></Panel><Panel title="Tickets">{tickets.length ? tickets.map((ticket) => <Link key={ticket.id} to={`/admin/tickets/${ticket.id}`} className="cc-attention-row"><div><h3>{ticket.ticket_number}</h3><p>{ticket.job_site_address}</p></div><strong className="cc-money">{money(ticket.grand_total)}</strong></Link>) : <Empty title="No ticket yet" detail="Create one when material delivery proof is needed." />}</Panel></div>
      <div style={{ display: "grid", alignContent: "start", gap: 20 }}><Panel title="Next"><div className="cc-panel-body" style={{ display: "grid", gap: 10 }}>{job.status === "SCHEDULED" && <Button primary onClick={() => void updateStatus("IN_PROGRESS")}>Start Job</Button>}{job.status === "IN_PROGRESS" && <Button primary icon={<CheckCircle2 />} onClick={() => void updateStatus("COMPLETED")}>Complete Job</Button>}{job.status !== "CANCELLED" && <Button icon={<TicketIcon />} onClick={() => navigate(`/admin/tickets/new?job=${job.id}`)}>Create Ticket</Button>}{!["COMPLETED","CANCELLED"].includes(job.status) && <Button onClick={() => { setRescheduleDate(job.scheduled_date); setRescheduleTime(job.scheduled_time?.slice(0,5) ?? "08:00"); setRescheduleAllDay(job.all_day); setRescheduleOpen(true); }}>Reschedule</Button>}{job.status === "COMPLETED" && !invoice && <Button primary icon={<Banknote />} onClick={async () => { const id = await createInvoiceFromJob(job.id); await refresh(); navigate(`/admin/money/invoices/${id}`); }}>Create Invoice</Button>}{invoice && <Link className="cc-btn cc-btn-primary" to={`/admin/money/invoices/${invoice.id}`}>Open Invoice</Link>}{!["COMPLETED","CANCELLED"].includes(job.status) && <Button onClick={() => setCancelOpen(true)}>Cancel Job</Button>}</div></Panel><Panel title="Customer"><div className="cc-panel-body"><Link to={`/admin/customers/${customer?.id}`} style={{ fontWeight: 700 }}>{customer?.name}</Link><p className="cc-muted" style={{ marginTop: 5 }}>{customer?.phone}</p></div></Panel></div></div>
    <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Job" actions={<><Button onClick={() => setCancelOpen(false)}>Keep Job</Button><Button red disabled={!reason.trim()} onClick={async () => { await updateJob(job.id, { status: "CANCELLED", cancelled_at: new Date().toISOString(), cancellation_reason: reason }); await refresh(); setCancelOpen(false); }}>Cancel Job</Button></>}><TextArea label="Cancellation reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required. The record and activity history are preserved." /></Sheet>
    <Sheet open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} title="Reschedule Job" actions={<><Button onClick={()=>setRescheduleOpen(false)}>Cancel</Button><Button primary disabled={!rescheduleDate} onClick={async()=>{await updateJob(job.id,{scheduled_date:rescheduleDate,scheduled_time:rescheduleAllDay?null:rescheduleTime,all_day:rescheduleAllDay,change_requested:false});await refresh();setRescheduleOpen(false);toast.success("Job moved. Any connected reminder workflow must use the new date.");}}>Move Job</Button></>}><div className="cc-form-grid"><TextInput label="Date" type="date" value={rescheduleDate} onChange={(event)=>setRescheduleDate(event.target.value)}/><Field label="Schedule"><label style={{minHeight:48,display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={rescheduleAllDay} onChange={(event)=>setRescheduleAllDay(event.target.checked)}/> All day</label></Field>{!rescheduleAllDay&&<TextInput label="Time" type="time" value={rescheduleTime} onChange={(event)=>setRescheduleTime(event.target.value)}/>}<p className="cc-muted" style={{fontSize:13}}>The active calendar moves immediately. Reminder delivery remains setup-required until messaging is connected.</p></div></Sheet>
  </>;
}

export function CustomerDetail() {
  const { customerId = "" } = useParams();
  const { data, loading, error, setAction, refresh } = useControlCenter();
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "CONVERSATION" | "QUOTE" | "JOB" | "TICKET" | "MONEY">("ALL");
  if (loading) return <Loading />;
  if (error) return <SetupError error={error} />;
  if (!data) return <Loading />;
  const customer = data.customers.find((entry) => entry.id === customerId);
  if (!customer) return <Missing area="Customer" back="/admin/customers" />;
  const leads = data.leads.filter((entry) => entry.customer_id === customer.id);
  const quotes = data.quotes.filter((entry) => entry.customer_id === customer.id);
  const jobs = data.jobs.filter((entry) => entry.customer_id === customer.id);
  const tickets = data.tickets.filter((entry) => entry.customer_id === customer.id);
  const invoices = data.invoices.filter((entry) => entry.customer_id === customer.id);
  const activity = data.activities.filter((entry) => entry.customer_id === customer.id);
  const timeline = [
    ...activity.map((entry) => ({ id: entry.id, at: entry.created_at, type: entry.entity_type, summary: entry.summary })),
    ...data.messages.filter((entry) => entry.customer_id === customer.id).map((entry) => ({ id: entry.id, at: entry.created_at, type: "CONVERSATION", summary: entry.body })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const visibleTimeline = timeline.filter((entry) => {
    if (historyFilter === "ALL") return true;
    if (historyFilter === "MONEY") return ["INVOICE", "PAYMENT"].includes(entry.type);
    return entry.type === historyFilter;
  });
  return <><PageHeader eyebrow="Customer" title={customer.name} subtitle="The permanent identity and the complete history behind it." backTo="/admin/customers" />
    <section className="cc-field-ice" style={{ padding: 25 }}><div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}><div><span className="cc-label" style={{ color: "rgba(14,14,16,.62)" }}>Customer information</span><h2 style={{ marginTop: 7, fontSize: 26, fontWeight: 700 }}>{customer.name}</h2><p style={{ marginTop: 5 }}>{[customer.phone,customer.email].filter(Boolean).join(" · ")}</p></div><div className="cc-toolbar">{customer.phone && <a className="cc-btn" style={{ color: "#0e0e10", borderColor: "rgba(14,14,16,.24)" }} href={`tel:${customer.phone}`}><Phone size={18} /> Call</a>}{customer.phone && <a className="cc-btn" style={{ color: "#0e0e10", borderColor: "rgba(14,14,16,.24)" }} href={`sms:${customer.phone}`}><MessageSquare size={18} /> Text</a>}<Button style={{ color: "#0e0e10", borderColor: "rgba(14,14,16,.24)" }} onClick={() => setAction("lead")}>New Lead</Button></div></div><div className="cc-facts" style={{ marginTop: 23 }}><div className="cc-fact"><span style={{ color: "rgba(14,14,16,.62)" }}>Opportunities</span><strong>{leads.length + quotes.length}</strong></div><div className="cc-fact"><span style={{ color: "rgba(14,14,16,.62)" }}>Jobs</span><strong>{jobs.length}</strong></div><div className="cc-fact"><span style={{ color: "rgba(14,14,16,.62)" }}>Tickets</span><strong>{tickets.length}</strong></div></div></section>
    <div className="cc-detail-grid"><Panel title="History" glass><div className="cc-panel-body"><div className="cc-toolbar" style={{ marginBottom: 17, overflowX: "auto", flexWrap: "nowrap" }}>{(["ALL","CONVERSATION","QUOTE","JOB","TICKET","MONEY"] as const).map((value) => <Button key={value} compact primary={historyFilter === value} onClick={() => setHistoryFilter(value)}>{value === "ALL" ? "All" : value === "CONVERSATION" ? "Conversations" : value[0] + value.slice(1).toLowerCase()}</Button>)}</div><div className="cc-timeline">{visibleTimeline.length ? visibleTimeline.map((entry) => <div key={entry.id} className="cc-timeline-item" data-kind={entry.type}><span className="cc-timeline-dot" /><h4>{entry.summary}</h4><p>{entry.type} · {new Date(entry.at).toLocaleString("en-US")}</p></div>) : <Empty title="Nothing here yet" detail="This part of the history fills in as real work happens." />}</div></div></Panel>
      <div style={{ display: "grid", alignContent: "start", gap: 20 }}><Panel title="Opportunities" className="cc-ice-surface">{[...leads.map((lead) => ({ id: lead.id, to: `/admin/leads/${lead.id}`, title: lead.need, status: lead.status })),...quotes.map((quote) => ({ id: quote.id, to: `/admin/quotes/${quote.id}`, title: `${quote.quote_number} · ${quote.description}`, status: quote.status }))].map((entry) => <Link key={entry.id} to={entry.to} className="cc-attention-row"><div><h3>{entry.title}</h3></div><Status tone="ice">{entry.status}</Status></Link>)}</Panel><Panel title="Jobs & Money"><div className="cc-panel-body"><div className="cc-facts"><div className="cc-fact"><span>Jobs</span><strong>{jobs.length}</strong></div><div className="cc-fact"><span>Invoices</span><strong>{invoices.length}</strong></div><div className="cc-fact"><span>Open</span><strong>{money(invoices.filter((i) => ["DRAFT","SENT"].includes(i.status)).reduce((s,i)=>s+Number(i.amount),0))}</strong></div></div></div></Panel><Panel title="Notes"><div className="cc-panel-body"><TextArea label="Customer notes" defaultValue={customer.notes ?? ""} onBlur={async (event) => { const { error: saveError } = await controlDb.from("customers").update({ notes: event.target.value }).eq("id", customer.id); if (saveError) toast.error(saveError.message); else { await refresh(); toast.success("Customer notes saved."); } }} placeholder="Gate codes, preferences, and useful permanent context" /><p className="cc-muted" style={{ marginTop: 9, fontSize: 13 }}>Job-site addresses stay with Jobs and Tickets, not the permanent customer record.</p></div></Panel><Panel title="Photos"><Empty title="No photos attached" detail="Job photo storage and upload policies are setup-required. No sample photos are shown in production." /></Panel></div></div>
  </>;
}

export function InvoiceDetail() {
  const { invoiceId = "" } = useParams();
  const { data, loading, error, refresh, setAction } = useControlCenter();
  const [method, setMethod] = useState<Payment["method"]>("ACH");
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (loading) return <Loading />;
  if (error) return <SetupError error={error} />;
  if (!data) return <Loading />;
  const invoice = data.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) return <Missing area="Invoice" back="/admin/money" />;
  const customer = customerFor(data, invoice.customer_id);
  const payments = data.payments.filter((payment) => payment.invoice_id === invoice.id && !payment.voided_at);
  const status = invoiceStatus(invoice);
  return <><PageHeader eyebrow={`Invoice ${invoice.invoice_number}`} title={customer?.name ?? "Invoice"} subtitle={invoice.description} backTo="/admin/money" right={<Status tone={status === "PAID" ? "ok" : status === "OVERDUE" || status === "VOID" ? "red" : "ice"}>{status}</Status>} />
    <div className="cc-detail-grid"><div style={{ display: "grid", gap: 20 }}><section className="cc-invoice-amount"><span className="cc-label" style={{ color: "rgba(14,14,16,.62)" }}>Amount</span><strong className="cc-money">{money(invoice.amount)}</strong><p>{invoice.amount_source === "TICKET" ? "Finalized standalone Ticket total" : "Agreed job or accepted Quote amount"}</p></section><Panel title="Invoice"><div className="cc-panel-body"><div className="cc-facts"><div className="cc-fact"><span>Created</span><strong>{dateLabel(invoice.created_at)}</strong></div><div className="cc-fact"><span>Issued</span><strong>{invoice.issued_at ? dateLabel(invoice.issued_at) : "Not sent"}</strong></div><div className="cc-fact"><span>Due</span><strong>{invoice.due_at ? dateLabel(invoice.due_at) : "Set when sent"}</strong></div><div className="cc-fact"><span>Source</span><strong>{invoice.amount_source}</strong></div></div></div></Panel><Panel title="Payments">{payments.length ? payments.map((payment) => <div key={payment.id} className="cc-attention-row"><div><h3>{payment.method.replace("_", " ")}</h3><p>{dateLabel(payment.received_at)} · human confirmed</p></div><strong className="cc-money">{money(payment.amount)}</strong></div>) : <Empty title="No payment recorded" detail="A claim of payment never marks this invoice paid." />}</Panel></div>
      <div style={{ display: "grid", alignContent: "start", gap: 20 }}><Panel title="Next"><div className="cc-panel-body" style={{ display: "grid", gap: 10 }}>{invoice.status === "DRAFT" && <Button primary icon={<Send />} onClick={async () => { const due = new Date(); due.setDate(due.getDate() + (data.controlSettings?.default_invoice_due_days ?? 3)); await updateInvoice(invoice.id, { status: "SENT", issued_at: new Date().toISOString(), due_at: due.toISOString() }); await refresh(); toast.success("Invoice marked sent. Delivery provider is setup-required."); }}>Mark Sent</Button>}{["DRAFT","SENT"].includes(invoice.status) && <><SelectField label="Payment method" value={method} onChange={(event) => setMethod(event.target.value as Payment["method"])}>{["ACH","CARD","ZELLE","APPLE_PAY","CHECK","OTHER"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</SelectField><Button primary icon={<Banknote />} onClick={async () => { await recordPayment(invoice.id, method, "Recorded from invoice detail"); await refresh(); toast.success("Full outstanding balance recorded."); }}>Record Full Balance</Button></>}{invoice.status === "PAID" && <div className="cc-ice-surface" style={{ padding: 15 }}><strong>Review request ready</strong><p className="cc-muted" style={{ marginTop: 5, fontSize: 13 }}>{data.controlSettings?.review_url ? "The review link is configured. Sending remains dependent on SMS setup." : "Add the Google review link in Settings before sending."}</p></div>}{invoice.status !== "VOID" && <Button onClick={() => setVoidOpen(true)}>Void Invoice</Button>}</div></Panel><Panel title="Communication"><div className="cc-panel-body"><p className="cc-muted">SMS, calling, and payment processor delivery remain setup-required. The UI does not claim a message or payment was delivered by a disconnected provider.</p></div></Panel></div></div>
    <Sheet open={voidOpen} onClose={() => setVoidOpen(false)} title="Void Invoice" actions={<><Button onClick={() => setVoidOpen(false)}>Keep Invoice</Button><Button red disabled={!reason.trim()} onClick={async () => { const rpc = supabase.rpc.bind(supabase) as unknown as (name: string,args:Record<string,unknown>)=>PromiseLike<{error:{message:string}|null}>; const result=await rpc("void_financial_record",{p_record_type:"INVOICE",p_record_id:invoice.id,p_reason:reason}); if(result.error) toast.error(result.error.message); else { await refresh(); setVoidOpen(false); } }}>Void with History</Button></>}><TextArea label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required. Who, when, and why are kept in financial history." /></Sheet>
  </>;
}

export function SettingsSection() {
  const { section = "business" } = useParams();
  const { data, loading, error, refresh } = useControlCenter();
  const [saved, setSaved] = useState(false);
  const [workerOpen, setWorkerOpen] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [workerPayType, setWorkerPayType] = useState<Worker["pay_type"]>("HOURLY");
  const [workerRate, setWorkerRate] = useState("");
  const [workerDriver, setWorkerDriver] = useState(false);
  const [workerNotes, setWorkerNotes] = useState("");
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingSource, setTrackingSource] = useState<TrackingLink["source"]>("Facebook");
  const [trackingCampaign, setTrackingCampaign] = useState("");
  const [trackingDestination, setTrackingDestination] = useState("https://monkeytrucking.llc/");
  if (loading) return <Loading />;
  if (error) return <SetupError error={error} />;
  if (!data) return <Loading />;
  const save = async (fn: () => PromiseLike<unknown>) => { try { await fn(); await refresh(); setSaved(true); setTimeout(() => setSaved(false), 1600); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } };
  const title = ({ business:"Business",materials:"Materials & Delivery",workers:"Workers",communication:"Communication & AI",tracking:"Tracking Links",users:"Users & Access",printing:"Printing & System" } as Record<string,string>)[section] ?? "Settings";
  return <><PageHeader eyebrow="Settings" title={title} backTo="/admin/settings" right={saved ? <Status tone="ok">Saved</Status> : undefined} />
    {section === "business" && <div className="cc-detail-grid"><Panel title="Business information"><div className="cc-panel-body cc-form-grid"><TextInput label="Company name" defaultValue={data.appSettings?.company_name} onBlur={(event) => void save(() => supabase.from("app_settings").update({ company_name:event.target.value }).eq("id",data.appSettings?.id ?? 1))} /><TextInput label="Phone" defaultValue={data.appSettings?.company_phone} onBlur={(event) => void save(() => supabase.from("app_settings").update({ company_phone:event.target.value }).eq("id",data.appSettings?.id ?? 1))} /><TextInput label="Email" defaultValue={data.controlSettings?.company_email ?? ""} onBlur={(event) => void save(() => saveControlSettings({ company_email:event.target.value }))} /><TextInput label="Address" defaultValue={data.appSettings?.company_address} onBlur={(event) => void save(() => supabase.from("app_settings").update({ company_address:event.target.value }).eq("id",data.appSettings?.id ?? 1))} /></div></Panel><Panel title="Tax & invoices"><div className="cc-panel-body" style={{ display:"grid",gap:16 }}><TextInput label="Tax rate" defaultValue={data.appSettings?.tax_rate} onBlur={(event)=>void save(()=>supabase.from("app_settings").update({tax_rate:Number(event.target.value)}).eq("id",data.appSettings?.id ?? 1))}/><Field label="Delivery tax"><label style={{ minHeight: 48, display:"flex",alignItems:"center",gap:10 }}><input type="checkbox" defaultChecked={Boolean(data.appSettings?.tax_applies_to_delivery)} onChange={(event)=>void save(()=>supabase.from("app_settings").update({tax_applies_to_delivery:event.target.checked}).eq("id",data.appSettings?.id ?? 1))}/> Charge tax on delivery</label></Field><TextInput label="Default invoice due days" type="number" min="1" max="30" defaultValue={data.controlSettings?.default_invoice_due_days ?? 3} onBlur={(event)=>void save(()=>saveControlSettings({default_invoice_due_days:Number(event.target.value)}))}/><SelectField label="Custom work tax" value={data.controlSettings?.custom_work_tax_rule ?? "PENDING"} onChange={(event)=>void save(()=>saveControlSettings({custom_work_tax_rule:event.target.value as "PENDING"|"TAXED"|"EXEMPT"}))}><option value="PENDING">Setup required</option><option value="TAXED">Taxed</option><option value="EXEMPT">Not taxed</option></SelectField><p className="cc-muted" style={{fontSize:13}}>This unresolved rule is internal only and never prints on a customer quote or invoice.</p></div></Panel></div>}
    {section === "materials" && <><Panel title="Pricing source"><div className="cc-record-list">{data.materials.map((material)=><div key={material.id} className="cc-record-row"><div><div className="cc-record-name">{material.name}</div><div className="cc-record-meta">{material.full_load_yards} yd full load</div></div><div>{money(material.price_per_yard)}/yd</div><div>{money(material.full_load_price)} full</div><Button compact onClick={()=>void save(()=>supabase.from("materials").update({is_active:!material.is_active}).eq("id",material.id))}>{material.is_active?"Active":"Inactive"}</Button></div>)}</div><div className="cc-panel-body"><p className="cc-muted">Materials become inactive instead of being deleted. Historical Ticket and Quote snapshots remain unchanged.</p></div></Panel><div className="cc-detail-grid"><Panel title="Delivery pricing"><div className="cc-panel-body"><div className="cc-facts"><div className="cc-fact"><span>0 to {data.appSettings?.delivery_tier_1_max_miles} mi</span><strong>{money(data.appSettings?.delivery_tier_1_fee)}/load</strong></div><div className="cc-fact"><span>Through {data.appSettings?.delivery_tier_2_max_miles} mi</span><strong>{money(data.appSettings?.delivery_tier_2_fee)}/load</strong></div><div className="cc-fact"><span>Through {data.appSettings?.delivery_tier_3_max_miles} mi</span><strong>{money(data.appSettings?.delivery_tier_3_fee)}/load</strong></div><div className="cc-fact"><span>Overage</span><strong>{money(data.appSettings?.delivery_overage_base_fee)} + {money(data.appSettings?.delivery_overage_per_mile)}/mi</strong></div></div><p className="cc-muted" style={{marginTop:14,fontSize:13}}>Quotes and Tickets read this same existing app settings record. Delivery is always selected explicitly.</p></div></Panel><Panel title="Ticket drivers">{data.drivers.map((driver)=><div key={driver.id} className="cc-attention-row"><div><h3>{driver.name}</h3><p>Existing driver record</p></div><Button compact onClick={()=>void save(()=>supabase.from("drivers").update({is_active:!driver.is_active}).eq("id",driver.id))}>{driver.is_active?"Active":"Inactive"}</Button></div>)}<div className="cc-panel-body"><p className="cc-muted">Drivers remain in the existing table and become inactive instead of being deleted. They are not merged into Workers in this phase.</p></div></Panel></div></>}
    {section === "workers" && <Panel title="Worker records" right={<Button compact icon={<Plus />} onClick={()=>setWorkerOpen(true)}>Add Worker</Button>}>{data.workers.length ? data.workers.map((worker)=><div key={worker.id} className="cc-record-row"><div><div className="cc-record-name">{worker.name}</div><div className="cc-record-meta">{worker.pay_type.replace("_"," ")} · {worker.is_driver ? "driver · " : ""}no login</div></div><div>{worker.hourly_rate ? `${money(worker.hourly_rate)}/hr` : "By load"}</div><div /><Button compact onClick={()=>void save(()=>controlDb.from("workers").update({is_active:!worker.is_active}).eq("id",worker.id))}>{worker.is_active?"Active":"Inactive"}</Button></div>) : <Empty title="No workers entered" detail="Add the real roster before worker pay is used. Prototype names were not copied." />}</Panel>}
    {section === "communication" && <><div className="cc-settings-grid">{[["SMS",data.controlSettings?.sms_status],["Calling",data.controlSettings?.calling_status],["AI",data.controlSettings?.ai_status]].map(([name,status])=><Panel key={name} title={name}><div className="cc-panel-body"><Status tone={status === "READY" ? "ok" : "warn"}>{status?.replace("_"," ")}</Status><p className="cc-muted" style={{marginTop:12,fontSize:13}}>No provider has been invented. Connect credentials and consent handling before enabling.</p></div></Panel>)}</div><Panel title={`${data.automations.length} approved automations`}>{data.automations.map((rule)=><details key={rule.id} className="cc-automation"><summary><span><strong>{rule.name}</strong><small>{rule.delay_description}</small></span><Status tone={rule.status === "ON" ? "ok" : rule.status === "OFF" ? "idle" : "warn"}>{rule.status.replace("_"," ")}</Status></summary><div className="cc-automation-body"><p><b>Trigger</b><br/>{rule.trigger_description}</p><p><b>Action</b><br/>{rule.action_description}</p><p><b>Stops when</b><br/>{(rule.stop_conditions as string[] | null)?.join(" · ") || "No additional stop condition"}</p><p><b>If it fails</b><br/>{rule.fallback_description}</p><p><b>Logged</b><br/>{rule.log_description}</p></div></details>)}</Panel></>}
    {section === "tracking" && <Panel title="Tracking links" right={<Button compact icon={<Plus />} onClick={()=>setTrackingOpen(true)}>New Link</Button>}>{data.trackingLinks.length ? data.trackingLinks.map((link)=><div key={link.id} className="cc-record-row"><div><div className="cc-record-name">{link.campaign}</div><div className="cc-record-meta">Source: {link.source} · /?mt={link.slug}</div></div><div>{link.visits} visits</div><div>{link.leads} leads</div><Status tone="ice">{link.customers} customers</Status></div>) : <Empty title="No tracking links" detail="Sources stay simple: Facebook, Website, QR code, or Other. Campaign stores the detail." />}</Panel>}
    {section === "users" && <Panel title="Authorization">{data.userRoles.map((entry)=><div className="cc-attention-row" key={entry.id}><div><h3>{entry.role}</h3><p>Account {entry.user_id.slice(0,8)}…</p></div><Status tone={entry.role === "admin" ? "red" : "ice"}>{entry.role}</Status></div>)}<div className="cc-panel-body"><p>Admin and staff access continues to come from the existing <code>user_roles</code> table.</p><p className="cc-muted" style={{marginTop:9}}>Workers are records only. They do not receive authentication, a portal, or a time clock. Public signup remains outside this Control Center.</p></div></Panel>}
    {section === "printing" && <div className="cc-detail-grid"><Panel title="4x6 printing"><div className="cc-panel-body cc-form-grid"><SelectField label="Print method" defaultValue={data.appSettings?.print_method} onChange={(event)=>void save(()=>supabase.from("app_settings").update({print_method:event.target.value}).eq("id",data.appSettings?.id ?? 1))}><option value="share">Share sheet</option><option value="direct">Direct print</option></SelectField><TextInput label="Copies" type="number" min="1" defaultValue={data.appSettings?.print_copies} onBlur={(event)=>void save(()=>supabase.from("app_settings").update({print_copies:Number(event.target.value)}).eq("id",data.appSettings?.id ?? 1))}/></div></Panel><Panel title="System state"><div className="cc-panel-body"><Status tone="warn">Printer path setup required</Status><p className="cc-muted" style={{marginTop:12}}>The existing 812 × 1218 black-and-white label renderer and share/direct print behavior are preserved. MUNBYN remains 80mm; the final 4x6 printer path is unresolved.</p></div></Panel></div>}
    <Sheet open={workerOpen} onClose={()=>setWorkerOpen(false)} title="Add Worker" actions={<><Button onClick={()=>setWorkerOpen(false)}>Cancel</Button><Button primary disabled={!workerName.trim() || (workerPayType === "HOURLY" && Number(workerRate) <= 0)} onClick={async()=>{await createWorker({name:workerName,payType:workerPayType,hourlyRate:Number(workerRate||0),isDriver:workerDriver,notes:workerNotes});await refresh();setWorkerOpen(false);setWorkerName("");setWorkerRate("");setWorkerNotes("");toast.success("Worker added without a login.");}}>Add Worker</Button></>}><div style={{display:"grid",gap:16}}><TextInput label="Name" value={workerName} onChange={(event)=>setWorkerName(event.target.value)}/><SelectField label="Pay type" value={workerPayType} onChange={(event)=>setWorkerPayType(event.target.value as Worker["pay_type"])}><option value="HOURLY">Hourly</option><option value="BY_LOAD">By load</option></SelectField>{workerPayType === "HOURLY" && <TextInput label="Hourly rate" inputMode="decimal" value={workerRate} onChange={(event)=>setWorkerRate(event.target.value)}/>}<Field label="Role"><label style={{minHeight:48,display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={workerDriver} onChange={(event)=>setWorkerDriver(event.target.checked)}/> Driver</label></Field><TextArea label="Notes, optional" value={workerNotes} onChange={(event)=>setWorkerNotes(event.target.value)}/><p className="cc-muted" style={{fontSize:13}}>Workers are operational records only. They never receive authentication, a portal, or a time clock.</p></div></Sheet>
    <Sheet open={trackingOpen} onClose={()=>setTrackingOpen(false)} title="New Tracking Link" actions={<><Button onClick={()=>setTrackingOpen(false)}>Cancel</Button><Button primary disabled={!trackingCampaign.trim() || !trackingDestination.trim()} onClick={async()=>{await createTrackingLink({source:trackingSource,campaign:trackingCampaign,destination:trackingDestination});await refresh();setTrackingOpen(false);setTrackingCampaign("");toast.success("Tracking link created.");}}>Create Link</Button></>}><div style={{display:"grid",gap:16}}><SelectField label="Source" value={trackingSource} onChange={(event)=>setTrackingSource(event.target.value as TrackingLink["source"])}>{["Facebook","Website","QR code","Other"].map((value)=><option key={value}>{value}</option>)}</SelectField><TextInput label="Campaign" value={trackingCampaign} onChange={(event)=>setTrackingCampaign(event.target.value)} placeholder="August driveway campaign"/><TextInput label="Destination" value={trackingDestination} onChange={(event)=>setTrackingDestination(event.target.value)}/><p className="cc-muted" style={{fontSize:13}}>Source stays simple. Campaign keeps the specific attribution supplied by this link.</p></div></Sheet>
  </>;
}
