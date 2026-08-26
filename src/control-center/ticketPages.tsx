import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  computeTotals,
  deliveryLabels,
  lineTotalFor,
  type DeliveryType,
  type LineItemDraft,
} from "@/lib/admin/calc";
import {
  correctTicket,
  saveTicket,
  voidTicket,
  type TicketDraft,
} from "@/lib/admin/tickets";
import { outputTicketPng, renderTicketPng, type PrintMethod, type PrintTicket } from "@/lib/admin/print";
import ReceiptPreviewDialog from "@/components/admin/ReceiptPreviewDialog";
import {
  Button,
  CustomerPicker,
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
import { createInvoiceFromTicket, customerFor, money } from "./data";

const newLine = (): LineItemDraft => ({
  key: crypto.randomUUID(),
  material_id: "",
  material_name: "",
  is_full_load: true,
  loads: "1",
  yards: "20",
  rate_used: 0,
  line_total: 0,
});

type MissingKey = "customer" | "address" | "driver" | "material" | "delivery";

export function TicketBuilder() {
  const { ticketId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, refresh } = useControlCenter();
  const editing = data?.tickets.find((ticket) => ticket.id === ticketId);
  const sourceItems = useMemo(
    () => data?.ticketItems.filter((item) => item.ticket_id === ticketId) ?? [],
    [data?.ticketItems, ticketId],
  );
  const job = data?.jobs.find((entry) => entry.id === params.get("job"));
  const [customerId, setCustomerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [address, setAddress] = useState("");
  const [driverId, setDriverId] = useState("");
  const [items, setItems] = useState<LineItemDraft[]>([newLine()]);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null);
  const [deliveryLoads, setDeliveryLoads] = useState("1");
  const [loadsTouched, setLoadsTouched] = useState(false);
  const [miles, setMiles] = useState("");
  const [customFee, setCustomFee] = useState("");
  const [notes, setNotes] = useState("");
  const [missing, setMissing] = useState<Set<MissingKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!data) return;
    if (editing) {
      setCustomerId(editing.customer_id ?? "");
      setAddress(editing.job_site_address);
      setDriverId(editing.driver_id ?? "");
      setDeliveryType(editing.delivery_type as DeliveryType);
      setDeliveryLoads(String(editing.load_count));
      setLoadsTouched(true);
      setMiles(editing.delivery_miles == null ? "" : String(editing.delivery_miles));
      setCustomFee(editing.delivery_type === "custom" ? String(editing.delivery_fee_per_load) : "");
      setNotes(editing.notes ?? "");
      setItems(sourceItems.map((item) => ({
        key: item.id,
        source_item_id: item.id,
        material_id: item.material_id ?? "",
        material_name: item.material_name,
        is_full_load: item.is_full_load,
        loads: item.loads == null ? "" : String(item.loads),
        yards: String(item.yards),
        rate_used: Number(item.rate_used),
        line_total: Number(item.line_total),
      })));
      return;
    }
    if (job) {
      setCustomerId(job.customer_id);
      setAddress(job.address);
    }
    if (!driverId) setDriverId(data.drivers.find((driver) => driver.is_active)?.id ?? "");
  }, [data, driverId, editing, job, sourceItems]);

  useEffect(() => {
    if (loadsTouched) return;
    const suggested = items.reduce((sum, item) => sum + Math.max(0, Number(item.loads || 0)), 0);
    setDeliveryLoads(String(Math.max(1, suggested)));
  }, [items, loadsTouched]);

  const totals = useMemo(() => computeTotals({
    items,
    deliveryType,
    miles: Number(miles || 0),
    customFee: Number(customFee || 0),
    loads: Number(deliveryLoads || 1),
    settings: data?.appSettings ?? null,
  }), [customFee, data?.appSettings, deliveryLoads, deliveryType, items, miles]);

  if (loading) return <Loading />;
  if (error) return <SetupError error={error} />;
  if (!data) return <Loading />;
  if (ticketId && !editing) return <Panel><Empty title="Ticket not found" detail="This Ticket cannot be corrected because the record was not found." /></Panel>;

  const setLine = (key: string, patch: Partial<LineItemDraft>) => {
    setItems((current) => current.map((line) => {
      if (line.key !== key) return line;
      const next = { ...line, ...patch };
      const material = data.materials.find((entry) => entry.id === next.material_id);
      if (material) {
        next.material_name = material.name;
        if (next.is_full_load && (!next.yards || patch.is_full_load === true)) next.yards = String(Number(material.full_load_yards) * Math.max(1, Number(next.loads || 1)));
        const calculated = lineTotalFor(material, next.is_full_load, Number(next.yards || 0), Number(next.loads || 1));
        next.rate_used = calculated.rate;
        next.line_total = calculated.total;
      }
      return next;
    }));
    setMissing((current) => { const next = new Set(current); next.delete("material"); return next; });
  };

  const problems = (): Array<{ key: MissingKey; message: string }> => {
    const result: Array<{ key: MissingKey; message: string }> = [];
    if (!editing?.customer_name && !customerId && (!newName.trim() || !newPhone.trim())) result.push({ key: "customer", message: "Customer name and phone are still required" });
    if (!address.trim()) result.push({ key: "address", message: "Job site address is still required" });
    if (!driverId) result.push({ key: "driver", message: "Driver is still required" });
    if (!items.some((item) => item.material_id && Number(item.line_total) > 0)) result.push({ key: "material", message: "At least one material is still required" });
    if (!deliveryType) result.push({ key: "delivery", message: "Delivery is still required" });
    return result;
  };

  const resolveCustomer = async () => {
    if (customerId) return customerId;
    if (editing) return "";
    const rpc = supabase.rpc.bind(supabase) as unknown as (name:string,args:Record<string,unknown>)=>PromiseLike<{data:{id:string}|null;error:{message:string}|null}>;
    const result = await rpc("find_or_create_customer", { p_name:newName, p_phone:newPhone, p_email:newEmail });
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.id) throw new Error("Customer save returned no record.");
    return result.data.id;
  };

  const makeDraft = (resolvedCustomerId: string): TicketDraft => {
    const customer = data.customers.find((entry) => entry.id === resolvedCustomerId);
    return {
      customer_name: editing?.customer_name ?? customer?.name ?? newName.trim(),
      customer_phone: editing?.customer_phone ?? customer?.phone ?? newPhone.trim(),
      job_site_address: address.trim(),
      driver_id: driverId || null,
      delivery_type: deliveryType!,
      delivery_miles: deliveryType === "over_10" ? Number(miles || 0) : null,
      delivery_fee_per_load: totals.delivery_fee_per_load,
      load_count: totals.loads,
      delivery_total: totals.delivery_total,
      materials_subtotal: totals.materials_subtotal,
      tax_rate: totals.tax_rate,
      tax_applies_to_delivery: Boolean(data.appSettings?.tax_applies_to_delivery),
      tax_amount: totals.tax_amount,
      grand_total: totals.grand_total,
      notes: notes.trim() || null,
      payment_status: editing?.payment_status ?? "unpaid",
      items: items.filter((item) => item.material_id && item.line_total > 0).map((item) => ({
        source_item_id: item.source_item_id,
        material_id: item.material_id || null,
        material_name: item.material_name,
        yards: Number(item.yards),
        is_full_load: item.is_full_load,
        rate_used: item.rate_used,
        line_total: item.line_total,
        loads: item.loads === "" ? null : Number(item.loads),
      })),
    };
  };

  const attemptSave = async (correctionReason?: string) => {
    const found = problems();
    if (found.length) {
      setMissing(new Set(found.map((item) => item.key)));
      refs.current[found[0].key]?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(found.length === 1 ? found[0].message : `${found.length} things still need to be completed`);
      return;
    }
    if (editing && !correctionReason) { setReasonOpen(true); return; }
    setBusy(true);
    try {
      const resolvedCustomerId = await resolveCustomer();
      const draft = makeDraft(resolvedCustomerId);
      if (editing) {
        await correctTicket(editing.id, correctionReason!, draft);
        toast.success("Ticket corrected. The previous snapshot remains in history.");
        await refresh(); navigate(`/admin/tickets/${editing.id}`);
      } else {
        if (!user?.id) throw new Error("A signed-in account is required.");
        const result = await saveTicket(draft, user.id, { customerId: resolvedCustomerId, jobId: job?.id });
        await refresh();
        if (result.queued) { toast.success("Ticket saved on this device and waiting to sync."); navigate("/admin/tickets"); }
        else { toast.success(`Ticket ${result.ticket.ticket_number} created.`); navigate(`/admin/tickets/${result.ticket.id}`); }
      }
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "Ticket could not be saved."); }
    finally { setBusy(false); }
  };

  return <>
    <PageHeader eyebrow={editing ? `Correct ${editing.ticket_number}` : job ? "From Job" : "Standalone material order"} title={editing ? "Correct Ticket" : "New Ticket"} subtitle="One continuous pass from customer to total. Pricing snapshots are written once and kept." backTo={editing ? `/admin/tickets/${editing.id}` : "/admin/tickets"} />
    {missing.size > 0 && <div className="cc-validation"><div style={{ display:"flex",gap:10,alignItems:"center" }}><AlertCircle size={19} className="cc-red" /><strong>{problems().length === 1 ? problems()[0]?.message : `${problems().length} things still need to be completed`}</strong></div>{problems().length > 1 && <ul style={{ margin:"10px 0 0 29px" }}>{problems().map((problem)=><li key={problem.key}>{problem.message}</li>)}</ul>}</div>}
    <section className="cc-surface cc-ticket-form">
      <div className="cc-form-band" data-error={missing.has("customer") || missing.has("address") || missing.has("driver")} ref={(node)=>{refs.current.customer=node;refs.current.address=node;refs.current.driver=node;}}><div className="cc-form-band-head"><span className="cc-section-label" style={{margin:0}}>Who & where</span></div>
        {editing && !editing.customer_id ? <div className="cc-ice-surface" style={{ padding:16 }}><strong>{editing.customer_name}</strong><p className="cc-muted" style={{marginTop:4,fontSize:13}}>Legacy Ticket identity snapshot. No customer relationship is inferred or backfilled.</p></div> : <CustomerPicker customers={data.customers} value={customerId} onChange={(id)=>{setCustomerId(id);setNewName("");setMissing((s)=>{const n=new Set(s);n.delete("customer");return n;});}} allowCreate onCreate={(query)=>{setCustomerId("");setNewName(query);}} />}
        {!editing && !customerId && newName && <div className="cc-form-grid" style={{marginTop:16}}><TextInput label="New customer name" value={newName} onChange={(e)=>setNewName(e.target.value)} /><TextInput label="Phone" value={newPhone} onChange={(e)=>setNewPhone(e.target.value)} inputMode="tel" /><TextInput label="Email, optional" value={newEmail} onChange={(e)=>setNewEmail(e.target.value)} type="email" /></div>}
        <div className="cc-form-grid" style={{marginTop:16}}><TextInput label="Job site address" value={address} onChange={(e)=>{setAddress(e.target.value);setMissing((s)=>{const n=new Set(s);n.delete("address");return n;});}} /><SelectField label="Driver" value={driverId} onChange={(e)=>{setDriverId(e.target.value);setMissing((s)=>{const n=new Set(s);n.delete("driver");return n;});}}><option value="">Choose driver</option>{data.drivers.filter((entry)=>entry.is_active).map((entry)=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</SelectField></div>
      </div>
      <div className="cc-form-band" data-error={missing.has("material")} ref={(node)=>{refs.current.material=node;}}><div className="cc-form-band-head"><span className="cc-section-label" style={{margin:0}}>Material</span><Button compact icon={<Plus />} onClick={()=>setItems((current)=>[...current,newLine()])}>Add</Button></div>
        {items.map((line,index)=><div className="cc-material-line" key={line.key}><div className="cc-load-block">{line.loads || "•"}</div><div style={{display:"grid",gap:10}}><SelectField label={`Material ${index+1}`} value={line.material_id} onChange={(e)=>setLine(line.key,{material_id:e.target.value})}><option value="">Choose material</option>{data.materials.filter((entry)=>entry.is_active).map((entry)=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</SelectField><div className="cc-toolbar"><label style={{display:"flex",alignItems:"center",gap:8,minHeight:44}}><input type="checkbox" checked={line.is_full_load} onChange={(e)=>setLine(line.key,{is_full_load:e.target.checked})}/> Full load rate</label><TextInput label="Material loads" type="number" min="1" value={line.loads} onChange={(e)=>setLine(line.key,{loads:e.target.value,yards:line.is_full_load?String(Number(data.materials.find((m)=>m.id===line.material_id)?.full_load_yards??20)*Number(e.target.value||1)):line.yards})}/>{!line.is_full_load&&<TextInput label="Yards" type="number" min=".01" step=".01" value={line.yards} onChange={(e)=>setLine(line.key,{yards:e.target.value})}/>}</div><strong className="cc-money">{money(line.line_total)}</strong></div>{items.length>1&&<Button compact icon={<Trash2 />} aria-label="Remove material" onClick={()=>setItems((current)=>current.filter((item)=>item.key!==line.key))}>Remove</Button>}</div>)}
      </div>
      <div className="cc-form-band" data-error={missing.has("delivery")} ref={(node)=>{refs.current.delivery=node;}}><div className="cc-form-band-head"><span className="cc-section-label" style={{margin:0}}>Delivery</span></div><div className="cc-form-grid"><SelectField label="Delivery zone" value={deliveryType??""} onChange={(e)=>{setDeliveryType((e.target.value||null) as DeliveryType|null);setMissing((s)=>{const n=new Set(s);n.delete("delivery");return n;});}}><option value="">Choose delivery</option>{Object.entries(deliveryLabels(data.appSettings)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</SelectField><TextInput label="Physical delivery loads" type="number" min="1" value={deliveryLoads} onChange={(e)=>{setDeliveryLoads(e.target.value);setLoadsTouched(true);}} />{deliveryType==="over_10"&&<TextInput label="Total miles" type="number" min="0" value={miles} onChange={(e)=>setMiles(e.target.value)}/>} {deliveryType==="custom"&&<TextInput label="Custom fee per load" inputMode="decimal" value={customFee} onChange={(e)=>setCustomFee(e.target.value)}/>}</div><p className="cc-muted" style={{marginTop:13,fontSize:13}}>Delivery loads default from material loads, but remain independently editable because actual physical delivery pricing can differ.</p></div>
      <div className="cc-form-band"><div className="cc-form-band-head"><span className="cc-section-label" style={{margin:0}}>Notes</span></div><TextArea label="Internal and printed notes" value={notes} onChange={(e)=>setNotes(e.target.value)} /></div>
      <div className="cc-form-band"><div className="cc-form-band-head"><span className="cc-section-label" style={{margin:0}}>Total</span></div><div className="cc-facts"><div className="cc-fact"><span>Material</span><strong>{money(totals.materials_subtotal)}</strong></div><div className="cc-fact"><span>Delivery</span><strong>{money(totals.delivery_total)}</strong></div><div className="cc-fact"><span>Tax</span><strong>{money(totals.tax_amount)}</strong></div><div className="cc-fact"><span>Grand total</span><strong>{money(totals.grand_total)}</strong></div></div></div>
    </section>
    <div className="cc-pinned-total"><div><span className="cc-label">Total</span><strong className="cc-money" style={{display:"block"}}>{money(totals.grand_total)}</strong></div><Button primary disabled={busy} onClick={()=>void attemptSave()}>{busy?"Saving":"Save Ticket"}</Button></div>
    <Sheet open={reasonOpen} onClose={()=>setReasonOpen(false)} title="Correction Reason" actions={<><Button onClick={()=>setReasonOpen(false)}>Cancel</Button><Button red disabled={!reason.trim()} onClick={()=>{setReasonOpen(false);void attemptSave(reason.trim());}}>Save Correction</Button></>}><TextArea label="Why this finalized Ticket is changing" value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Required. The old snapshot, who changed it, and when are preserved." /></Sheet>
  </>;
}

export function TicketDetail() {
  const { ticketId = "" } = useParams();
  const { data, loading, error, refresh } = useControlCenter();
  const navigate = useNavigate();
  const [previewBlob,setPreviewBlob]=useState<Blob|null>(null);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [voidOpen,setVoidOpen]=useState(false);
  const [voidReason,setVoidReason]=useState("");
  if(loading)return <Loading/>;
  if(error)return <SetupError error={error}/>;
  if(!data)return <Loading/>;
  const ticket=data.tickets.find((entry)=>entry.id===ticketId);
  if(!ticket)return <Panel><Empty title="Ticket not found" detail="The requested Ticket record is unavailable."/></Panel>;
  const items=data.ticketItems.filter((entry)=>entry.ticket_id===ticket.id);
  const customer=customerFor(data,ticket.customer_id);
  const job=data.jobs.find((entry)=>entry.id===ticket.job_id);
  const invoiceLink=data.invoiceTickets.find((entry)=>entry.ticket_id===ticket.id);
  const invoice=data.invoices.find((entry)=>entry.id===invoiceLink?.invoice_id);
  const history=data.ticketHistory.filter((entry)=>entry.ticket_id===ticket.id);
  const driver=data.drivers.find((entry)=>entry.id===ticket.driver_id);
  const isVoid=ticket.status==="void";
  const isFinalized=ticket.status==="saved"||ticket.status==="active";
  const buildPrint=async()=>{
    const settings=data.appSettings;
    if(!settings)return;
    const payload:PrintTicket={companyName:settings.company_name,companyTagline:"Texas Hauling Services",companyAddress:settings.company_address,companyCityStateZip:settings.company_city_state_zip,companyPhone:settings.company_phone,ticketNumber:ticket.ticket_number,createdAt:new Date(ticket.created_at),customerName:ticket.customer_name,customerPhone:ticket.customer_phone,jobSiteAddress:ticket.job_site_address,items:items.map((item)=>({name:item.material_name,detail:`${item.loads==null?"loads not recorded":`${item.loads} load${item.loads===1?"":"s"}`} · ${Number(item.yards)} yds ${item.is_full_load?"(Full Load)":""}`.trim(),amount:money(item.line_total)})),subtotal:money(ticket.materials_subtotal),deliveryLabel:`Delivery · ${ticket.load_count} load${ticket.load_count===1?"":"s"}`,deliveryAmount:money(ticket.delivery_total),taxLabel:`Tax ${Number(ticket.tax_rate)}%`,taxAmount:money(ticket.tax_amount),total:money(ticket.grand_total),driver:driver?.name??"",notes:ticket.notes??undefined,copies:settings.print_copies};
    const blob=await renderTicketPng(payload);setPreviewBlob(blob);setPreviewOpen(true);
  };
  const confirmPrint=async()=>{if(!previewBlob||!data.appSettings)return;const result=await outputTicketPng(previewBlob,(data.appSettings.print_method as PrintMethod)??"share",`${ticket.ticket_number}.png`);if(result!=="cancelled"){await supabase.from("tickets").update({printed_at:new Date().toISOString()}).eq("id",ticket.id);await refresh();setPreviewOpen(false);}};
  return <><PageHeader eyebrow={`Ticket ${ticket.ticket_number}`} title={customer?.name??ticket.customer_name} subtitle={ticket.job_site_address} backTo="/admin/tickets" right={<Status tone={isVoid?"red":"ice"}>{isVoid?"Void":"Finalized"}</Status>}/>
    {isVoid&&<div className="cc-error"><strong>Voided Ticket</strong><p className="cc-muted" style={{marginTop:5}}>{ticket.void_reason}. The record and its history remain preserved.</p></div>}
    <div className="cc-detail-grid"><div style={{display:"grid",gap:20}}><section className="cc-field-platinum"><div style={{display:"flex",justifyContent:"space-between",gap:20,flexWrap:"wrap",padding:25}}><div><span className="cc-label" style={{color:"rgba(14,14,16,.62)"}}>Ticket</span><strong className="cc-display" style={{display:"block",fontSize:54}}>{ticket.ticket_number}</strong><span>{new Date(ticket.created_at).toLocaleString("en-US")}</span></div><div style={{textAlign:"right"}}><span className="cc-label" style={{color:"rgba(14,14,16,.62)"}}>Total</span><strong className="cc-display cc-money" style={{display:"block",fontSize:48}}>{money(ticket.grand_total)}</strong></div></div><div className="cc-facts" style={{borderTop:"1px solid rgba(14,14,16,.16)",padding:22}}><div className="cc-fact"><span style={{color:"rgba(14,14,16,.62)"}}>Job site</span><strong>{ticket.job_site_address}</strong></div><div className="cc-fact"><span style={{color:"rgba(14,14,16,.62)"}}>Driver</span><strong>{driver?.name??"Unassigned"}</strong></div><div className="cc-fact"><span style={{color:"rgba(14,14,16,.62)"}}>Total yards</span><strong>{items.reduce((sum,item)=>sum+Number(item.yards),0)} yd</strong></div><div className="cc-fact"><span style={{color:"rgba(14,14,16,.62)"}}>Delivery loads</span><strong>{ticket.load_count}</strong></div></div></section>
      <Panel title="Material"><div className="cc-panel-body">{items.map((item)=><div key={item.id} className="cc-material-line"><div className="cc-load-block">{item.loads??"•"}</div><div><strong>{item.material_name}</strong><p className="cc-muted" style={{marginTop:4,fontSize:13}}>{item.loads==null?"Legacy per-material loads not recorded":`${item.loads} material load${item.loads===1?"":"s"}`} · {Number(item.yards)} yd</p></div><strong className="cc-money">{money(item.line_total)}</strong></div>)}<div className="cc-facts" style={{marginTop:20}}><div className="cc-fact"><span>Material</span><strong>{money(ticket.materials_subtotal)}</strong></div><div className="cc-fact"><span>Delivery</span><strong>{money(ticket.delivery_total)}</strong></div><div className="cc-fact"><span>Tax</span><strong>{money(ticket.tax_amount)}</strong></div></div><p className="cc-muted" style={{marginTop:18,fontSize:13}}>These are historical snapshots. Current Settings never rewrite this Ticket.</p></div></Panel></div>
      <div style={{display:"grid",alignContent:"start",gap:20}}>{!job&&<Panel title="Invoice"><div className="cc-panel-body">{invoice?<Link className="cc-btn cc-btn-primary" to={`/admin/money/invoices/${invoice.id}`}>Open Invoice {invoice.invoice_number}</Link>:isVoid?<p className="cc-muted">A voided Ticket cannot generate an invoice.</p>:!isFinalized?<p className="cc-muted">Only a finalized standalone Ticket can generate an invoice.</p>:<><p className="cc-muted" style={{marginBottom:13}}>Standalone material order. Its finalized total becomes the invoice amount.</p><Button primary onClick={async()=>{const id=await createInvoiceFromTicket(ticket.id);await refresh();navigate(`/admin/money/invoices/${id}`);}}>Create Invoice</Button></>}</div></Panel>}<Panel title="Print"><div className="cc-panel-body"><Button primary icon={<Printer/>} disabled={isVoid} onClick={()=>void buildPrint()}>{ticket.printed_at?"Reprint Ticket":"Print Ticket"}</Button><p className="cc-muted" style={{marginTop:12,fontSize:13}}>Existing 4x6, 812 × 1218 black-and-white output is preserved.</p></div></Panel>{job&&<Panel title="Job"><div className="cc-panel-body"><Link className="cc-btn" to={`/admin/jobs/${job.id}`}>Open Job</Link></div></Panel>}{!isVoid&&<Panel title="Change this Ticket"><div className="cc-panel-body cc-toolbar"><Button onClick={()=>navigate(`/admin/tickets/${ticket.id}/edit`)}>Correct Ticket</Button><Button onClick={()=>setVoidOpen(true)}>Void Ticket</Button></div></Panel>}<Panel title="History">{history.length?history.map((entry)=><div key={entry.id} className="cc-attention-row"><div><h3>{entry.event_type.replaceAll("_"," ")}</h3><p>{entry.reason||"Recorded system event"} · {entry.actor_label||"System"}</p></div><span className="cc-record-meta">{new Date(entry.created_at).toLocaleString("en-US")}</span></div>):<Empty title="No change history" detail="This finalized snapshot has not been corrected or voided." />}</Panel><Panel title="Legacy payment field"><div className="cc-panel-body"><p className="cc-idle" style={{fontSize:13}}>Preserved as <strong>{ticket.payment_status}</strong>. It does not decide invoice or payment status.</p></div></Panel></div></div>
    <Sheet open={voidOpen} onClose={()=>setVoidOpen(false)} title="Void Ticket" actions={<><Button onClick={()=>setVoidOpen(false)}>Keep Ticket</Button><Button red disabled={!voidReason.trim()} onClick={async()=>{await voidTicket(ticket.id,voidReason.trim());await refresh();setVoidOpen(false);}}>Void with History</Button></>}><TextArea label="Reason" value={voidReason} onChange={(e)=>setVoidReason(e.target.value)} placeholder="Required. The Ticket is preserved and cannot create an invoice."/></Sheet>
    <ReceiptPreviewDialog blob={previewBlob} open={previewOpen} onOpenChange={setPreviewOpen} onPrint={confirmPrint} title={`Ticket ${ticket.ticket_number}`}/>
  </>;
}
