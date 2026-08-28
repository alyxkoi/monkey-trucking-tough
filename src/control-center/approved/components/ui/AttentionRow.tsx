import { StatusPill, type PillTone } from './StatusPill'
import { PrimaryButton, QuietButton, SecondaryButton } from './Button'
import { SolidInfoModule } from './SolidInfoModule'
import { usd, waitingFor } from '@/control-center/approved/lib/format'
import { cn } from '@/control-center/approved/lib/cn'
import type { AttentionItem, Priority } from '@/control-center/approved/state/attention'

const PILL: Record<Priority, { tone: PillTone; label: string }> = {
  NOW: { tone: 'now', label: 'Now' },
  TODAY: { tone: 'today', label: 'Today' },
  FOLLOW_UP: { tone: 'followup', label: 'Follow up' },
}

/**
 * Attention row. One item, one clear action, plus a quiet way to push it out.
 *
 * Every row now uses the same action styling. Urgency is carried by the priority
 * chip on the left, not by giving some rows a different coloured button, so a
 * scan down the queue reads the chips rather than trying to rank three button
 * treatments against each other.
 */
export function AttentionRow({
  item,
  subject,
  onAction,
  onSnooze,
}: {
  item: AttentionItem
  subject?: string
  onAction: () => void
  onSnooze: () => void
}) {
  const pill = PILL[item.priority]

  return (
    <div className="row-hover animate-rise px-5 py-4 hover:bg-white/[0.03]">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <StatusPill tone={pill.tone} size="sm" className="mt-0.5">
            {pill.label}
          </StatusPill>
          <div className="min-w-0">
            {subject && (
              <div className="mb-1 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-ice">
                {subject}
              </div>
            )}
            <div className="text-[16px] font-semibold leading-snug text-ink">
              {item.title}
            </div>
            <div className="mt-1 text-[14px] leading-snug text-cc-muted">{item.context}</div>
            <div className="mt-2 flex items-center gap-2.5 font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-cc-muted">
              <span>{waitingFor(item.since)}</span>
              {item.amount !== undefined && (
                <>
                  <span className="text-idle">/</span>
                  <span className="tnum text-ink">{usd(item.amount)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:pl-4">
          <PrimaryButton size="sm" onClick={onAction}>
            {item.action.label}
          </PrimaryButton>
          <QuietButton size="sm" onClick={onSnooze}>
            Remind later
          </QuietButton>
        </div>
      </div>
    </div>
  )
}

/**
 * The single most urgent item is promoted out of the list and rendered as a bold
 * solid red module. This is the one place red becomes a full color field.
 */
export function AttentionLead({
  item,
  subject,
  onAction,
  onSnooze,
}: {
  item: AttentionItem
  subject?: string
  onAction: () => void
  onSnooze: () => void
}) {
  return (
    <SolidInfoModule tone="red" className="animate-rise">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusPill tone="onSolid" size="sm">
            {PILL[item.priority].label}
          </StatusPill>
          <span className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-canvas/85">
            {waitingFor(item.since)}
          </span>
        </div>

        {subject && (
          <div className="mt-4 font-label text-[12px] font-bold uppercase tracking-[0.18em] text-canvas/75">
            {subject}
          </div>
        )}

        {/*
          Anton is reserved for numbers, dates and short statements. An attention
          title is a full sentence, so it uses Barlow at a heavy weight instead.
        */}
        <h3 className={cn('max-w-[26ch] font-control-body text-[21px] font-bold leading-[1.15] sm:text-[24px]', subject ? 'mt-1.5' : 'mt-3.5')}>
          {item.title}
        </h3>
        <p className="mt-2.5 max-w-[46ch] text-[15px] leading-snug text-canvas/90">
          {item.context}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <PrimaryButton tone="onSolid" onClick={onAction}>
            {item.action.label}
          </PrimaryButton>
          <SecondaryButton tone="onSolid" onClick={onSnooze}>
            Remind later
          </SecondaryButton>
        </div>
      </div>
    </SolidInfoModule>
  )
}
