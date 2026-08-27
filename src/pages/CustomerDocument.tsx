import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'

type QuoteDocument = {
  type: 'QUOTE'; number: string; status: string; createdAt: string; acceptedAt: string | null
  customerName: string; description: string; address: string; notes: string | null
  items: Array<{ id: string; kind: string; description: string; loads: number | null; yards: number | null; is_full_load: boolean; line_total: number }>
  delivery: null | { type: string; miles: number | null; loads: number; feePerLoad: number; total: number }
  totals: { materials: number; customWork: number; taxRate: number; tax: number; total: number }
}

type InvoiceDocument = {
  type: 'INVOICE'; number: string; status: string; issuedAt: string | null; dueAt: string | null; paidAt: string | null
  customerName: string; description: string; job: null | { description: string; address: string }
  ticketNumbers: string[]; amountSource: string; amount: number; amountPaid: number; amountDue: number; disputed: boolean
  items: Array<{ id: string; kind: string; description: string; loads?: number | null; yards?: number | null; is_full_load?: boolean; line_total: number }>
  sourceTotals: null | { materials_subtotal?: number; custom_work_subtotal?: number; delivery_total?: number; tax_rate?: number; tax_amount?: number }
  payments: Array<{ id: string; amount: number; method: string; received_at: string }>
}

type CustomerDocument = QuoteDocument | InvoiceDocument

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : 'Not set'

function DocumentShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0d0e10] px-4 py-8 text-[#f3f3f1] sm:px-6 sm:py-12">
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="mx-auto w-full max-w-[680px]">
        <header className="mb-8 text-center">
          <img src="https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/email-assets//MT-LOGO.png" alt="Monkey Trucking" className="mx-auto h-auto w-[132px]" />
        </header>
        {children}
        <footer className="mt-10 border-t border-white/10 pt-7 text-center text-xs text-[#73767d]">
          <p className="font-semibold text-[#d0d1ce]">Monkey Trucking LLC</p>
          <p className="mt-1">7653 S FM 148 · Kaufman, TX 75142</p>
          <p className="mt-4"><a className="hover:text-white" href="/privacy-policy">Privacy Policy</a><span className="mx-2">·</span><a className="hover:text-white" href="/terms">Terms &amp; Conditions</a></p>
        </footer>
      </div>
    </main>
  )
}

function Failure({ message }: { message: string }) {
  return <DocumentShell><section className="rounded-2xl border border-white/10 bg-[#15161a] p-7 text-center"><h1 className="text-2xl font-extrabold uppercase tracking-tight">Document unavailable</h1><p className="mt-3 text-[#9b9da3]">{message}</p></section></DocumentShell>
}

function Loading() {
  return <DocumentShell><div aria-label="Loading document" className="space-y-4"><div className="mx-auto h-5 w-36 animate-pulse rounded bg-white/10" /><div className="h-44 animate-pulse rounded-2xl bg-white/[0.06]" /><div className="h-64 animate-pulse rounded-2xl bg-white/[0.06]" /></div></DocumentShell>
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-5 border-b border-white/[0.08] py-3.5 last:border-0"><dt className="text-xs font-bold uppercase tracking-[.14em] text-[#8e9198]">{label}</dt><dd className="min-w-0 text-right text-sm font-semibold text-[#f4f4f2]">{value}</dd></div>
}

export function PublicQuote() {
  const { token = '' } = useParams()
  const [document, setDocument] = useState<QuoteDocument | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [accepting, setAccepting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke('customer-document', { body: { action: 'VIEW', documentType: 'QUOTE', token } })
    if (error || !data?.available || data.document?.type !== 'QUOTE') setMessage(data?.message ?? 'This link is no longer available.')
    else setDocument(data.document)
    setLoading(false)
  }, [token])
  useEffect(() => { void load() }, [load])

  const accept = async () => {
    setAccepting(true)
    const { data, error } = await supabase.functions.invoke('customer-document', { body: { action: 'ACCEPT', documentType: 'QUOTE', token } })
    if (error || !data?.success) setMessage(data?.error ?? 'This quote cannot be accepted right now. Please try again.')
    else await load()
    setAccepting(false)
    setConfirming(false)
  }

  if (loading) return <Loading />
  if (!document) return <Failure message={message || 'This link is no longer available.'} />
  const accepted = document.status === 'ACCEPTED'
  return (
    <DocumentShell>
      <div className="text-center"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#8FCBFF]">Quote {document.number}</p><h1 className="mt-2 text-4xl font-black uppercase tracking-[-.04em] sm:text-5xl">Your quote</h1><p className="mt-3 text-sm text-[#9b9da3]">Prepared for {document.customerName}</p></div>
      <section className="mt-7 rounded-2xl border border-white/10 bg-[#15161a] p-6 text-center sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8a8d94]">Total quote</p><p className="mt-1 text-5xl font-black tracking-[-.05em] sm:text-6xl">{money(document.totals.total)}</p><p className="mt-3 text-xs text-[#70737a]">Created {date(document.createdAt)}</p></section>
      {accepted && <div className="mt-5 rounded-xl border border-[#78D69A]/30 bg-[#78D69A] px-5 py-4 text-center font-extrabold uppercase tracking-[.12em] text-[#0B0D0C]">Quote accepted</div>}
      <section className="mt-7"><h2 className="text-xl font-bold">What’s included</h2><p className="mt-1 text-sm text-[#7f8289]">{document.description}</p><div className="mt-4 rounded-2xl border border-white/10 bg-[#121316] px-5">{document.items.map((item) => <DetailRow key={item.id} label={item.kind === 'CUSTOM_WORK' ? 'Work' : 'Material'} value={<span>{item.description}<small className="mt-1 block font-normal text-[#8e9198]">{[item.yards != null ? `${Number(item.yards)} yd` : '', item.loads != null ? `${item.loads} load${item.loads === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')} · {money(item.line_total)}</small></span>} />)}{document.delivery && <DetailRow label="Delivery" value={<span>{document.delivery.miles != null ? `${document.delivery.miles} miles` : 'Delivery'}<small className="mt-1 block font-normal text-[#8e9198]">{document.delivery.loads} load{document.delivery.loads === 1 ? '' : 's'} · {money(document.delivery.total)}</small></span>} />}{document.address && <DetailRow label="Job site" value={document.address} />}</div></section>
      <section className="mt-6 rounded-2xl border border-white/10 bg-[#15161a] px-5"><DetailRow label="Material" value={money(document.totals.materials)} />{document.totals.customWork > 0 && <DetailRow label="Custom work" value={money(document.totals.customWork)} />} {document.delivery && <DetailRow label="Delivery" value={money(document.delivery.total)} />}<DetailRow label={`Tax ${(Number(document.totals.taxRate) * 100).toFixed(2)}%`} value={money(document.totals.tax)} /><DetailRow label="Total" value={<strong className="text-xl">{money(document.totals.total)}</strong>} /></section>
      {document.notes && <section className="mt-6 rounded-2xl border border-white/10 bg-[#121316] p-5"><h2 className="text-xs font-bold uppercase tracking-[.16em] text-[#8FCBFF]">Notes</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#c3c4c0]">{document.notes}</p></section>}
      {!accepted && !confirming && <button type="button" onClick={() => setConfirming(true)} className="mt-7 min-h-12 w-full rounded-xl bg-[#ff003c] px-6 py-4 text-sm font-extrabold uppercase tracking-[.1em] text-white transition hover:bg-[#d90033]">Accept quote</button>}
      {!accepted && confirming && <section className="mt-7 rounded-2xl border border-[#ff003c]/40 bg-[#15161a] p-5 text-center"><p className="font-bold">Accept quote for {money(document.totals.total)}?</p><p className="mt-2 text-sm text-[#9b9da3]">This confirms that you approve this quote. Monkey Trucking will contact you to schedule the work.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" disabled={accepting} onClick={() => setConfirming(false)} className="min-h-12 rounded-xl border border-white/15 px-5 font-bold">Not yet</button><button type="button" disabled={accepting} onClick={() => void accept()} className="min-h-12 rounded-xl bg-[#ff003c] px-5 font-extrabold uppercase tracking-[.08em] text-white disabled:opacity-60">{accepting ? 'Accepting…' : 'Confirm acceptance'}</button></div></section>}
    </DocumentShell>
  )
}

export function PublicInvoice() {
  const { token = '' } = useParams()
  const [document, setDocument] = useState<InvoiceDocument | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { void (async () => { const { data, error } = await supabase.functions.invoke('customer-document', { body: { action: 'VIEW', documentType: 'INVOICE', token } }); if (error || !data?.available || data.document?.type !== 'INVOICE') setMessage(data?.message ?? 'This link is no longer available.'); else setDocument(data.document); setLoading(false) })() }, [token])
  if (loading) return <Loading />
  if (!document) return <Failure message={message || 'This link is no longer available.'} />
  const paid = document.status === 'PAID' && document.amountDue <= 0
  return (
    <DocumentShell>
      <div className="text-center"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#8FCBFF]">Invoice {document.number}</p><h1 className="mt-2 text-4xl font-black uppercase tracking-[-.04em] sm:text-5xl">{paid ? 'Payment receipt' : 'Your invoice'}</h1><p className="mt-3 text-sm text-[#9b9da3]">Prepared for {document.customerName}</p></div>
      <section className={`mt-7 rounded-2xl border p-6 text-center sm:p-8 ${paid ? 'border-[#6AC489] bg-[#78D69A] text-[#0B0D0C]' : 'border-white/10 bg-[#15161a]'}`}><p className={`text-[10px] font-black uppercase tracking-[.18em] ${paid ? 'text-[#183120]' : 'text-[#8a8d94]'}`}>{paid ? 'Paid' : 'Amount due'}</p><p className="mt-1 text-5xl font-black tracking-[-.05em] sm:text-6xl">{money(paid ? document.amountPaid : document.amountDue)}</p><p className={`mt-3 text-xs ${paid ? 'text-[#21422B]' : 'text-[#c69b62]'}`}>{paid ? `Received ${date(document.paidAt)}` : `Due ${date(document.dueAt)}`}</p></section>
      <section className="mt-7"><h2 className="text-xl font-bold">Invoice summary</h2><p className="mt-1 text-sm text-[#7f8289]">{document.description}</p><div className="mt-4 rounded-2xl border border-white/10 bg-[#121316] px-5">{document.job && <DetailRow label="Job" value={<span>{document.job.description}<small className="mt-1 block font-normal text-[#8e9198]">{document.job.address}</small></span>} />}{document.items.map((item) => <DetailRow key={item.id} label={item.kind === 'CUSTOM_WORK' ? 'Work' : item.kind === 'MATERIAL' ? 'Material' : 'Work'} value={<span>{item.description}<small className="mt-1 block font-normal text-[#8e9198]">{[item.yards != null ? `${Number(item.yards)} yd` : '', item.loads != null ? `${item.loads} load${item.loads === 1 ? '' : 's'}` : '', money(item.line_total)].filter(Boolean).join(' · ')}</small></span>} />)}{document.ticketNumbers.length > 0 && <DetailRow label="Tickets" value={document.ticketNumbers.join(' · ')} />}</div></section>
      <section className="mt-6 rounded-2xl border border-white/10 bg-[#15161a] px-5"><DetailRow label="Issued" value={date(document.issuedAt)} />{!paid && <DetailRow label="Due" value={date(document.dueAt)} />}{document.sourceTotals?.materials_subtotal != null && <DetailRow label="Material" value={money(document.sourceTotals.materials_subtotal)} />}{Number(document.sourceTotals?.custom_work_subtotal ?? 0) > 0 && <DetailRow label="Custom work" value={money(Number(document.sourceTotals?.custom_work_subtotal))} />}{Number(document.sourceTotals?.delivery_total ?? 0) > 0 && <DetailRow label="Delivery" value={money(Number(document.sourceTotals?.delivery_total))} />}{document.sourceTotals?.tax_amount != null && <DetailRow label={`Tax ${(Number(document.sourceTotals.tax_rate ?? 0) * 100).toFixed(2)}%`} value={money(Number(document.sourceTotals.tax_amount))} />}<DetailRow label="Invoice total" value={<strong className="text-xl">{money(document.amount)}</strong>} /></section>
      {paid && document.payments.map((payment) => <section key={payment.id} className="mt-6 rounded-2xl border border-[#78D69A]/25 bg-[#121316] px-5"><DetailRow label="Payment method" value={payment.method.replaceAll('_', ' ')} /><DetailRow label="Payment date" value={date(payment.received_at)} /><DetailRow label="Amount received" value={money(payment.amount)} /></section>)}
      {!paid && <p className="mt-7 text-center text-sm leading-relaxed text-[#8e9198]">This invoice is for review only. Payment instructions are handled directly by Monkey Trucking.</p>}
    </DocumentShell>
  )
}
