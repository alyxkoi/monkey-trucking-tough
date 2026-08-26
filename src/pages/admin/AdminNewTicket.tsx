import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDrivers, useMaterials, useSettings } from "@/hooks/admin/useAdminMeta";
import {
  computeTotals,
  deliveryLabels,
  deliveryShort,
  lineTotalFor,
  money,
  type DeliveryType,
  type LineItemDraft,
} from "@/lib/admin/calc";
import { saveTicket, type TicketDraft } from "@/lib/admin/tickets";
import AdminTopBar from "@/components/admin/AdminTopBar";

const newLine = (): LineItemDraft => ({
  key: crypto.randomUUID(),
  material_id: "",
  material_name: "",
  is_full_load: true,
  yards: "",
  rate_used: 0,
  line_total: 0,
});

const AdminNewTicket = () => {
  const { id: editId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: materials = [] } = useMaterials();
  const { data: drivers = [] } = useDrivers();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobSite, setJobSite] = useState("");
  const [driverId, setDriverId] = useState("");
  const [items, setItems] = useState<LineItemDraft[]>([newLine()]);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("tier_1");
  const [miles, setMiles] = useState("");
  const [customFee, setCustomFee] = useState("");
  const [loads, setLoads] = useState("1");
  const [notes, setNotes] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const hydrated = useRef(false);

  // Past customers, for the name autocomplete.
  const { data: pastCustomers = [] } = useQuery({
    queryKey: ["admin", "past-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("customer_name, customer_phone")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const seen = new Map<string, string>();
      (data ?? []).forEach((r) => {
        if (r.customer_name && !seen.has(r.customer_name)) seen.set(r.customer_name, r.customer_phone);
      });
      return [...seen.entries()].map(([name, ph]) => ({ name, phone: ph }));
    },
  });

  // Editing an existing ticket.
  const { data: existing } = useQuery({
    queryKey: ["admin", "ticket", editId],
    enabled: !!editId,
    queryFn: async () => {
      const [t, it] = await Promise.all([
        supabase.from("tickets").select("*").eq("id", editId!).single(),
        supabase.from("ticket_items").select("*").eq("ticket_id", editId!).order("created_at"),
      ]);
      if (t.error) throw t.error;
      return { ticket: t.data, items: it.data ?? [] };
    },
  });

  useEffect(() => {
    if (!existing || hydrated.current) return;
    hydrated.current = true;
    const t = existing.ticket;
    setCustomerName(t.customer_name);
    setPhone(t.customer_phone);
    setJobSite(t.job_site_address);
    setDriverId(t.driver_id ?? "");
    setDeliveryType(t.delivery_type as DeliveryType);
    setMiles(t.delivery_miles != null ? String(t.delivery_miles) : "");
    setCustomFee(t.delivery_type === "custom" ? String(t.delivery_fee_per_load) : "");
    setLoads(String(t.load_count));
    setNotes(t.notes ?? "");
    setItems(
      existing.items.length
        ? existing.items.map((i) => ({
            key: i.id,
            material_id: i.material_id ?? "",
            material_name: i.material_name,
            is_full_load: i.is_full_load,
            yards: String(i.yards),
            rate_used: Number(i.rate_used),
            line_total: Number(i.line_total),
          }))
        : [newLine()],
    );
  }, [existing]);

  // Default the driver when there is only one.
  useEffect(() => {
    if (!driverId && drivers.length === 1) setDriverId(drivers[0].id);
  }, [drivers, driverId]);

  const totals = useMemo(
    () =>
      computeTotals({
        items,
        deliveryType,
        miles: Number(miles) || 0,
        customFee: Number(customFee) || 0,
        loads: Number(loads) || 1,
        settings: settings ?? null,
      }),
    [items, deliveryType, miles, customFee, loads, settings],
  );

  const updateLine = (key: string, patch: Partial<LineItemDraft>) =>
    setItems((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        const material = materials.find((m) => m.id === next.material_id);
        if (patch.is_full_load === true && material) next.yards = String(material.full_load_yards);
        if (patch.is_full_load === false) next.yards = "";
        if (material) next.material_name = material.name;
        const { rate, total } = lineTotalFor(material, next.is_full_load, Number(next.yards) || 0);
        next.rate_used = rate;
        next.line_total = total;
        return next;
      }),
    );

  const suggestions = customerName.trim()
    ? pastCustomers.filter((c) => c.name.toLowerCase().includes(customerName.trim().toLowerCase())).slice(0, 5)
    : [];

  const onSave = async () => {
    if (!settings) return;
    if (items.some((i) => !i.material_id)) {
      toast.error("Pick a material for every line.");
      return;
    }
    setSaving(true);
    const draft: TicketDraft = {
      customer_name: customerName.trim(),
      customer_phone: phone.trim(),
      job_site_address: jobSite.trim(),
      driver_id: driverId || null,
      delivery_type: deliveryType,
      delivery_miles: deliveryType === "over_10" ? Number(miles) || 0 : null,
      delivery_fee_per_load: totals.delivery_fee_per_load,
      load_count: totals.loads,
      delivery_total: totals.delivery_total,
      materials_subtotal: totals.materials_subtotal,
      tax_rate: totals.tax_rate,
      tax_amount: totals.tax_amount,
      grand_total: totals.grand_total,
      notes: notes.trim() || null,
      items: items.map((i) => ({
        material_id: i.material_id || null,
        material_name: i.material_name,
        yards: Number(i.yards) || 0,
        is_full_load: i.is_full_load,
        rate_used: i.rate_used,
        line_total: i.line_total,
      })),
    };

    try {
      if (editId) {
        const { items: lineItems, ...ticket } = draft;
        const { error } = await supabase.from("tickets").update(ticket).eq("id", editId);
        if (error) throw error;
        await supabase.from("ticket_items").delete().eq("ticket_id", editId);
        if (lineItems.length)
          await supabase.from("ticket_items").insert(lineItems.map((i) => ({ ...i, ticket_id: editId })));
        queryClient.invalidateQueries({ queryKey: ["admin"] });
        navigate(`/admin/ticket/${editId}`, { replace: true });
        return;
      }

      const result = await saveTicket({ ...draft });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (result.queued) {
        toast.warning("Offline — ticket saved on this device and will sync automatically.");
        navigate("/admin", { replace: true });
      } else {
        navigate(`/admin/ticket/${result.ticket.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the ticket.");
    } finally {
      setSaving(false);
    }
  };

  const labels = deliveryLabels(settings);
  const filledFieldCount = [customerName, phone, jobSite, notes].filter((value) => value.trim()).length
    + items.filter((item) => item.material_id || item.yards.trim()).length;
  const leaveForm = () => {
    if (filledFieldCount >= 2) setConfirmDiscard(true);
    else navigate("/admin");
  };

  return (
    <main className="adm-screen adm-topbar-screen px-4 lg:px-0">
      <AdminTopBar title={editId ? "Edit ticket" : "New ticket"} onBack={leaveForm} />
      <h1 className="adm-title mt-6" style={{ fontSize: 32 }}>
        {editId ? "Edit ticket" : "New ticket"}
      </h1>

      <div className="mt-6 space-y-5">
        <div className="relative">
          <label className="adm-label" htmlFor="customer">
            Customer name
          </label>
          <input
            id="customer"
            className="adm-input"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setShowSuggestions(true);
            }}
            onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="adm-panel absolute z-30 mt-1 w-full overflow-hidden" style={{ background: "var(--adm-raised)" }}>
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className="block w-full px-4 text-left"
                  style={{ minHeight: 48, fontSize: 16 }}
                  onMouseDown={() => {
                    setCustomerName(s.name);
                    if (s.phone) setPhone(s.phone);
                    setShowSuggestions(false);
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="adm-label" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            className="adm-input"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="adm-label" htmlFor="jobsite">
            Job site address
          </label>
          <input id="jobsite" className="adm-input" value={jobSite} onChange={(e) => setJobSite(e.target.value)} />
        </div>

        <div>
          <label className="adm-label" htmlFor="driver">
            Driver
          </label>
          <select id="driver" className="adm-select" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Select driver</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Materials */}
      <h2 className="adm-label mt-9" style={{ fontSize: 15, color: "var(--adm-text)" }}>
        Materials
      </h2>
      <div className="space-y-4">
        {items.map((line) => (
          <div key={line.key} className="adm-panel relative p-4">
            {items.length > 1 && (
              <button
                type="button"
                aria-label="Remove material line"
                className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center"
                style={{ color: "var(--adm-text-2)" }}
                onClick={() => setItems((prev) => prev.filter((l) => l.key !== line.key))}
              >
                <X size={20} />
              </button>
            )}
            <label className="adm-label" htmlFor={`material-${line.key}`}>
              Material
            </label>
            <select
              id={`material-${line.key}`}
              className="adm-select"
              style={{ paddingRight: 52 }}
              value={line.material_id}
              onChange={(e) => updateLine(line.key, { material_id: e.target.value, is_full_load: line.is_full_load })}
            >
              <option value="">Select material</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="adm-btn adm-btn-seg"
                data-on={line.is_full_load}
                onClick={() => updateLine(line.key, { is_full_load: true })}
              >
                Full load
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-seg"
                data-on={!line.is_full_load}
                onClick={() => updateLine(line.key, { is_full_load: false })}
              >
                Custom
              </button>
            </div>

            <div className="mt-4 flex items-end gap-4">
              <div className="flex-1">
                <label className="adm-label" htmlFor={`yards-${line.key}`}>
                  Yards
                </label>
                <input
                  id={`yards-${line.key}`}
                  className="adm-input"
                  type="text"
                  inputMode="decimal"
                  disabled={line.is_full_load}
                  value={line.yards}
                  onChange={(e) => updateLine(line.key, { yards: e.target.value.replace(/[^0-9.]/g, "") })}
                />
              </div>
              <span className="adm-num pb-3" style={{ fontSize: 26 }}>
                {money(line.line_total)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="adm-btn adm-btn-ghost mt-3 w-full" onClick={() => setItems((p) => [...p, newLine()])}>
        <Plus size={18} /> Add another material
      </button>

      {/* Delivery */}
      <div className="mt-9 space-y-5">
        <div>
          <label className="adm-label" htmlFor="delivery">
            Delivery
          </label>
          <select
            id="delivery"
            className="adm-select"
            value={deliveryType}
            onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
          >
            {(Object.keys(labels) as DeliveryType[]).map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
        </div>

        {deliveryType === "over_10" && (
          <div>
            <label className="adm-label" htmlFor="miles">
              Total miles
            </label>
            <input
              id="miles"
              className="adm-input"
              type="text"
              inputMode="decimal"
              value={miles}
              onChange={(e) => setMiles(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        )}

        {deliveryType === "custom" && (
          <div>
            <label className="adm-label" htmlFor="customfee">
              Custom fee per load
            </label>
            <input
              id="customfee"
              className="adm-input"
              type="text"
              inputMode="decimal"
              value={customFee}
              onChange={(e) => setCustomFee(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        )}

        <div>
          <span className="adm-label">Number of loads</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Fewer loads"
              className="adm-btn"
              style={{ width: 56 }}
              onClick={() => setLoads(String(Math.max(1, (Number(loads) || 1) - 1)))}
            >
              <Minus size={20} />
            </button>
            <input
              className="adm-input text-center"
              type="text"
              inputMode="numeric"
              aria-label="Loads"
              value={loads}
              onChange={(e) => setLoads(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => setLoads(String(Math.max(1, Number(loads) || 1)))}
            />
            <button
              type="button"
              aria-label="More loads"
              className="adm-btn"
              style={{ width: 56 }}
              onClick={() => setLoads(String((Number(loads) || 1) + 1))}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div>
          <label className="adm-label" htmlFor="notes">
            Notes
          </label>
          <textarea id="notes" className="adm-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Totals */}
      <div className="adm-panel mt-8 p-4">
        <div className="flex items-center justify-between py-2">
          <span className="adm-label" style={{ margin: 0 }}>
            Materials subtotal
          </span>
          <span style={{ fontSize: 16 }}>{money(totals.materials_subtotal)}</span>
        </div>
        <div className="adm-rule" />
        <div className="flex items-center justify-between py-2">
          <span className="adm-label" style={{ margin: 0 }}>
            Delivery, {deliveryShort[deliveryType]}, {totals.loads} load{totals.loads > 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 16 }}>{money(totals.delivery_total)}</span>
        </div>
        <div className="adm-rule" />
        <div className="flex items-center justify-between py-2">
          <span className="adm-label" style={{ margin: 0 }}>
            Tax {totals.tax_rate}%
          </span>
          <span style={{ fontSize: 16 }}>{money(totals.tax_amount)}</span>
        </div>
      </div>

      {/* Pinned total bar */}
      <div
        className="adm-total-dock fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-3"
        style={{ background: "#0E0E10", borderTop: "1px solid var(--adm-line)" }}
      >
        <div className="flex items-baseline justify-between">
          <span className="adm-label" style={{ margin: 0 }}>
            Total
          </span>
          <span key={totals.grand_total} className="adm-num adm-total-num" style={{ fontSize: 34 }}>
            {money(totals.grand_total)}
          </span>
        </div>
        <button type="button" className="adm-btn adm-btn-red mt-3 w-full" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving…" : editId ? "Save changes" : "Save ticket"}
        </button>
      </div>
      {confirmDiscard && (
        <div className="adm-confirm-backdrop" role="presentation" onClick={() => setConfirmDiscard(false)}>
          <section className="adm-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="discard-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="discard-title" className="adm-title" style={{ fontSize: 26 }}>Discard this ticket?</h2>
            <div className="mt-5 grid gap-3">
              <button type="button" className="adm-btn w-full" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button type="button" className="adm-btn w-full" style={{ color: "var(--adm-red)" }} onClick={() => navigate("/admin")}>Discard</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default AdminNewTicket;
