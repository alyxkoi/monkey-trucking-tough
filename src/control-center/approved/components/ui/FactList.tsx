import { Check } from 'lucide-react'
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
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
          Known information
        </div>
        <dl className="mt-3 space-y-2.5">
          {known.length === 0 && (
            <div className="text-[15px] text-cc-muted">Nothing extracted yet.</div>
          )}
          {known.map((fact) => (
            <div key={fact.label} className="flex gap-3">
              <Check className="mt-1 h-4 w-4 shrink-0 text-ok" strokeWidth={2.6} />
              <div className="min-w-0">
                <dt className="font-label text-[11px] font-semibold uppercase tracking-[0.14em] text-cc-muted">
                  {fact.label}
                </dt>
                <dd className="text-[15px] leading-snug text-ink">{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
          Still missing
        </div>
        <ul className="mt-3 space-y-2.5">
          {missing.length === 0 && (
            <li className="text-[15px] text-cc-muted">Nothing outstanding.</li>
          )}
          {missing.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-[9px] h-1.5 w-3 shrink-0 rounded-full bg-warn" />
              <span className="text-[15px] leading-snug text-ink/85">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
