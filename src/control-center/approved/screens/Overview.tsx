import { useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CollectedChart } from '@/control-center/approved/components/money/CollectedChart'
import { AttentionLead, AttentionRow } from '@/control-center/approved/components/ui/AttentionRow'
import { QuietButton } from '@/control-center/approved/components/ui/Button'
import { NumberModule } from '@/control-center/approved/components/ui/NumberModule'
import { Panel, PanelTitle } from '@/control-center/approved/components/ui/Panel'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { SolidDivider, SolidInfoModule, SolidLabel } from '@/control-center/approved/components/ui/SolidInfoModule'
import { EmptyState, SkeletonNumber, SkeletonRow } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { SyncBanner } from '@/control-center/approved/components/ui/SyncState'
import { dateParts, splitMoney, splitTime } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { PERIOD_LABELS, type Period } from '@/control-center/approved/state/mockData'
import { JOB_CATEGORY_LABEL, formatTime } from '@/control-center/approved/state/jobsData'
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

      {/*
        The queue holds the wide column because it is the longest read on the
        screen. Past 1536px it takes even more of the width rather than letting
        the shell grow empty gutters.
      */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 lg:col-span-7 2xl:col-span-8">
          <NeedsAttention />
        </div>
        <div className="min-w-0 space-y-5 lg:col-span-5 lg:space-y-6 2xl:col-span-4">
          <Today />
          <Pipeline />
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
    <section className="surface-glass overflow-hidden rounded-block">
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
          <div key={period} className="animate-swap pb-4 lg:pb-6">
            <div className="px-5 pt-8 text-center lg:pt-10">
              <div className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-cc-muted">
                Collected
              </div>
              <div className="num-safe mt-3 flex items-start justify-center font-display display-tight tnum text-[68px] sm:text-[96px] lg:text-[116px]">
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

            <CollectedChart points={series} period={period} className="mt-1" />
          </div>

          {/*
            What is still owed, and how much of it is late. Two tinted cells so the
            supporting layer groups as one band under the hero, and the overdue
            cell warms up only when something is actually late.
          */}
          <div className="grid grid-cols-2 gap-px border-t border-white/[0.07] bg-white/[0.07]">
            <div className="bg-[#141418]/60 px-5 py-5 lg:px-7 lg:py-6">
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
                  ? 'bg-mt-red/[0.07] px-5 py-5 lg:px-7 lg:py-6'
                  : 'bg-[#141418]/60 px-5 py-5 lg:px-7 lg:py-6'
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
 * Top five on the Overview, View All expands the full queue in place.
 * The most urgent NOW item is promoted into a solid red module.
 */
function NeedsAttention() {
  const {
    visibleAttention,
    openCount,
    snoozeAttention,
    lastAction,
    undoLastAction,
    booting,
  } = useAppState()
  const navigate = useNavigate()

  const [lead, ...rest] = visibleAttention
  const promoteLead = lead?.priority === 'NOW'
  const rows = promoteLead ? rest : visibleAttention

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
          <QuietButton size="sm" onClick={() => navigate('/admin/attention')}>
            View all
          </QuietButton>
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
                onAction={() => navigate(item.action.to, { state: { attention: toEntry(item) } })}
                onSnooze={() => snoozeAttention(item.id)}
              />
            ))}
          </div>
          {openCount > 5 && (
            <button
              type="button"
              onClick={() => navigate('/admin/attention')}
              className="row-hover flex h-12 w-full items-center border-t border-white/[0.07] px-5 text-left font-label text-[13px] font-semibold uppercase tracking-[0.12em] text-cc-muted hover:bg-white/[0.04] hover:text-ink"
            >
              {openCount - 5} more waiting
            </button>
          )}
        </div>
      )}
    </Panel>
  )
}

/** Today. The icy blue schedule anchor, and the strongest color field on the screen. */
function Today() {
  const { todayJobs, booting, customerById } = useAppState()
  const navigate = useNavigate()
  const today = dateParts()

  if (booting) {
    return <div className="h-[268px] animate-pulse-soft rounded-block bg-white/[0.05]" />
  }

  return (
    <SolidInfoModule tone="iceLit">
      <div className="flex items-start justify-between gap-4 p-5 lg:p-6">
        <div>
          <SolidLabel>Today</SolidLabel>
          <div className="mt-2.5 flex items-end gap-3">
            <span className="num-safe font-display display-tight text-[64px]">{today.day}</span>
            <div className="pb-2.5">
              <div className="font-label text-[15px] font-semibold uppercase tracking-[0.16em]">
                {today.month}
              </div>
              <div className="font-label text-[13px] font-semibold uppercase tracking-[0.14em] text-white/65">
                {today.weekday}
              </div>
            </div>
          </div>
        </div>
        <StatusPill tone="onSolid" size="sm">
          {todayJobs.length} jobs
        </StatusPill>
      </div>

      <SolidDivider />

      {todayJobs.length === 0 ? (
        <div className="px-5 py-8 text-center text-[15px] text-canvas/75">
          Nothing on the calendar today.
        </div>
      ) : (
        todayJobs.map((job, index) => {
          const time = splitTime(formatTime(job))
          return (
            <div key={job.id}>
              {index > 0 && <SolidDivider />}
              <button
                type="button"
                onClick={() => navigate(`/admin/jobs/${job.id}`)}
                className="row-hover row-hover-solid flex min-h-[66px] w-full items-center gap-4 px-5 py-3 text-left hover:bg-canvas/10 active:bg-canvas/15 lg:px-6"
              >
                <span className="w-[62px] shrink-0">
                  <span className="num-safe block font-display display-tight text-[21px]">
                    {time.time}
                  </span>
                  <span className="block font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-white/65">
                    {time.meridiem}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {customerById(job.customerId)?.name ?? 'Unknown'}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="min-w-0 truncate text-[13px] text-canvas/70">
                      {JOB_CATEGORY_LABEL[job.category]}, {job.address}
                    </span>
                    {job.status === 'IN_PROGRESS' && (
                      <StatusPill tone="onSolid" size="sm" className="shrink-0">
                        In progress
                      </StatusPill>
                    )}
                  </span>
                </span>
              </button>
            </div>
          )
        })
      )}

      <SolidDivider />
      <button
        type="button"
        onClick={() => navigate('/admin/jobs')}
        className="row-hover w-full px-5 py-3.5 text-left font-label text-[13px] font-semibold uppercase tracking-[0.14em] text-canvas/75 hover:bg-canvas/10 hover:text-canvas lg:px-6"
      >
        Open the calendar
      </button>
    </SolidInfoModule>
  )
}

/**
 * Pipeline.
 * One dominant value carries the module and three supporting counts sit beneath it.
 * Deliberately not four equal cards and not a flat list.
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

  const quoteValue = splitMoney(pipeline.openQuoteValue)
  const counts = [
    { key: 'leads', label: 'New Leads', value: pipeline.newLeads, to: '/admin/leads' },
    { key: 'quotes', label: 'Open Quotes', value: pipeline.openQuotes, to: '/admin/leads' },
    { key: 'jobs', label: 'Scheduled Jobs', value: pipeline.scheduledJobs, to: '/admin/jobs' },
  ]

  return (
    <Panel title="Pipeline" padded={false}>
      <button
        type="button"
        onClick={() => navigate('/admin/leads')}
        className="row-hover w-full border-y border-white/[0.07] bg-ice/[0.05] px-5 py-5 text-left hover:bg-ice/[0.09] lg:px-6"
      >
        <div className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-cc-muted">
          Open Quote Value
        </div>
        <div className="num-safe mt-1.5 flex items-start font-display display-tight tnum text-[46px] text-ice sm:text-[54px]">
          <span className="mr-0.5 mt-[0.2em] text-[0.4em] text-cc-muted">{quoteValue.symbol}</span>
          {quoteValue.amount}
        </div>
        <div className="mt-1.5 text-[14px] text-cc-muted">
          across {pipeline.openQuotes} open quotes
        </div>
      </button>

      <div className="grid grid-cols-3 gap-px bg-white/[0.07]">
        {counts.map((count) => (
          <button
            key={count.key}
            type="button"
            onClick={() => navigate(count.to)}
            className="row-hover min-h-[92px] bg-[#141418]/50 px-4 py-4 text-left hover:bg-white/[0.06]"
          >
            <div className="num-safe font-display display-tight tnum text-[30px]">
              {count.value}
            </div>
            <div className="mt-1.5 font-label text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] text-cc-muted">
              {count.label}
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}
