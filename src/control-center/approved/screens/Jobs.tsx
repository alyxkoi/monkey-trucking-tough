import { useMemo, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MonthCalendar } from '@/control-center/approved/components/jobs/MonthCalendar'
import { ScheduleJobSheet } from '@/control-center/approved/components/jobs/ScheduleJobSheet'
import { PrimaryButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import {
  AttentionBanner,
  AttentionTarget,
  useAttentionEntry,
} from '@/control-center/approved/components/ui/Guidance'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SolidDivider, SolidInfoModule, SolidLabel } from '@/control-center/approved/components/ui/SolidInfoModule'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import { splitTime, usd } from '@/control-center/approved/lib/format'
import {
  JOB_CATEGORY_LABEL,
  JOB_STATUS_LABEL,
  dateKey,
  formatTime,
  parseDateKey,
  type Job,
  type JobStatus,
} from '@/control-center/approved/state/jobsData'
import { useAppState } from '@/control-center/approved/state/AppState'
import { quoteTotals, type Quote } from '@/control-center/approved/state/salesData'

const STATUS_TONE: Record<JobStatus, 'ice' | 'ok' | 'idle' | 'onSolid'> = {
  SCHEDULED: 'onSolid',
  IN_PROGRESS: 'onSolid',
  COMPLETED: 'ok',
  CANCELLED: 'idle',
}

const WEEKDAY_LONG = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

const MONTH_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]

/** Jobs is a live calendar first. The list is never the primary view. */
export function Jobs() {
  const { jobs, jobsForDay, customerById, unscheduledQuotes } = useAppState()
  const navigate = useNavigate()

  const [selected, setSelected] = useState(() => dateKey(new Date()))
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [scheduling, setScheduling] = useState<{ quote?: Quote } | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)
  const { entry, recommend, markActed } = useAttentionEntry()

  /**
   * Cancelled work leaves the active calendar. The record is never deleted, it
   * keeps its reason and its activity history, and this toggle brings it back
   * into view when someone needs to look.
   */
  const visible = useMemo(
    () => (showCancelled ? jobs : jobs.filter((job) => job.status !== 'CANCELLED')),
    [jobs, showCancelled],
  )

  const jobsByDay = useMemo(() => {
    const map = new Map<string, Job[]>()
    visible.forEach((job) => {
      const list = map.get(job.date) ?? []
      list.push(job)
      map.set(job.date, list)
    })
    return map
  }, [visible])

  const dayJobs = jobsForDay(selected).filter(
    (job) => showCancelled || job.status !== 'CANCELLED',
  )
  const cancelledCount = jobs.filter((job) => job.status === 'CANCELLED').length
  const selectedDate = parseDateKey(selected)
  const waiting = unscheduledQuotes()

  const selectDay = (day: string) => {
    setSelected(day)
    const date = parseDateKey(day)
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  return (
    <div className="space-y-5">
      {entry && <AttentionBanner entry={entry} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="platinum-muted font-label text-[13px] font-semibold uppercase tracking-[0.16em]">
            {jobs.filter((job) => job.status === 'SCHEDULED').length} scheduled
          </span>
          {cancelledCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCancelled((current) => !current)}
              className={cn(
                'flex h-11 items-center rounded-xl border px-3.5 font-label text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors',
                showCancelled
                  ? 'border-ice bg-ice text-white'
                  : 'border-line bg-raised text-cc-muted hover:text-ink',
              )}
            >
              Show cancelled
              <span className={cn('ml-2 tnum', showCancelled ? 'text-white/75' : 'text-idle')}>
                {cancelledCount}
              </span>
            </button>
          )}
        </div>
        {/*
          Accepted work with no date sends Salvador here, so the button that puts
          it on the calendar is the one that lights up.
        */}
        <AttentionTarget
          active={recommend === 'schedule'}
          priority={entry?.priority}
          onInteract={markActed}
        >
          <PrimaryButton
            onClick={() => setScheduling({})}
            icon={<CalendarPlus className="h-5 w-5" strokeWidth={2.2} />}
          >
            Schedule Job
          </PrimaryButton>
        </AttentionTarget>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <Panel padded={false} className="calendar-frost">
            <MonthCalendar
              month={month}
              selected={selected}
              jobsByDay={jobsByDay}
              onSelect={selectDay}
              onMonthChange={(delta) =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
              }
              onToday={() => {
                const today = new Date()
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                setSelected(dateKey(today))
              }}
            />
          </Panel>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-5">
          <SolidInfoModule tone="ice">
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <SolidLabel>
                  {selected === dateKey(new Date()) ? 'Today' : 'Selected day'}
                </SolidLabel>
                <div className="mt-2.5 flex items-end gap-2.5">
                  <span className="font-display display-tight text-[62px]">
                    {selectedDate.getDate()}
                  </span>
                  <div className="pb-2">
                    <div className="font-label text-[15px] font-semibold uppercase tracking-[0.16em]">
                      {MONTH_SHORT[selectedDate.getMonth()]}
                    </div>
                    <div className="font-label text-[13px] font-semibold uppercase tracking-[0.14em] text-canvas/65">
                      {WEEKDAY_LONG[selectedDate.getDay()]}
                    </div>
                  </div>
                </div>
              </div>
              <StatusPill tone="onSolid" size="sm">
                {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
              </StatusPill>
            </div>

            <SolidDivider />

            {dayJobs.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[15px] text-canvas/75">Nothing on the calendar.</p>
                <button
                  type="button"
                  onClick={() => setScheduling({})}
                  className="mt-3 h-11 font-label text-[13px] font-semibold uppercase tracking-[0.14em] text-canvas transition-opacity hover:opacity-70"
                >
                  Schedule something
                </button>
              </div>
            ) : (
              dayJobs.map((job, index) => {
                const time = splitTime(formatTime(job))
                const cancelled = job.status === 'CANCELLED'
                return (
                  <div key={job.id}>
                    {index > 0 && <SolidDivider />}
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/jobs/${job.id}`)}
                      className={cn(
                        'row-hover row-hover-solid flex min-h-[72px] w-full items-center gap-4 px-5 py-3 text-left hover:bg-canvas/10 active:bg-canvas/15',
                        cancelled && 'opacity-55',
                      )}
                    >
                      <span className="w-[62px] shrink-0">
                        <span
                          className={cn(
                            'block font-display display-tight text-[21px]',
                            cancelled && 'line-through',
                          )}
                        >
                          {time.time}
                        </span>
                        <span className="block font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-canvas/65">
                          {time.meridiem}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">
                          {customerById(job.customerId)?.name ?? 'Unknown'}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate text-[13px] text-canvas/70">
                            {JOB_CATEGORY_LABEL[job.category]}, {job.address}
                          </span>
                          {job.status !== 'SCHEDULED' && (
                            <StatusPill
                              tone={STATUS_TONE[job.status]}
                              onField
                              size="sm"
                              className="shrink-0"
                            >
                              {JOB_STATUS_LABEL[job.status]}
                            </StatusPill>
                          )}
                          {job.changeRequested && (
                            <StatusPill tone="now" onField size="sm" className="shrink-0">
                              Move requested
                            </StatusPill>
                          )}
                        </span>
                      </span>
                    </button>
                  </div>
                )
              })
            )}
          </SolidInfoModule>

          {/*
            Accepted work with no date is money that has already cleared the quote
            and is now sitting still, so the header is solid brand red whenever
            there is anything in here. With the list empty it drops back to a
            normal section, because red that is always on stops meaning anything.
          */}
          <section className="waiting-frost flex flex-col overflow-hidden rounded-panel">
            <header
              className={cn(
                'flex items-center justify-between gap-3 px-5 py-3.5',
                waiting.length > 0 ? 'field-red' : '',
              )}
            >
              <h2
                className={cn(
                  'flex items-center gap-2.5 font-label text-[12px] font-semibold uppercase tracking-[0.22em]',
                  waiting.length > 0 ? 'text-canvas' : 'text-ink/85',
                )}
              >
                {waiting.length === 0 && (
                  <span className="h-[11px] w-[3px] shrink-0 rounded-full bg-ok" />
                )}
                Waiting on a date
              </h2>
              {waiting.length > 0 && (
                <StatusPill tone="neutral" onField size="sm">
                  {waiting.length} {waiting.length === 1 ? 'job' : 'jobs'}
                </StatusPill>
              )}
            </header>
            {waiting.length === 0 ? (
              <div className="border-t border-line px-5 py-5 text-[15px] text-cc-muted">
                Every accepted quote has a work date.
              </div>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {waiting.map((quote) => (
                  <div key={quote.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-ink">
                          {customerById(quote.customerId)?.name ?? 'Unknown'}
                        </div>
                        <div className="mt-0.5 text-[14px] text-cc-muted">
                          {quote.description}
                        </div>
                      </div>
                      <div className="shrink-0 font-display display-tight tnum text-[20px]">
                        {usd(quoteTotals(quote).total)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <SecondaryButton size="sm" onClick={() => setScheduling({ quote })}>
                        Schedule Job
                      </SecondaryButton>
                      <span className="font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                        Accepted, no date agreed
                      </span>
                    </div>
                  </div>
                ))}
                <p className="px-5 py-3 text-[13px] leading-snug text-cc-muted">
                  Accepted work with no date stays off the calendar on purpose. It sits
                  here and in Needs Attention until a real date is agreed.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <ScheduleJobSheet
        open={scheduling !== null}
        onClose={() => setScheduling(null)}
        quote={scheduling?.quote}
        defaultDate={selected}
      />
    </div>
  )
}
