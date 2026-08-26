import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, MessageSquare, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/admin/useAdminMeta";
import { deliveryShort, money, type DeliveryType } from "@/lib/admin/calc";
import { outputTicketPng, renderTicketPng, shareOrDownloadPng, type PrintMethod, type PrintTicket } from "@/lib/admin/print";
import AdminTopBar from "@/components/admin/AdminTopBar";
import ReceiptPreviewDialog from "@/components/admin/ReceiptPreviewDialog";
import { voidTicket } from "@/lib/admin/tickets";

const AdminTicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "ticket", id],
    enabled: !!id,
    queryFn: async () => {
      const [t, items, history] = await Promise.all([
        supabase.from("tickets").select("*").eq("id", id!).single(),
        supabase
          .from("ticket_items")
          .select("*")
          .eq("ticket_id", id!)
          .is("superseded_at", null)
          .order("created_at"),
        supabase
          .from("ticket_history")
          .select("id, event_type, reason, actor_label, created_at")
          .eq("ticket_id", id!)
          .order("created_at", { ascending: false }),
      ]);
      if (t.error) throw t.error;
      if (items.error) throw items.error;
      if (history.error) throw history.error;
      let driverName = "";
      if (t.data.driver_id) {
        const { data: d } = await supabase.from("drivers").select("name").eq("id", t.data.driver_id).single();
        driverName = d?.name ?? "";
      }
      return { ticket: t.data, items: items.data ?? [], history: history.data ?? [], driverName };
    },
  });

  const buildPng = async (copies = settings?.print_copies ?? 1) => {
    if (!data || !settings) return null;
    const t = data.ticket;
    const payload: PrintTicket = {
      companyName: settings.company_name,
      companyTagline: "Texas Hauling Services",
      companyAddress: settings.company_address,
      companyCityStateZip: settings.company_city_state_zip,
      companyPhone: settings.company_phone,
      ticketNumber: t.ticket_number,
      createdAt: new Date(t.created_at),
      customerName: t.customer_name,
      customerPhone: t.customer_phone,
      jobSiteAddress: t.job_site_address,
      items: data.items.map((i) => ({
        name: i.material_name,
        detail: `${i.loads == null ? "loads not recorded" : `${i.loads} load${i.loads === 1 ? "" : "s"}`} · ${Number(i.yards)} yds ${i.is_full_load ? "(Full Load)" : ""}`.trim(),
        amount: money(Number(i.line_total)),
      })),
      subtotal: money(Number(t.materials_subtotal)),
      deliveryLabel: `Delivery ${deliveryShort[t.delivery_type as DeliveryType]} x${t.load_count}`,
      deliveryAmount: money(Number(t.delivery_total)),
      taxLabel: `Tax ${Number(t.tax_rate)}%`,
      taxAmount: money(Number(t.tax_amount)),
      total: money(Number(t.grand_total)),
      driver: data.driverName,
      notes: t.notes ?? undefined,
      copies,
    };
    return await renderTicketPng(payload);
  };

  const onPrint = async () => {
    const blob = await buildPng(settings?.print_copies ?? 1);
    if (!blob) return;
    setPreviewBlob(blob);
    setPreviewOpen(true);
  };

  const confirmPrint = async () => {
    if (!previewBlob || !data) return;
    const result = await outputTicketPng(
      previewBlob,
      settings?.print_method as PrintMethod ?? "share",
      `${data.ticket.ticket_number}.png`,
    );
    if (result !== "cancelled") {
      await supabase.from("tickets").update({ printed_at: new Date().toISOString() }).eq("id", data.ticket.id);
      queryClient.invalidateQueries({ queryKey: ["admin", "ticket", id] });
      if (result === "downloaded") toast.success("Ticket image downloaded.");
      setPreviewOpen(false);
    }
  };

  const onText = async () => {
    const blob = await buildPng(1);
    if (!blob || !data) return;
    await shareOrDownloadPng(blob, `${data.ticket.ticket_number}.png`, `Ticket ${data.ticket.ticket_number}`);
    const phone = data.ticket.customer_phone.replace(/[^0-9+]/g, "");
    if (phone) window.location.href = `sms:${phone}`;
  };

  const onVoid = async () => {
    if (!data || !voidReason.trim()) return;
    setVoiding(true);
    try {
      await voidTicket(data.ticket.id, voidReason.trim());
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      setConfirmVoid(false);
      setVoidReason("");
      toast.success("Ticket voided. Its record and history were preserved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not void the ticket.");
    } finally {
      setVoiding(false);
    }
  };

  if (isLoading || !data) return <main className="px-4 pt-6 adm-meta">Loading…</main>;

  const t = data.ticket;
  const paid = t.payment_status === "paid";
  const isVoid = t.status === "void";

  const Row = ({ label, value }: { label: string; value: string }) => (
    <>
      <div className="flex items-center justify-between py-3">
        <span className="adm-label" style={{ margin: 0 }}>
          {label}
        </span>
        <span style={{ fontSize: 16 }}>{value}</span>
      </div>
      <div className="adm-rule" />
    </>
  );

  return (
    <main className="adm-screen adm-topbar-screen px-4 lg:px-0">
      <AdminTopBar title={`Ticket ${t.ticket_number}`} onBack={() => navigate("/admin")} />
      <div className="mt-6 flex items-start justify-between gap-4 lg:mt-0">
        <div>
          <h1 className="adm-title" style={{ fontSize: 32 }}>
            #{t.ticket_number}
          </h1>
          <p className="adm-meta mt-1">
            {new Date(t.created_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <span className={`adm-pill ${isVoid ? "adm-pill-void" : paid ? "adm-pill-paid" : "adm-pill-unpaid"}`}>
          {isVoid ? "Void" : paid ? "Paid" : "Unpaid"}
        </span>
      </div>

      {isVoid && (
        <div className="adm-panel mt-4 p-4" style={{ borderColor: "var(--adm-red)" }}>
          <span className="adm-label" style={{ color: "var(--adm-red)" }}>Voided ticket</span>
          <p>{t.void_reason || "Reason preserved in activity history"}</p>
        </div>
      )}

      <div className="adm-panel mt-6 p-4">
        <span className="adm-label">Customer</span>
        <p style={{ fontSize: 18 }}>{t.customer_name || "—"}</p>
        {t.customer_phone && <p className="adm-meta">{t.customer_phone}</p>}
        <span className="adm-label mt-5">Job site</span>
        <p style={{ fontSize: 18 }}>{t.job_site_address || "—"}</p>
        <span className="adm-label mt-5">Driver</span>
        <p style={{ fontSize: 18 }}>{data.driverName || "—"}</p>
      </div>

      <div className="adm-panel mt-4 p-4">
        <span className="adm-label">Materials</span>
        {data.items.map((i) => (
          <div key={i.id} className="flex items-start justify-between gap-3 py-2">
            <div>
              <p style={{ fontSize: 16 }}>{i.material_name}</p>
              <p className="adm-meta">
                {i.loads == null ? "Legacy load count not recorded" : `${i.loads} material load${i.loads === 1 ? "" : "s"}`} · {Number(i.yards)} yds {i.is_full_load ? "(Full load)" : `@ ${money(Number(i.rate_used))}/yd`}
              </p>
            </div>
            <span className="adm-num" style={{ fontSize: 22 }}>
              {money(Number(i.line_total))}
            </span>
          </div>
        ))}
      </div>

      <div className="adm-panel mt-4 px-4 py-2">
        <Row label="Subtotal" value={money(Number(t.materials_subtotal))} />
        <Row
          label={`Delivery, ${deliveryShort[t.delivery_type as DeliveryType]}, ${t.load_count} load${
            t.load_count > 1 ? "s" : ""
          }`}
          value={money(Number(t.delivery_total))}
        />
        <Row label={`Tax ${Number(t.tax_rate)}%`} value={money(Number(t.tax_amount))} />
        <div className="flex items-baseline justify-between py-4">
          <span className="adm-label" style={{ margin: 0 }}>
            Total
          </span>
          <span className="adm-num" style={{ fontSize: 34 }}>
            {money(Number(t.grand_total))}
          </span>
        </div>
      </div>

      {t.notes && (
        <div className="adm-panel mt-4 p-4">
          <span className="adm-label">Notes</span>
          <p style={{ fontSize: 16 }}>{t.notes}</p>
        </div>
      )}

      {data.history.length > 0 && (
        <div className="adm-panel mt-4 p-4">
          <span className="adm-label">Activity history</span>
          <div className="space-y-3">
            {data.history.map((entry) => (
              <div key={entry.id}>
                <p className="font-semibold capitalize">{entry.event_type}</p>
                <p className="adm-meta">
                  {entry.actor_label || "Authorized account"} · {new Date(entry.created_at).toLocaleString("en-US")}
                </p>
                {entry.reason && <p className="adm-meta">{entry.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <button type="button" className="adm-btn adm-btn-red w-full" disabled={isVoid} onClick={() => void onPrint()}>
          <Printer size={20} /> Print
        </button>
        <button type="button" className="adm-btn w-full" disabled={isVoid} onClick={() => void onText()}>
          <MessageSquare size={20} /> Text to customer
        </button>
        {!isVoid && <Link to={`/admin/ticket/${t.id}/edit`} className="adm-btn w-full">
          <Pencil size={18} /> Correct ticket
        </Link>}
        {!isVoid && !confirmVoid ? (
          <button
            type="button"
            className="adm-btn w-full"
            style={{ background: "transparent", border: "none", color: "var(--adm-red)" }}
            onClick={() => setConfirmVoid(true)}
          >
            <Ban size={18} /> Void ticket
          </button>
        ) : !isVoid && (
          <div className="adm-panel p-4">
            <label className="adm-label" htmlFor="void-reason">Reason for void</label>
            <textarea
              id="void-reason"
              className="adm-textarea"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Required. This is saved in activity history."
            />
            <div className="mt-3 flex gap-3">
              <button type="button" className="adm-btn flex-1" onClick={() => setConfirmVoid(false)}>
                Cancel
              </button>
              <button type="button" className="adm-btn adm-btn-red flex-1" disabled={voiding || !voidReason.trim()} onClick={() => void onVoid()}>
                {voiding ? "Voiding…" : "Void ticket"}
              </button>
            </div>
          </div>
        )}
      </div>
      <ReceiptPreviewDialog
        blob={previewBlob}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onPrint={confirmPrint}
        title={`Ticket ${t.ticket_number}`}
      />
    </main>
  );
};

export default AdminTicketDetail;
