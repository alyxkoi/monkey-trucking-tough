import type { ReactNode } from 'react'
import {
  Banknote,
  Bot,
  CalendarDays,
  FileText,
  MessageSquare,
  Receipt,
  StickyNote,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/control-center/approved/lib/cn'
import type { ActivityKind } from '@/control-center/approved/state/salesData'

export type TimelineActor = 'customer' | 'ai' | 'salvador' | 'system'

type Marker = {
  dot: string
  ring: string
  label: string
  labelClass: string
  icon: LucideIcon
}

const ACTOR: Record<TimelineActor, Marker> = {
  customer: {
    dot: 'bg-ink',
    ring: 'border-ink/25 bg-ink/[0.08] text-ink',
    label: 'Customer',
    labelClass: 'text-ink',
    icon: UserRound,
  },
  ai: {
    dot: 'bg-ice',
    ring: 'border-ice/30 bg-ice/[0.1] text-ice',
    label: 'AI',
    labelClass: 'text-ice',
    icon: Bot,
  },
  salvador: {
    dot: 'bg-ok',
    ring: 'border-ok/30 bg-ok/[0.1] text-ok',
    label: 'Salvador',
    labelClass: 'text-ok',
    icon: MessageSquare,
  },
  system: {
    dot: 'bg-idle',
    ring: 'border-white/15 bg-white/[0.05] text-cc-muted',
    label: 'System',
    labelClass: 'text-cc-muted',
    icon: Sparkles,
  },
}

/**
 * What happened, rather than who typed it.
 *
 * A customer relationship is the longest read in the product, and it is the one
 * screen Salvador should be able to understand without reading every line. Each
 * event carries a marker built from three cheap signals working together: the
 * icon says what kind of thing it was, the colour says which part of the business
 * it belongs to, and the micro label confirms it in a word.
 *
 * Colours are the ones already in the system and nothing else: icy blue for the
 * sales conversation, the calendar violet for scheduled work, white for the
 * physical proof, green only ever for money. No event gets a full colour card.
 */
const KIND: Record<ActivityKind, Marker> = {
  lead: {
    dot: 'bg-ice',
    ring: 'border-ice/30 bg-ice/[0.1] text-ice',
    label: 'Lead',
    labelClass: 'text-ice',
    icon: Sparkles,
  },
  quote: {
    dot: 'bg-ice',
    ring: 'border-ice/30 bg-ice/[0.1] text-ice',
    label: 'Quote',
    labelClass: 'text-ice',
    icon: FileText,
  },
  job: {
    dot: 'bg-ice-violet',
    ring: 'border-ice-violet/30 bg-ice-violet/[0.1] text-ice-violet',
    label: 'Job',
    labelClass: 'text-ice-violet',
    icon: CalendarDays,
  },
  ticket: {
    dot: 'bg-ink',
    ring: 'border-ink/25 bg-ink/[0.08] text-ink',
    label: 'Ticket',
    labelClass: 'text-ink',
    icon: Receipt,
  },
  money: {
    dot: 'bg-ok',
    ring: 'border-ok/30 bg-ok/[0.1] text-ok',
    label: 'Money',
    labelClass: 'text-ok',
    icon: Banknote,
  },
  note: {
    dot: 'bg-idle',
    ring: 'border-white/15 bg-white/[0.05] text-cc-muted',
    label: 'Note',
    labelClass: 'text-cc-muted',
    icon: StickyNote,
  },
}

/**
 * Timeline entry for customer history and activity history.
 * One chronological column. An entry that points at a real record becomes a
 * button; everything else stays plain text, so nothing looks clickable and isn't.
 */
export function TimelineEntry({
  actor,
  kind,
  time,
  title,
  children,
  attachment,
  onOpen,
  last,
}: {
  actor: TimelineActor
  /** When set, the marker describes the record instead of the sender. */
  kind?: ActivityKind
  time: string
  title?: ReactNode
  children?: ReactNode
  attachment?: ReactNode
  /** Opens the record this event belongs to, when there is one. */
  onOpen?: () => void
  last?: boolean
}) {
  const config = kind ? KIND[kind] : ACTOR[actor]
  const Icon = config.icon

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className={cn(
            'font-label text-[12px] font-semibold uppercase tracking-[0.14em]',
            config.labelClass,
          )}
        >
          {config.label}
        </span>
        <span className="font-label text-[12px] uppercase tracking-[0.1em] text-idle">
          {time}
        </span>
      </div>
      {title && <div className="mt-1.5 text-[15px] font-semibold text-ink">{title}</div>}
      {children && (
        <div className="mt-1 text-[15px] leading-relaxed text-ink/85">{children}</div>
      )}
      {attachment && <div className="mt-2.5">{attachment}</div>}
    </>
  )

  return (
    <div className="flex gap-3.5">
      <div className="flex w-7 shrink-0 flex-col items-center">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
            config.ring,
          )}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={2.2} />
        </span>
        {!last && <span className="mt-1.5 w-px flex-1 bg-white/[0.09]" />}
      </div>

      <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-5')}>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="row-hover -my-1 -ml-2 block w-full rounded-lg px-2 py-1 text-left hover:bg-white/[0.04]"
          >
            {body}
          </button>
        ) : (
          body
        )}
      </div>
    </div>
  )
}
