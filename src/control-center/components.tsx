/* eslint-disable react-refresh/only-export-components */
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Inbox,
  LoaderCircle,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  cloneElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import type { Customer, Payment } from "./data";
import { dateKey, money } from "./data";

export function Button({
  children,
  primary,
  red,
  compact,
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  red?: boolean;
  compact?: boolean;
  icon?: ReactElement;
}) {
  return (
    <button
      type="button"
      className={`cc-btn ${primary ? "cc-btn-primary" : ""} ${red ? "cc-btn-red" : ""} ${compact ? "cc-btn-compact" : ""} ${className}`}
      {...props}
    >
      {icon && cloneElement(icon, { size: 18 })}
      {children}
    </button>
  );
}

export function IconButton({ label, icon: Icon, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: LucideIcon;
}) {
  return <button type="button" className="cc-btn cc-btn-icon" aria-label={label} title={label} {...props}><Icon size={20} /></button>;
}

export function Panel({ children, title, right, className = "", glass = false }: {
  children: ReactNode;
  title?: string;
  right?: ReactNode;
  className?: string;
  glass?: boolean;
}) {
  return (
    <section className={`${glass ? "cc-glass" : "cc-surface"} ${className}`}>
      {title && <div className="cc-panel-head"><span className="cc-section-label" style={{ margin: 0 }}>{title}</span>{right}</div>}
      {children}
    </section>
  );
}

export function Status({ children, tone = "idle" }: { children: ReactNode; tone?: "idle" | "ice" | "ok" | "warn" | "red" }) {
  return <span className="cc-status" data-tone={tone}>{children}</span>;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`cc-field ${className}`}><span>{label}</span>{children}</label>;
}

export function TextInput({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <Field label={label} className={className}><input className="cc-input" {...props} /></Field>;
}

export function TextArea({ label, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <Field label={label} className={className}><textarea className="cc-input" {...props} /></Field>;
}

export function SelectField({ label, children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <Field label={label} className={className}><select className="cc-input" {...props}>{children}</select></Field>;
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="cc-search"><Search size={18} /><input className="cc-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></div>;
}

export function PageHeader({ eyebrow, title, subtitle, right, backTo }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  backTo?: string;
}) {
  return (
    <header className="cc-header">
      <div style={{ minWidth: 0 }}>
        {backTo && <Link to={backTo} className="cc-link-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><ArrowLeft size={17} /> Back</Link>}
        {eyebrow && <div className="cc-label" style={{ marginTop: backTo ? 8 : 0 }}>{eyebrow}</div>}
        <h1 className="cc-page-title">{title}</h1>
        {subtitle && <p className="cc-subtitle">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Empty({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="cc-empty"><Inbox size={30} /><strong style={{ display: "block", color: "var(--cc-ink)", fontSize: 17 }}>{title}</strong><p style={{ marginTop: 6 }}>{detail}</p>{action && <div style={{ marginTop: 18 }}>{action}</div>}</div>;
}

export function Loading() {
  return <div className="cc-loading"><div><div className="cc-spinner" style={{ margin: "0 auto 12px" }} /><span>Loading Control Center</span></div></div>;
}

export function SetupError({ error }: { error: Error }) {
  const migrationMissing = /relation .* does not exist|customers:|schema cache/i.test(error.message);
  return (
    <div className="cc-page">
      <PageHeader title="Control Center" subtitle="The authenticated workspace is protected and ready for its database foundation." />
      <div className="cc-error">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <AlertTriangle size={21} className="cc-red" />
          <div>
            <strong>{migrationMissing ? "Control Center migration required" : "Control Center could not load"}</strong>
            <p className="cc-muted" style={{ marginTop: 5, lineHeight: 1.45 }}>
              {migrationMissing
                ? "Lovable must apply 20260826230000_phase05_control_center.sql after the approved Ticket safety migration. No mock records are being substituted."
                : error.message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children, actions }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="cc-sheet-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="cc-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="cc-sheet-head"><h2>{title}</h2><IconButton label="Close" icon={X} onClick={onClose} /></header>
        <div className="cc-sheet-body">{children}</div>
        {actions && <footer className="cc-sheet-actions">{actions}</footer>}
      </section>
    </div>
  );
}

function scoreCustomer(customer: Customer, query: string) {
  const q = query.toLowerCase().trim();
  const name = customer.name.toLowerCase();
  const phone = (customer.phone ?? "").replace(/\D/g, "");
  const email = (customer.email ?? "").toLowerCase();
  const digits = q.replace(/\D/g, "");
  if (name === q || phone === digits || email === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/\s+/).some((part) => part.startsWith(q))) return 2;
  if ((digits && phone.startsWith(digits)) || email.startsWith(q)) return 3;
  if (name.includes(q) || (digits && phone.includes(digits)) || email.includes(q)) return 4;
  return 99;
}

export function CustomerPicker({ customers, value, onChange, allowCreate = false, onCreate }: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  allowCreate?: boolean;
  onCreate?: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputId = useId();
  const selected = customers.find((customer) => customer.id === value);
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return customers.map((customer) => ({ customer, score: scoreCustomer(customer, query) }))
      .filter((entry) => entry.score < 99)
      .sort((a, b) => a.score - b.score || new Date(b.customer.last_activity_at).getTime() - new Date(a.customer.last_activity_at).getTime())
      .slice(0, 8)
      .map((entry) => entry.customer);
  }, [customers, query]);

  if (selected) {
    return <div className="cc-picker-selected"><div><strong>{selected.name}</strong><div className="cc-muted" style={{ marginTop: 3, fontSize: 13 }}>{selected.phone || selected.email || "Customer record"}</div></div><Button compact onClick={() => { onChange(""); setQuery(""); }}>Change</Button></div>;
  }

  const choose = (customer: Customer) => {
    onChange(customer.id);
    setQuery("");
    setOpen(false);
  };
  return (
    <div className="cc-picker">
      <label className="cc-label" htmlFor={inputId} style={{ display: "block", marginBottom: 8 }}>Customer</label>
      <div className="cc-search"><Search size={18} /><input
        id={inputId}
        className="cc-input"
        value={query}
        placeholder="Search customer"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && !!query}
        aria-controls={`${inputId}-results`}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0))); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
          if (event.key === "Enter" && matches[active]) { event.preventDefault(); choose(matches[active]); }
          if (event.key === "Escape") setOpen(false);
        }}
      /></div>
      {open && query.trim() && (
        <div className="cc-picker-results" id={`${inputId}-results`} role="listbox">
          {matches.map((customer, index) => <button
            key={customer.id}
            className="cc-picker-option"
            data-active={active === index}
            role="option"
            aria-selected={active === index}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(customer)}
          ><strong>{customer.name}</strong><span>{[customer.phone, customer.email].filter(Boolean).join(" · ")}</span></button>)}
          {matches.length === 0 && <div style={{ padding: 15 }}><strong>No customer found</strong>{allowCreate && onCreate && <Button compact className="w-full" style={{ marginTop: 10 }} onClick={() => onCreate(query)}>Create new customer</Button>}</div>}
        </div>
      )}
    </div>
  );
}

type MoneyPeriod = "7D" | "MTD" | "LAST";
function periodStart(period: MoneyPeriod) {
  const now = new Date();
  if (period === "7D") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  if (period === "MTD") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}
function periodEnd(period: MoneyPeriod) {
  const now = new Date();
  return period === "LAST" ? new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) : now;
}
export function periodPayments(payments: Payment[], period: MoneyPeriod) {
  const start = periodStart(period).getTime();
  const end = periodEnd(period).getTime();
  return payments.filter((payment) => !payment.voided_at && new Date(payment.received_at).getTime() >= start && new Date(payment.received_at).getTime() <= end);
}

export function CollectedChart({ payments, period }: { payments: Payment[]; period: MoneyPeriod }) {
  const [selected, setSelected] = useState<number | null>(null);
  const points = useMemo(() => {
    const start = periodStart(period);
    const end = periodEnd(period);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const result: Array<{ date: Date; value: number }> = [];
    while (cursor <= end && result.length < 40) {
      const day = dateKey(cursor);
      result.push({
        date: new Date(cursor),
        value: payments.filter((payment) => !payment.voided_at && dateKey(new Date(payment.received_at)) === day).reduce((sum, payment) => sum + Number(payment.amount), 0),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [payments, period]);
  useEffect(() => { setSelected(null); }, [period]);

  const width = 1000;
  const height = 180;
  const base = 166;
  const max = Math.max(1, ...points.map((point) => point.value));
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : 12 + index * ((width - 24) / (points.length - 1)),
    y: base - (point.value / max) * 136,
  }));
  const curve = coords.length ? coords.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = coords[index - 1];
    const mid = (previous.x + point.x) / 2;
    return `${path} C ${mid} ${previous.y}, ${mid} ${point.y}, ${point.x} ${point.y}`;
  }, "") : "";
  const area = curve ? `${curve} L ${coords.at(-1)?.x} ${base} L ${coords[0].x} ${base} Z` : "";
  const active = selected ?? Math.max(0, points.findLastIndex((point) => point.value > 0));
  const marker = coords[active];
  const activePoint = points[active];

  return (
    <div
      className="cc-chart"
      role="img"
      aria-label={`Collected per day, biggest day ${money(max)}`}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        setSelected(Math.round(ratio * Math.max(points.length - 1, 0)));
      }}
      onPointerLeave={() => setSelected(null)}
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`collected-${period}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fcbff" stopOpacity=".72" />
            <stop offset=".32" stopColor="#8fcbff" stopOpacity=".42" />
            <stop offset=".72" stopColor="#5fa9e8" stopOpacity=".13" />
            <stop offset="1" stopColor="#5fa9e8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path key={period} d={area} fill={`url(#collected-${period})`} style={{ animation: "cc-fade .55s ease-out" }} />
        <line x1="12" x2="988" y1={base} y2={base} stroke="rgba(255,255,255,.08)" vectorEffect="non-scaling-stroke" />
      </svg>
      {points.map((point, index) => point.value > 0 && <span key={point.date.toISOString()} className="cc-chart-dot" style={{ left: `${(coords[index].x / width) * 100}%`, top: `${(coords[index].y / height) * 100}%`, opacity: active === index ? 1 : .55 }} />)}
      {marker && activePoint && <div className="cc-chart-tooltip" style={{ left: `${Math.max(8, Math.min(92, (marker.x / width) * 100))}%` }}><strong>{activePoint.value ? money(activePoint.value) : "Nothing in"}</strong><span>{activePoint.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}</span></div>}
    </div>
  );
}

export function SaveState({ busy, saved, error }: { busy: boolean; saved?: boolean; error?: string }) {
  if (busy) return <span className="cc-status" data-tone="ice"><LoaderCircle size={12} className="animate-spin" /> Saving</span>;
  if (error) return <span className="cc-status" data-tone="warn">Not saved</span>;
  if (saved) return <span className="cc-status" data-tone="ok"><Check size={12} /> Saved</span>;
  return null;
}

export function InlineSelect({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; label: string }) {
  return <label style={{ position: "relative", display: "inline-flex" }}><span className="sr-only">{label}</span><select className="cc-btn cc-btn-compact" style={{ appearance: "none", paddingRight: 34 }} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={15} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} /></label>;
}
