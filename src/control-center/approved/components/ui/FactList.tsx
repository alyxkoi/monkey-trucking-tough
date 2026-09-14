import { Check, CircleHelp } from 'lucide-react'
import type { KnownFact } from '@/control-center/approved/state/salesData'

/**
 * What the AI already extracted, and what is still missing.
 * This pair is the reason the AI never asks a customer something they already
 * answered: the known column is read before anything is sent.
 */
export function KnownAndMissing({
  known,
  missing,
}: {
  known: KnownFact[]
  missing: string[]
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label="AI customer detail summary">
      <section className="rounded-xl border border-ok/20 bg-ok/[0.055] p-4" aria-labelledby="confirmed-details-heading">
        <header className="flex items-center gap-3 border-b border-white/[0.07] pb-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ok/15 text-ok">
            <Check className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="confirmed-details-heading" className="text-[15px] font-bold leading-tight text-ink">
              Confirmed
            </h3>
            <p className="mt-0.5 text-[12px] leading-tight text-cc-muted">
              {known.length} {known.length === 1 ? 'detail' : 'details'} collected
            </p>
          </div>
        </header>
        <dl className="mt-1 divide-y divide-white/[0.07]">
          {known.length === 0 && (
            <div className="py-3 text-[14px] leading-snug text-cc-muted">No confirmed details yet.</div>
          )}
          {known.map((fact) => (
            <div key={fact.label} className="py-3 first:pt-2.5 last:pb-1">
              <dt className="font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-cc-muted">
                {fact.label}
              </dt>
              <dd className="mt-1 break-words text-[15px] font-semibold leading-snug text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-warn/20 bg-warn/[0.055] p-4" aria-labelledby="needed-details-heading">
        <header className="flex items-center gap-3 border-b border-white/[0.07] pb-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warn/15 text-warn">
            <CircleHelp className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="needed-details-heading" className="text-[15px] font-bold leading-tight text-ink">
              Still needed
            </h3>
            <p className="mt-0.5 text-[12px] leading-tight text-cc-muted">
              {missing.length} {missing.length === 1 ? 'detail' : 'details'} outstanding
            </p>
          </div>
        </header>
        <ul className="mt-1 divide-y divide-white/[0.07]">
          {missing.length === 0 && (
            <li className="py-3 text-[14px] font-medium leading-snug text-ok">
              {known.length > 0 ? 'All needed details collected.' : 'No missing details identified yet.'}
            </li>
          )}
          {missing.map((item) => (
            <li key={item} className="flex gap-2.5 py-3 first:pt-2.5 last:pb-1">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-warn" strokeWidth={2.2} aria-hidden="true" />
              <span className="text-[14px] font-medium leading-snug text-ink/90">{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
