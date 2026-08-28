import { useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CollectedChart } from '@/control-center/approved/components/money/CollectedChart'
import { AttentionLead, AttentionRow } from '@/control-center/approved/components/ui/AttentionRow'
import { QuietButton } from '@/control-center/approved/components/ui/Button'
import { NumberModule } from '@/control-center/approved/components/ui/NumberModule'
import { Panel, PanelTitle } from '@/control-center/approved/components/ui/Panel'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { SolidInfoModule, SolidLabel } from '@/control-center/approved/components/ui/SolidInfoModule'
import { EmptyState, SkeletonNumber, SkeletonRow } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { SyncBanner } from '@/control-center/approved/components/ui/SyncState'
import { splitMoney } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { PERIOD_LABELS, type Period } from '@/control-center/approved/state/mockData'
import { dateKey, formatTime, parseDateKey } from '@/control-center/approved/state/jobsData'
import { collectedSeries } from '@/control-center/approved/state/moneyData'
import { toEntry } from '@/control-center/approved/state/attention'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7D', label: '7 Days' },
  { value: 'MTD', label: 'MTD' },
  { value: 'LAST_MONTH', label: 'Last Month' },
]

export function Overview() {
  const { sync, queued } = useAppState()

  return (
    <div className="animate-page space-y-5 lg:space-y-6">
      <SyncBanner status={sync} queued={queued} className="lg:hidden" />

      <MoneySnapshot />

      <Pipeline />

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 lg:col-span-8">
          <NeedsAttention />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <NextScheduledDate />
        </div>
      </div>
    </div>
  )
}

/**
 * The money hero.
 *
 * Collected is the hero, with the Monkey Trucking red area built from the same payment
 * records that produce the figure, so the days in the area add up to the number
 * beside it. Outstanding and overdue sit under it as real supporting information.
 * Worker pay is not here on purpose: it lives in Money, Worker Pay, and does not
 * belong in the executive read of how much came in and how much is still owed.
 *
 * Profit is never shown. The system does not track every expense.
 */
function MoneySnapshot() {
  const { money, period, setPeriod, payments, booting, moneyLoading } = useAppState()
  const loading = booting || moneyLoading
  const collected = splitMoney(money.collected)
  const series = useMemo(() => collectedSeries({ period, payments }), [payments, period])

  return (
    <section className="surface-glass cc-line-field overflow-hidden rounded-[26px]">
      {/*
        Period control sits at the top, in easy reach of a thumb on a phone.
        The section label is deliberately brighter and wider than the metric
        labels below it, so Money reads as the heading and Collected reads as the
        thing being measured.
      */}
      <header className="flex flex-col gap-3.5 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between lg:px-7 lg:pt-6">
        <PanelTitle primary>Money</PanelTitle>
        <SegmentControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          size="sm"
          className="w-full sm:w-auto"
          fullWidth
        />
      </header>

      {loading ? (
        <div className="px-5 py-7 lg:px-7">
          <SkeletonNumber size="xl" />
          <div className="mt-8 h-[180px] animate-pulse-soft rounded-xl bg-white/[0.05] sm:h-[220px] lg:h-[260px]" />
        </div>
      ) : (
        <>
          {/*
            The figure is centred and the curve runs the full width underneath it,
            so the module reads as one composition instead of a number sitting
            next to a chart. The hero carries a slight forward lean, which is the
            only place in the product that does.
          */}
          <div key={period} className="animate-swap pb-5 lg:pb-7">
            <div className="px-5 pt-9 text-center lg:pt-12">
              <div className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-cc-muted">
                Collected
              </div>
              <div className="num-safe mt-3 flex items-start justify-center font-display display-tight tnum text-[72px] sm:text-[104px] lg:text-[132px]">
                <span className="display-racing inline-flex items-start">
                  <span className="mr-1.5 mt-[0.22em] text-[0.34em] text-cc-muted">
                    {collected.symbol}
                  </span>
                  <span>{collected.amount}</span>
                </span>
              </div>
              <div className="mt-3.5 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
                {PERIOD_LABELS[period]}
                <span className="px-2 text-idle">/</span>
                {money.collectedCount} {money.collectedCount === 1 ? 'payment' : 'payments'}
              </div>
            </div>

            <CollectedChart points={series} period={period} className="mt-2" />
          </div>

          {/*
            What is still owed, and how much of it is late. Two tinted cells so the
            supporting layer groups as one band under the hero, and the overdue
            cell warms up only when something is actually late.
          */}
          <div className="cc-segment-band grid grid-cols-2 border-t border-white/[0.07]">
            <div className="cc-segment px-5 py-5 lg:px-7 lg:py-6">
              <NumberModule
                label="Outstanding"
                symbol="$"
                value={splitMoney(money.outstanding).amount}
                size="md"
                sub={`${money.outstandingCount} open right now`}
              />
            </div>
            <div
              className={
                money.overdue > 0
                  ? 'cc-segment bg-mt-red/[0.07] px-5 py-5 lg:px-7 lg:py-6'
                  : 'cc-segment px-5 py-5 lg:px-7 lg:py-6'
              }
            >
              <NumberModule
                label="Overdue"
                symbol="$"
                value={splitMoney(money.overdue).amount}
                size="md"
                accent={money.overdue > 0 ? 'red' : 'muted'}
                sub={`${money.overdueCount} past due`}
              />
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Needs Attention.
 * Four items on first read. See all expands in place to six, keeping the Overview
 * useful without turning it into the full queue screen.
 * The most urgent NOW item is promoted into a solid red module.
 */
function NeedsAttention() {
  const {
    attention,
    openCount,
    snoozeAttention,
    lastAction,
    undoLastAction,
    booting,
  } = useAppState()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const shown = attention.slice(0, expanded ? 6 : 4)
  const [lead, ...rest] = shown
  const promoteLead = lead?.priority === 'NOW'
  const rows = promoteLead ? rest : shown

  return (
    <Panel
      className="h-full"
      padded={false}
      title={<PanelTitle tone={openCount > 0 ? 'red' : 'ok'}>Needs Attention</PanelTitle>}
      right={
        <div className="flex items-center gap-2">
          <StatusPill tone="neutral" size="sm">
            {openCount} open
          </StatusPill>
          {openCount > 4 && (
            <QuietButton size="sm" onClick={() => setExpanded((current) => !current)}>
              {expanded ? 'Show less' : 'See all'}
            </QuietButton>
          )}
        </div>
      }
      footer={
        lastAction ? (
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-[14px] text-cc-muted">
              <span className="font-semibold text-ink">{lastAction.item.title}</span>
              {' will come back later.'}
            </span>
            <QuietButton size="sm" onClick={undoLastAction} className="shrink-0">
              Undo
            </QuietButton>
          </div>
        ) : undefined
      }
    >
      {booting ? (
        <div className="divide-y divide-white/[0.07]">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : openCount === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" strokeWidth={2} />}
          title="All clear"
          line="Nothing is waiting on you. New items show up here the moment something needs a decision."
        />
      ) : (
        <div>
          {promoteLead && lead && (
            <div className="px-5 pb-4">
              <AttentionLead
                item={lead}
                subject={attentionSubject(lead)}
                onAction={() => navigate(lead.action.to, { state: { attention: toEntry(lead) } })}
                onSnooze={() => snoozeAttention(lead.id)}
              />
            </div>
          )}
          <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
            {rows.map((item) => (
              <AttentionRow
                key={item.id}
                item={item}
                subject={attentionSubject(item)}
                onAction={() => navigate(item.action.to, { state: { attention: toEntry(item) } })}
                onSnooze={() => snoozeAttention(item.id)}
              />
            ))}
          </div>
          {expanded && openCount > 6 && (
            <button
              type="button"
              onClick={() => navigate('/admin/attention')}
              className="row-hover flex h-12 w-full items-center border-t border-white/[0.07] px-5 text-left font-label text-[13px] font-semibold uppercase tracking-[0.12em] text-cc-muted hover:bg-white/[0.04] hover:text-ink"
            >
              Open full queue, {openCount - 6} more waiting
            </button>
          )}
        </div>
      )}
    </Panel>
  )
}

function attentionSubject(item: ReturnType<typeof useAppState>['attention'][number]) {
  const waiting = item.title.match(/^(.+?) is waiting/)
  if (waiting?.[1]) return waiting[1]
  const first = item.context.split(/[,.]/)[0]?.trim()
  if (first && first.length <= 42 && !/^(the |openai|stripe|anything|customer)/i.test(first)) return first
  return item.kind === 'ai_failure' ? 'Communication & AI' : 'Control Center'
}

/** The nearest real scheduled job, not a second calendar or duplicated store. */
function NextScheduledDate() {
  const { jobs, booting, customerById } = useAppState()
  const navigate = useNavigate()
  const today = dateKey(new Date())
  const next = useMemo(
    () => jobs
      .filter((job) => job.status === 'SCHEDULED' && job.date >= today)
      .sort((a, b) => `${a.date}-${a.time ?? '00:00'}`.localeCompare(`${b.date}-${b.time ?? '00:00'}`))[0],
    [jobs, today],
  )

  if (booting) {
    return <div className="h-[290px] animate-pulse-soft rounded-block bg-white/[0.05]" />
  }

  const date = next ? parseDateKey(next.date) : null
  const isToday = next?.date === today

  return (
    <SolidInfoModule tone="iceLit" className="h-full min-h-[290px]">
      <div className="flex h-full flex-col p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <SolidLabel>Next Scheduled Date</SolidLabel>
          <CalendarDays className="h-5 w-5 opacity-65" strokeWidth={2.1} />
        </div>

        {next && date ? (
          <>
            <div className="mt-8 flex items-end gap-3">
              <span className="num-safe font-display display-tight text-[74px] lg:text-[88px]">{date.getDate()}</span>
              <div className="pb-3">
                <div className="font-label text-[16px] font-bold uppercase tracking-[0.16em]">
                  {date.toLocaleDateString('en-US', { month: 'short' })}
                </div>
                <div className="font-label text-[12px] font-bold uppercase tracking-[0.14em] text-canvas/65">
                  {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
              </div>
            </div>
            <div className="mt-auto border-t border-canvas/15 pt-5">
              <div className="text-[17px] font-bold leading-tight">
                {customerById(next.customerId)?.name ?? 'Unknown customer'}
              </div>
              <div className="mt-1 text-[14px] leading-snug text-canvas/70">
                {formatTime(next)} / {next.address}
              </div>
            </div>
          </>
        ) : (
          <div className="my-auto py-10 text-center">
            <div className="font-display text-[34px] uppercase">Calendar clear</div>
            <p className="mt-2 text-[14px] text-canvas/70">No scheduled work is waiting.</p>
          </div>
        )}

      <button
        type="button"
        onClick={() => navigate(next ? `/admin/jobs/${next.id}` : '/admin/jobs')}
        className="mt-5 flex h-12 w-full items-center justify-between rounded-xl border border-canvas/20 bg-canvas/10 px-4 font-label text-[13px] font-bold uppercase tracking-[0.13em] transition-colors hover:bg-canvas/20"
      >
        {next ? 'Open Job' : 'Open Calendar'}
        <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} />
      </button>
      </div>
    </SolidInfoModule>
  )
}

/**
 * Pipeline.
 * One horizontal operational snapshot. Exactly three stages, each with one real
 * count and a proportional bar. No decorative or duplicated value competes.
 */
function Pipeline() {
  // Reads the real lead, quote and job records, so sending a quote or booking a
  // date moves these numbers.
  const { pipeline, booting } = useAppState()
  const navigate = useNavigate()

  if (booting) {
    return (
      <Panel title="Pipeline">
        <div className="space-y-3">
          <div className="h-24 animate-pulse-soft rounded-xl bg-white/[0.05]" />
          <div className="h-16 animate-pulse-soft rounded-xl bg-white/[0.05]" />
        </div>
      </Panel>
    )
  }

  const counts = [
    { key: 'leads', label: 'New Leads', value: pipeline.newLeads, to: '/admin/leads' },
    { key: 'quotes', label: 'Open Quotes', value: pipeline.openQuotes, to: '/admin/leads' },
    { key: 'jobs', label: 'Scheduled Jobs', value: pipeline.scheduledJobs, to: '/admin/jobs' },
  ]
  const max = Math.max(...counts.map((count) => count.value), 1)

  return (
    <Panel title="Pipeline" padded={false} className="cc-line-field">
      <div className="grid border-t border-white/[0.07] md:grid-cols-3">
        {counts.map((count, index) => (
          <button
            key={count.key}
            type="button"
            onClick={() => navigate(count.to)}
            className={`row-hover min-h-[132px] px-5 py-5 text-left transition-colors hover:bg-white/[0.04] lg:px-6 ${index > 0 ? 'border-t border-white/[0.07] md:border-l md:border-t-0' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-label text-[11px] font-bold uppercase tracking-[0.17em] text-cc-muted">
                  {count.label}
                </div>
                <div className="num-safe mt-2 font-display display-tight tnum text-[42px] text-ink">
                  {count.value}
                </div>
              </div>
              <ArrowUpRight className="mt-1 h-4 w-4 text-ice opacity-70" strokeWidth={2.2} />
            </div>
            <div className="pipeline-meter mt-5">
              <span style={{ width: count.value === 0 ? '0%' : `${Math.max(10, (count.value / max) * 100)}%` }} />
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}
