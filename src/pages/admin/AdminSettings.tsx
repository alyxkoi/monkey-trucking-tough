import { useEffect, useRef, useState } from "react";
import { LogOut, Plus, Printer, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDrivers, useMaterials, useSettings } from "@/hooks/admin/useAdminMeta";
import type { Driver, Material, Settings } from "@/lib/admin/calc";
import AdminTopBar from "@/components/admin/AdminTopBar";
import ReceiptPreviewDialog from "@/components/admin/ReceiptPreviewDialog";
import { outputTicketPng, renderTicketPng, type PrintMethod, type PrintTicket } from "@/lib/admin/print";

type Tab = "materials" | "drivers" | "business";
type SaveState = "idle" | "saving" | "saved" | "not-saved" | "retrying";

const EMPTY_MATERIALS: Material[] = [];
const EMPTY_DRIVERS: Driver[] = [];

const Toggle = ({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) => (
  <button type="button" className="adm-toggle" data-on={on} onClick={onChange} aria-label={label} aria-pressed={on} />
);

const AdminSettings = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: sourceMaterials = EMPTY_MATERIALS } = useMaterials(false);
  const { data: sourceDrivers = EMPTY_DRIVERS } = useDrivers(false);
  const { data: sourceSettings } = useSettings();
  const [tab, setTab] = useState<Tab>("materials");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<SaveState>("idle");
  const [testReceipt, setTestReceipt] = useState<Blob | null>(null);
  const [testPreviewOpen, setTestPreviewOpen] = useState(false);
  const timers = useRef<Record<string, number>>({});
  const writeVersions = useRef<Record<string, number>>({});
  const newName = useRef<HTMLInputElement>(null);

  useEffect(() => setMaterials(sourceMaterials), [sourceMaterials]);
  useEffect(() => setDrivers(sourceDrivers), [sourceDrivers]);
  useEffect(() => setSettings(sourceSettings ?? null), [sourceSettings]);
  useEffect(() => () => Object.values(timers.current).forEach(window.clearTimeout), []);

  const markSaved = () => {
    setStatus("saved");
    window.clearTimeout(timers.current.status);
    timers.current.status = window.setTimeout(() => setStatus("idle"), 2000);
  };

  const write = async (key: string, version: number, task: () => Promise<{ error: { message: string } | null }>, queryKey?: readonly string[]) => {
    setStatus("saving");
    try {
      const result = await task();
      if (result.error) {
        if (writeVersions.current[key] !== version) return;
        console.error(`Autosave failed (${key}):`, result.error);
        if (!navigator.onLine) {
          setStatus("retrying");
          timers.current[key] = window.setTimeout(() => void write(key, version, task, queryKey), 2500);
        } else {
          setStatus("not-saved");
        }
        return;
      }
      if (queryKey) await queryClient.invalidateQueries({ queryKey });
      if (writeVersions.current[key] !== version) return;
      markSaved();
    } catch (error) {
      console.error(`Autosave failed (${key}):`, error);
      if (writeVersions.current[key] !== version) return;
      if (!navigator.onLine) {
        setStatus("retrying");
        timers.current[key] = window.setTimeout(() => void write(key, version, task, queryKey), 2500);
      } else {
        setStatus("not-saved");
      }
    }
  };

  const queue = (key: string, task: () => Promise<{ error: { message: string } | null }>, immediate = false, queryKey?: readonly string[]) => {
    window.clearTimeout(timers.current[key]);
    const version = (writeVersions.current[key] ?? 0) + 1;
    writeVersions.current[key] = version;
    setStatus("saving");
    if (immediate) void write(key, version, task, queryKey);
    else timers.current[key] = window.setTimeout(() => void write(key, version, task, queryKey), 800);
  };

  const patchMaterial = (id: string, patch: Partial<Material>, immediate = false) => {
    setMaterials((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
    queryClient.setQueriesData<Material[]>({ queryKey: ["admin", "materials"] }, (rows) => rows?.map((row) => row.id === id ? { ...row, ...patch } : row));
    queue(`m-${id}`, async () => {
      const result = await supabase.from("materials").update(patch).eq("id", id).select("id").maybeSingle();
      if (result.error) console.error("Material update failed:", result.error);
      if (!result.error && !result.data) return { error: { message: "Material update affected no rows" } };
      return result;
    }, immediate, ["admin", "materials"]);
  };
  const patchDriver = (id: string, patch: Partial<Driver>, immediate = false) => {
    setDrivers((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
    queue(`d-${id}`, async () => {
      const result = await supabase.from("drivers").update(patch).eq("id", id).select("id").maybeSingle();
      if (!result.error && !result.data) return { error: { message: "Driver update affected no rows" } };
      return result;
    }, immediate, ["admin", "drivers"]);
  };
  const patchSettings = (patch: Partial<Settings>, immediate = false) => {
    setSettings((row) => row ? { ...row, ...patch } : row);
    const field = Object.keys(patch)[0] ?? "business";
    queue(`b-${field}`, async () => supabase.from("app_settings").update(patch).eq("id", 1), immediate);
  };

  const addMaterial = async () => {
    setStatus("saving");
    const { data, error } = await supabase.from("materials").insert({ name: "", sort_order: materials.length + 1 }).select().maybeSingle();
    if (error) console.error("Material insert failed:", error);
    if (error || !data) { setStatus(navigator.onLine ? "not-saved" : "retrying"); return; }
    setMaterials((rows) => [...rows, data]);
    queryClient.setQueryData<Material[]>(["admin", "materials"], (rows = []) => [...rows.filter((row) => row.id !== data.id), data]);
    await queryClient.invalidateQueries({ queryKey: ["admin", "materials"] });
    setStatus("idle");
    requestAnimationFrame(() => { newName.current?.scrollIntoView({ behavior: "smooth", block: "center" }); newName.current?.focus(); });
    window.setTimeout(() => setStatus("idle"), 2000);
  };

  const addDriver = async () => {
    setStatus("saving");
    const { data, error } = await supabase.from("drivers").insert({ name: "" }).select().maybeSingle();
    if (error) console.error("Driver insert failed:", error);
    if (error || !data) { setStatus(navigator.onLine ? "not-saved" : "retrying"); return; }
    setDrivers((rows) => [...rows, data]);
    queryClient.setQueryData<Driver[]>(["admin", "drivers"], (rows = []) => [...rows.filter((row) => row.id !== data.id), data]);
    await queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] });
    setStatus("idle");
    requestAnimationFrame(() => newName.current?.focus());
    window.setTimeout(() => setStatus("idle"), 2000);
  };

  const removeMaterial = async (material: Material) => {
    if (!window.confirm(`Delete ${material.name || "this material"}? Tickets that used it keep their pricing.`)) return;
    setStatus("saving");
    const { error } = await supabase.from("materials").delete().eq("id", material.id);
    if (error) { console.error("Material delete failed:", error); setStatus(navigator.onLine ? "not-saved" : "retrying"); return; }
    setMaterials((rows) => rows.filter((row) => row.id !== material.id));
    await queryClient.invalidateQueries({ queryKey: ["admin", "materials"] }); markSaved();
  };
  const removeDriver = async (driver: Driver) => {
    if (!window.confirm(`Delete ${driver.name || "this driver"}?`)) return;
    setStatus("saving");
    const { error } = await supabase.from("drivers").delete().eq("id", driver.id);
    if (error) { console.error("Driver delete failed:", error); setStatus(navigator.onLine ? "not-saved" : "retrying"); return; }
    setDrivers((rows) => rows.filter((row) => row.id !== driver.id));
    await queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] }); markSaved();
  };

  const smallField = (material: Material, key: "price_per_yard" | "full_load_price" | "full_load_yards", label: string, currency = false) => (
    <label className={key === "full_load_yards" ? "w-[76px]" : "w-[112px]"}>
      <span className="adm-label mb-1 text-[10px]">{label}</span>
      <div className="flex items-center"><span className="text-sm text-[var(--adm-text-2)]">{currency ? "$" : ""}</span><input className="adm-inline w-full text-sm" inputMode="decimal" value={String(material[key])} onChange={(e) => patchMaterial(material.id, { [key]: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} onBlur={(e) => patchMaterial(material.id, { [key]: Number(e.currentTarget.value.replace(/[^0-9.]/g, "")) || 0 }, true)} /></div>
    </label>
  );
  const businessField = (key: keyof Settings, label: string, prefix = "") => (
    <label><span className="adm-label">{label}</span><div className="flex items-center"><span className="text-[var(--adm-text-2)]">{prefix}</span><input className="adm-input" value={String(settings?.[key] ?? "")} onChange={(e) => patchSettings({ [key]: typeof settings?.[key] === "number" ? Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 : e.target.value })} /></div></label>
  );
  const deliveryMobileRow = (number: 1 | 2 | 3) => {
    const milesKey = `delivery_tier_${number}_max_miles` as keyof Settings;
    const feeKey = `delivery_tier_${number}_fee` as keyof Settings;
    return (
      <div className="adm-delivery-row" key={number}>
        <label className="adm-delivery-distance">
          <span>Up to</span>
          <input
            aria-label={`Tier ${number} maximum miles`}
            inputMode="numeric"
            value={String(settings?.[milesKey] ?? "")}
            onChange={(event) => patchSettings({ [milesKey]: Number(event.target.value.replace(/[^0-9.]/g, "")) || 0 })}
          />
          <span>mi</span>
        </label>
        <label className="adm-delivery-fee">
          <span>$</span>
          <input
            aria-label={`Up to ${String(settings?.[milesKey] ?? "")} miles fee`}
            inputMode="decimal"
            value={String(settings?.[feeKey] ?? "")}
            onChange={(event) => patchSettings({ [feeKey]: Number(event.target.value.replace(/[^0-9.]/g, "")) || 0 })}
          />
        </label>
      </div>
    );
  };

  const previewTestReceipt = async () => {
    if (!settings) return;
    const sample: PrintTicket = {
      companyName: settings.company_name,
      companyTagline: "Texas Hauling Services",
      companyAddress: settings.company_address,
      companyCityStateZip: settings.company_city_state_zip,
      companyPhone: settings.company_phone,
      ticketNumber: "TEST-0001",
      createdAt: new Date(),
      customerName: "Sample Customer",
      customerPhone: "(214) 555-0123",
      jobSiteAddress: "1234 County Road, Kaufman, TX",
      items: [
        { name: "Crushed Concrete", detail: "10 yds (Full Load)", amount: "$425.00" },
        { name: "Delivery", detail: "6-10 mi x1", amount: "$100.00" },
      ],
      subtotal: "$425.00",
      deliveryLabel: "Delivery 6-10 mi x1",
      deliveryAmount: "$100.00",
      taxLabel: `Tax ${Number(settings.tax_rate)}%`,
      taxAmount: "$35.06",
      total: "$560.06",
      driver: "Sample Driver",
      notes: "Alignment and darkness test",
      copies: settings.print_copies,
    };
    setTestReceipt(await renderTicketPng(sample));
    setTestPreviewOpen(true);
  };

  const printTestReceipt = async () => {
    if (!testReceipt) return;
    const result = await outputTicketPng(testReceipt, settings?.print_method as PrintMethod ?? "share", "monkey-trucking-test-label.png");
    if (result !== "cancelled") setTestPreviewOpen(false);
  };

  return (
    <main className="adm-screen adm-settings-screen px-4 lg:px-0">
      <AdminTopBar title="Settings" onBack={() => navigate("/admin")} />
      <div className="adm-settings-tabs">
        <div className="mb-2 flex h-5 justify-end text-sm"><span style={{ color: status === "saved" ? "var(--adm-green)" : status === "retrying" || status === "not-saved" ? "var(--adm-amber)" : "var(--adm-text-2)" }}>{status === "saving" ? "Saving" : status === "saved" ? "Saved" : status === "retrying" ? "Not saved, retrying" : status === "not-saved" ? "Not saved" : ""}</span></div>
        <div className="adm-settings-tablist" data-tab={tab}>
          <span className="adm-settings-tab-indicator" aria-hidden="true" />
          {(["materials", "drivers", "business"] as Tab[]).map((value) => <button key={value} type="button" className="adm-settings-tab" data-on={tab === value} onClick={() => setTab(value)}>{value}</button>)}
        </div>
      </div>

      <div hidden={tab !== "materials"} className="grid gap-3 lg:grid-cols-2">{materials.map((material, index) => <article key={material.id} className="adm-panel flex min-h-[140px] min-w-0 flex-col p-3">
        <div className="flex items-center gap-2"><input ref={index === materials.length - 1 ? newName : undefined} aria-label="Material name" className="adm-inline min-w-0 flex-1 text-lg font-semibold" value={material.name} placeholder="Material name" onChange={(e) => patchMaterial(material.id, { name: e.target.value })} onBlur={(e) => patchMaterial(material.id, { name: e.currentTarget.value }, true)} /><Toggle on={material.is_active} onChange={() => patchMaterial(material.id, { is_active: !material.is_active }, true)} label={`${material.name} active`} /></div>
        <div className="adm-material-fields mt-2">{smallField(material, "price_per_yard", "Per yard", true)}{smallField(material, "full_load_price", "Full load", true)}{smallField(material, "full_load_yards", "Load yds")}<button aria-label={`Delete ${material.name}`} className="flex h-11 w-11 items-center justify-center text-[var(--adm-text-2)] hover:text-[var(--adm-red)]" onClick={() => void removeMaterial(material)}><Trash2 size={18} /></button></div>
      </article>)}<button className="adm-btn adm-btn-ghost min-h-[64px]" onClick={() => void addMaterial()}><Plus size={18} /> Add material</button></div>

      <div hidden={tab !== "drivers"} className="grid gap-3 lg:grid-cols-2">{drivers.map((driver, index) => <article key={driver.id} className="adm-panel flex min-h-[92px] min-w-0 items-center gap-2 p-3"><input ref={index === drivers.length - 1 ? newName : undefined} aria-label="Driver name" className="adm-inline min-w-0 flex-1 text-lg font-semibold" value={driver.name} placeholder="Driver name" onChange={(e) => patchDriver(driver.id, { name: e.target.value })} onBlur={(e) => patchDriver(driver.id, { name: e.currentTarget.value }, true)} /><Toggle on={driver.is_active} onChange={() => patchDriver(driver.id, { is_active: !driver.is_active }, true)} label={`${driver.name} active`} /><button aria-label={`Delete ${driver.name}`} className="flex h-11 w-11 items-center justify-center text-[var(--adm-text-2)] hover:text-[var(--adm-red)]" onClick={() => void removeDriver(driver)}><Trash2 size={18} /></button></article>)}<button className="adm-btn adm-btn-ghost min-h-[64px]" onClick={() => void addDriver()}><Plus size={18} /> Add driver</button></div>

      <div hidden={tab !== "business"} className="space-y-8 pb-8">
        {settings && <>
        <section><h2 className="adm-label text-[15px] text-[var(--adm-text)]">Tax</h2><div className="grid gap-4 lg:grid-cols-2">{businessField("tax_rate", "Tax rate %")}<div className="flex min-h-12 items-center justify-between"><span>Tax applies to delivery</span><Toggle on={settings.tax_applies_to_delivery} onChange={() => patchSettings({ tax_applies_to_delivery: !settings.tax_applies_to_delivery }, true)} label="Tax applies to delivery" /></div></div></section><div className="adm-rule" />
        <section><h2 className="adm-label text-[15px] text-[var(--adm-text)]">Delivery</h2><div className="space-y-2 md:hidden">{([1, 2, 3] as const).map(deliveryMobileRow)}</div><div className="hidden grid-cols-3 gap-3 md:grid"><span className="adm-label">Tier</span><span className="adm-label">Max miles</span><span className="adm-label">Fee</span>{[1, 2, 3].map((number) => <div className="contents" key={number}><span className="flex items-center">Tier {number}</span>{businessField(`delivery_tier_${number}_max_miles` as keyof Settings, "Miles")}{businessField(`delivery_tier_${number}_fee` as keyof Settings, "Fee", "$")}</div>)}</div><div className="mt-4 grid gap-4 lg:grid-cols-2">{businessField("delivery_overage_base_fee", "Over-limit base fee", "$")}{businessField("delivery_overage_per_mile", "Over-limit per mile", "$")}</div></section><div className="adm-rule" />
        <section><h2 className="adm-label text-[15px] text-[var(--adm-text)]">Company</h2><div className="grid gap-4 lg:grid-cols-2">{businessField("company_name", "Company name")}{businessField("company_address", "Address")}{businessField("company_city_state_zip", "City, state ZIP")}{businessField("company_phone", "Phone")}</div><p className="adm-meta mt-3">This prints at the top of every ticket.</p></section><div className="adm-rule" />
        <section>
          <h2 className="adm-label text-[15px] text-[var(--adm-text)]">Printing</h2>
          <div className="grid items-end gap-4 lg:grid-cols-2">
            <fieldset>
              <legend className="adm-label">Print method</legend>
              <div className="flex gap-2">
                {(["share", "direct"] as PrintMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    className="adm-btn adm-btn-seg"
                    data-on={(settings.print_method ?? "share") === method}
                    onClick={() => patchSettings({ print_method: method }, true)}
                  >
                    {method === "share" ? "Share sheet" : "Direct print"}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              <span className="adm-label">Copies per ticket</span>
              <input
                className="adm-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={5}
                step={1}
                value={settings.print_copies}
                onChange={(event) => patchSettings({ print_copies: Math.min(5, Math.max(1, Number(event.target.value) || 1)) })}
                onBlur={(event) => patchSettings({ print_copies: Math.min(5, Math.max(1, Number(event.currentTarget.value) || 1)) }, true)}
              />
            </label>
            <button type="button" className="adm-btn w-full lg:col-span-2" onClick={() => void previewTestReceipt()}>
              <Printer size={20} /> Print test receipt
            </button>
          </div>
          <p className="adm-meta mt-3">Direct print opens a 4×6 browser print sheet. Multiple copies are stacked with a dashed cut line in shared images.</p>
        </section>
        </>}
      </div>
      <div className="adm-rule" />
      <section className="pb-2">
        <h2 className="adm-label text-[15px] text-[var(--adm-text)]">Account</h2>
        <button
          type="button"
          className="adm-btn adm-btn-ghost min-h-[56px] w-full"
          onClick={async () => {
            await signOut();
            navigate("/", { replace: true });
          }}
        >
          <LogOut size={20} /> Sign out
        </button>
      </section>

      <ReceiptPreviewDialog blob={testReceipt} open={testPreviewOpen} onOpenChange={setTestPreviewOpen} onPrint={printTestReceipt} title="Test receipt" />
    </main>
  );
};

export default AdminSettings;
