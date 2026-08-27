import { useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AttentionLead, AttentionRow } from '@/control-center/approved/components/ui/AttentionRow'
import { QuietButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { waitingFor } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { toEntry, type Priority } from '@/control-center/approved/state/attention'

type Filter = 'ALL' | Priority

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'NOW', label: 'Now' },
  { value: 'TODAY', label: 'Today' },
  { value: 'FOLLOW_UP', label: 'Follow up' },
]

function returnsLabel(at: number): string {
  const date = new Date(at)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toUpperCase()
  return sameDay ? `back today at ${time}` : `back tomorrow at ${time}`
}

/**
 * The full queue.
 *
 * Everything here is derived from the real records, so handling the underlying
 * thing is what makes an item disappear. Marking it handled is the manual
 * override for the times a phone call already settled it.
 */
export function NeedsAttention() {
  const [filter, setFilter] = useState<Filter>('ALL')
  const {
    attention,
    snoozedItems,
    snoozeAttention,
    unsnoozeAttention,
    lastAction,
    undoLastAction,
  } = useAppState()
  const navigate = useNavigate()

  const visible = filter === 'ALL' ? attention : attention.filter((item) => item.priority === filter)
  const [lead, ...rest] = visible
  const promoteLead = lead?.priority === 'NOW' && filter !== 'FOLLOW_UP'
  const rows = promoteLead ? rest : visible

  const countFor = (value: Filter) =>
    value === 'ALL' ? attention.length : attention.filter((item) => item.priority === value).length

  return (
    <div className="space-y-5">
      <RecordHeader
        eyebrow="Needs Attention"
        title={`${attention.length} open`}
        onBack={() => navigate('/admin')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentControl
          options={FILTERS.map((entry) => ({
            value: entry.value,
            label: `${entry.label} ${countFor(entry.value)}`,
          }))}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <Panel
        padded={false}
        title="The queue"
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
        {visible.length === 0 ? (
          <div className="border-t border-line">
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6" strokeWidth={2} />}
              title="All clear"
              line="Nothing is waiting on you here. Items appear on their own the moment something needs a decision, and leave on their own once it is handled."
            />
          </div>
        ) : (
          <div>
            {promoteLead && lead && (
              <div className="px-5 pb-4 pt-4">
                <AttentionLead
                  item={lead}
                  onAction={() => navigate(lead.action.to, { state: { attention: toEntry(lead) } })}
                  onSnooze={() => snoozeAttention(lead.id)}
                />
              </div>
            )}
            <div className="divide-y divide-line border-t border-line">
              {rows.map((item) => (
                <div key={item.id}>
                  <AttentionRow
                    item={item}
                    onAction={() => navigate(item.action.to, { state: { attention: toEntry(item) } })}
                    onSnooze={() => snoozeAttention(item.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Coming back later" padded={false}>
        {snoozedItems.length === 0 ? (
          <div className="border-t border-line px-5 py-5 text-[15px] leading-snug text-cc-muted">
            Nothing snoozed. Remind later pushes an item to the start of the next working
            day instead of losing it.
          </div>
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {snoozedItems.map(({ item, returnsAt }) => (
              <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-cc-muted" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-ink">{item.title}</div>
                  <div className="mt-0.5 text-[14px] text-cc-muted">{item.context}</div>
                  <div className="mt-1.5 font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                    {waitingFor(item.since)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusPill tone="neutral" size="sm">
                    {returnsLabel(returnsAt)}
                  </StatusPill>
                  <SecondaryButton size="sm" onClick={() => unsnoozeAttention(item.id)}>
                    Bring it back
                  </SecondaryButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="rounded-panel border border-line bg-panel p-5">
        <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
          How this queue clears
        </div>
        <p className="mt-2 max-w-[68ch] text-[15px] leading-snug text-ink/85">
          Every item here is read from a real record, so the way to clear one is to do the
          work: reply to the customer, put the job on the calendar, record or verify the
          payment, settle the dispute, or close the lead. There is no button that makes an
          unresolved problem go away. Remind later is the only way to hide something by
          hand, and it always comes back.
        </p>
        <p className="mt-3 text-[13px] leading-snug text-cc-muted">
          Sorted by operational impact first, then by who has been waiting longest. A
          dollar amount only ever breaks a tie, it never sets the priority.
        </p>
      </div>
    </div>
  )
}
