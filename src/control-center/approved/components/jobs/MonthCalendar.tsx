import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/control-center/approved/lib/cn'
import { dateKey, type Job } from '@/control-center/approved/state/jobsData'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
]

/** Limited status colour. Icy blue is the system accent and owns this screen. */
function dotClass(job: Job, onIce: boolean): string {
  if (onIce) return 'bg-canvas/70'
  switch (job.status) {
    case 'COMPLETED':
      return 'bg-ok'
    case 'CANCELLED':
      return 'bg-idle'
    default:
      return 'bg-ice'
  }
}

/**
 * Live month calendar.
 * Cells carry the date and a concise indicator only. No descriptions are crammed
 * into a cell, the full schedule appears once a day is selected.
 */
export function MonthCalendar({
  month,
  selected,
  jobsByDay,
  onSelect,
  onMonthChange,
  onToday,
}: {
  month: Date
  selected: string
  jobsByDay: Map<string, Job[]>
  onSelect: (day: string) => void
  onMonthChange: (delta: number) => void
  onToday: () => void
}) {
  const today = dateKey(new Date())
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const leading = first.getDay()
  const cells: Date[] = []
  const start = new Date(first)
  start.setDate(start.getDate() - leading)
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    cells.push(day)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="font-label text-[12px] font-semibold uppercase tracking-[0.18em] text-cc-muted">
            {month.getFullYear()}
          </div>
          <div className="font-display display-tight text-[30px] sm:text-[34px]">
            {MONTH_NAMES[month.getMonth()]}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToday}
            className="flex h-11 items-center rounded-xl border border-line bg-raised px-3.5 font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-ice transition-colors hover:border-ice/40"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-raised text-ice transition-colors hover:border-ice/40"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(1)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-raised text-ice transition-colors hover:border-ice/40"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 border-t border-line px-1 pt-3 sm:px-3">
        {WEEKDAYS.map((day, index) => (
          <div
            key={`${day}-${index}`}
            className="pb-1 text-center font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-cc-muted"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-1 pb-4 sm:px-3">
        {cells.map((day) => {
          const key = dateKey(day)
          const inMonth = day.getMonth() === month.getMonth()
          const isToday = key === today
          const isSelected = key === selected
          const dayJobs = jobsByDay.get(key) ?? []

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={cn(
                'flex min-h-[54px] min-w-11 flex-col items-center justify-start gap-1.5 rounded-xl border p-1.5 transition-colors lg:min-h-[86px] lg:justify-between lg:p-2',
                isSelected && 'border-ice bg-ice text-white shadow-[0_10px_24px_-18px_rgba(85,0,213,0.9)]',
                !isSelected && 'border-transparent hover:bg-raised/60',
                !inMonth && 'opacity-35',
              )}
            >
              <span
                className={cn(
                  'font-display display-tight tnum text-[17px] lg:self-start lg:text-[22px]',
                  isSelected ? 'text-white' : inMonth ? 'text-ink' : 'text-cc-muted',
                )}
              >
                {day.getDate()}
              </span>

              {dayJobs.length > 0 && (
                <span className="flex items-center gap-1 lg:self-start">
                  {dayJobs.slice(0, 3).map((job) => (
                    <span
                      key={job.id}
                      className={cn('h-1.5 w-1.5 rounded-full', dotClass(job, isSelected))}
                    />
                  ))}
                  {dayJobs.length > 3 && (
                    <span
                      className={cn(
                        'font-label text-[11px] font-semibold tracking-[0.06em]',
                        isSelected ? 'text-white/75' : 'text-cc-muted',
                      )}
                    >
                      +{dayJobs.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
