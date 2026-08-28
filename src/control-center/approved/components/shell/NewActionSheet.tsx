import {
  Banknote,
  CalendarPlus,
  MessageSquarePlus,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '@/control-center/approved/state/AppState'
import { Sheet } from './Sheet'

type CreateAction = {
  key: string
  label: string
  line: string
  to: string
  icon: LucideIcon
  /** Acid green for system creation, red for the money-confirming action. */
  tone: 'ice' | 'red'
}

/**
 * Four real starting points, and nothing that is really a consequence of one.
 *
 * The menu answers where the work is, not which table it lands in. Salvador
 * should never have to choose between a lead, a customer and a quote before he
 * has decided anything about the job itself.
 *
 * Customer is gone because every one of these creates the identity record on its
 * own: search for the person, add them inline if they are new, and the same phone
 * and email matching runs underneath so a second record is never made. Quote is
 * gone because a quote is something a lead turns into, not something a day starts
 * with, and it is still created from a lead or an existing opportunity.
 */
const ACTIONS: CreateAction[] = [
  {
    key: 'lead',
    label: 'New Lead',
    line: 'Interested, but the work is not agreed yet.',
    to: '/admin/leads',
    icon: MessageSquarePlus,
    tone: 'ice',
  },
  {
    key: 'job',
    label: 'New Job',
    line: 'Already agreed. Put it straight on the calendar.',
    to: '/admin/jobs',
    icon: CalendarPlus,
    tone: 'ice',
  },
  {
    key: 'ticket',
    label: 'New Ticket',
    line: 'Material going out now, with no job behind it.',
    to: '/admin/tickets/new',
    icon: Ticket,
    tone: 'ice',
  },
  {
    key: 'payment',
    label: 'Record Payment',
    line: 'Money that actually came in on an open invoice.',
    to: '/admin/money',
    icon: Banknote,
    tone: 'red',
  },
]

/** The single + New entry point. Desktop button and mobile action button both open this. */
export function NewActionSheet() {
  const { newSheetOpen, setNewSheetOpen, setNewLeadSheetOpen, setNewJobSheetOpen } =
    useAppState()
  const navigate = useNavigate()

  const go = (action: CreateAction) => {
    setNewSheetOpen(false)
    if (action.key === 'lead') {
      setNewLeadSheetOpen(true)
      return
    }
    // Work that is already agreed goes straight onto the calendar. No lead, no
    // quote, and the customer can be created inside the sheet.
    if (action.key === 'job') {
      setNewJobSheetOpen(true)
      return
    }
    navigate(action.to)
  }

  return (
    <Sheet
      open={newSheetOpen}
      onClose={() => setNewSheetOpen(false)}
      eyebrow="Create"
      title="What are we making?"
      footer={
        <p className="text-[13px] leading-snug text-cc-muted">
          A lead is work you are still trying to win. If they have already said yes,
          go straight to a job. A quote is created from a lead when one is needed.
        </p>
      }
    >
      <div className="divide-y divide-line">
        {ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => go(action)}
            className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-raised"
          >
            <span
              className={
                action.tone === 'red'
                  ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mt-red text-canvas'
                  : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-ice'
              }
            >
              <action.icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-label text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
                {action.label}
              </span>
              <span className="mt-0.5 block text-[14px] text-cc-muted">{action.line}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
