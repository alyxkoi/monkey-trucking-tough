import { useRef, useState } from 'react'
import { ArrowUpRight, MessageSquare, Phone } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ScheduleJobSheet } from '@/control-center/approved/components/jobs/ScheduleJobSheet'
import { ActionLink, PrimaryButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { ConversationThread, ReplyComposer, SalvadorNeeded } from '@/control-center/approved/components/ui/Conversation'
import {
  AttentionBanner,
  AttentionTarget,
  useAttentionEntry,
} from '@/control-center/approved/components/ui/Guidance'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { KnownAndMissing } from '@/control-center/approved/components/ui/FactList'
import { TextArea } from '@/control-center/approved/components/ui/Field'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SolidInfoModule, SolidLabel } from '@/control-center/approved/components/ui/SolidInfoModule'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { usd } from '@/control-center/approved/lib/format'
import { LEAD_LABEL, LEAD_TONE, QUOTE_LABEL, QUOTE_TONE, smsHref, telHref } from '@/control-center/approved/lib/status'
import { useAppState } from '@/control-center/approved/state/AppState'
import { quoteTotals } from '@/control-center/approved/state/salesData'

export function LeadDetail() {
  const { leadId = '' } = useParams()
  const navigate = useNavigate()
  const {
    leadById,
    customerById,
    quoteById,
    replyToLead,
    updateLeadNotes,
    createQuoteFromLead,
    activitiesForCustomer,
    communicationReady,
  } = useAppState()
  const conversationRef = useRef<HTMLDivElement>(null)
  const [scheduleSheet, setScheduleSheet] = useState(false)

  const { entry, recommend, markActed } = useAttentionEntry()
  const lead = leadById(leadId)
  const [notesDraft, setNotesDraft] = useState({ leadId: '', value: '' })
  const notes = notesDraft.leadId === lead?.id ? notesDraft.value : lead?.notes ?? ''
  if (!lead) {
    return (
      <Panel>
        <EmptyState
          title="Lead not found"
          line="This lead record could not be found."
          action={<SecondaryButton onClick={() => navigate('/admin/leads')}>Back to leads</SecondaryButton>}
        />
      </Panel>
    )
  }

  const customer = customerById(lead.customerId)
  const quote = lead.quoteId ? quoteById(lead.quoteId) : undefined
  const activities = activitiesForCustomer(lead.customerId).slice(0, 3)

  const focusReply = () => {
    conversationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  const openQuote = () => quote && navigate(`/admin/quotes/${quote.id}`)
  const startQuote = async () => {
    const id = await createQuoteFromLead(lead.id)
    if (id) navigate(`/admin/quotes/${id}`)
  }

  /**
   * One primary action for the current state, with at most one secondary.
   * The product never shows every possible action at once.
   */
  const primary = (() => {
    if (lead.status === 'LOST') return null
    if (lead.needsSalvador) return { label: 'Reply', run: focusReply }
    if (lead.status === 'WON' && quote?.status === 'ACCEPTED')
      return { label: 'Schedule Job', run: () => setScheduleSheet(true) }
    if (quote) return { label: 'View Quote', run: openQuote }
    if (lead.status === 'NEW') return { label: 'Reply', run: focusReply }
    return { label: 'Create Quote', run: startQuote }
  })()

  const secondary = (() => {
    if (lead.status === 'LOST') return quote ? { label: 'View Quote', run: openQuote } : null
    if (!primary) return null
    if (primary.label === 'Reply')
      return quote
        ? { label: 'View Quote', run: openQuote }
        : { label: 'Create Quote', run: startQuote }
    if (primary.label === 'Schedule Job') return { label: 'View Quote', run: openQuote }
    return { label: 'Reply', run: focusReply }
  })()

  return (
    <div className="animate-page space-y-5 lg:space-y-6">
      <RecordHeader
        eyebrow="Lead"
        title={customer?.name ?? 'Lead'}
        onBack={() => navigate('/admin/leads')}
        right={
          <StatusPill tone={LEAD_TONE[lead.status]}>{LEAD_LABEL[lead.status]}</StatusPill>
        }
      />

      {entry && <AttentionBanner entry={entry} />}

      {lead.needsSalvador && (
        <SalvadorNeeded line="Custom pond work needs your number. The AI stopped rather than guess a price." />
      )}

      {/*
        What they need is the whole reason this screen exists, so it is the one
        solid colour field on it. Flat icy blue with near black on top, generous
        padding so nothing crowds the edge, and the action column sits inside the
        field rather than hanging off it.
      */}
      <SolidInfoModule tone="ice">
        <div className="flex flex-col gap-7 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-8">
          <div className="min-w-0 space-y-6">
            <div>
              <SolidLabel>What they need</SolidLabel>
              <p className="mt-3 max-w-[46ch] text-[20px] font-bold leading-[1.25] sm:text-[22px]">
                {lead.need}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-label text-[13px] font-semibold uppercase tracking-[0.1em] text-canvas/70">
              <span>{customer?.phone}</span>
              {customer?.email && (
                <span className="normal-case tracking-normal">{customer.email}</span>
              )}
              <span>
                {lead.source}
                {lead.campaign && (
                  <>
                    <span className="px-1.5 text-canvas/45">/</span>
                    {lead.campaign}
                  </>
                )}
              </span>
            </div>

            {customer && (
              <div className="flex flex-wrap gap-2">
                <ActionLink
                  size="sm"
                  tone="onSolid"
                  href={telHref(customer.phone)}
                  icon={<Phone className="h-4 w-4" strokeWidth={2.2} />}
                >
                  Call
                </ActionLink>
                <ActionLink
                  size="sm"
                  tone="onSolid"
                  href={smsHref(customer.phone)}
                  icon={<MessageSquare className="h-4 w-4" strokeWidth={2.2} />}
                >
                  Text
                </ActionLink>
                <SecondaryButton
                  size="sm"
                  tone="onSolid"
                  onClick={() => navigate(`/admin/customers/${customer.id}`)}
                  icon={<ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />}
                >
                  Customer
                </SecondaryButton>
              </div>
            )}
          </div>

          {(primary || secondary) && (
            <div className="flex w-full shrink-0 flex-col gap-2.5 sm:flex-row lg:w-[210px] lg:flex-col">
              {primary && (
                <AttentionTarget
                  active={recommend === 'reply' && primary.label === 'Reply'}
                  priority={entry?.priority}
                  onInteract={markActed}
                  className="w-full"
                >
                  <PrimaryButton tone="onSolid" fullWidth onClick={primary.run}>
                    {primary.label}
                  </PrimaryButton>
                </AttentionTarget>
              )}
              {secondary && (
                <SecondaryButton tone="onSolid" fullWidth onClick={secondary.run}>
                  {secondary.label}
                </SecondaryButton>
              )}
            </div>
          )}
        </div>
      </SolidInfoModule>

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div ref={conversationRef} className="min-w-0 lg:col-span-7">
          <Panel padded={false} title="Conversation">
            <ConversationThread
              messages={lead.messages}
              className="border-t border-white/[0.07]"
            />
            <ReplyComposer
              paused={lead.aiPaused}
              disabled={!communicationReady}
              onSend={(text) => replyToLead(lead.id, text)}
            />
          </Panel>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-5 lg:space-y-6">
          <Panel title="What the AI has">
            <KnownAndMissing known={lead.known} missing={lead.missing} />
          </Panel>

          {quote ? (
            <Panel title="Quote" padded={false}>
              <button
                type="button"
                onClick={openQuote}
                className="row-hover flex w-full items-center gap-4 border-t border-line px-5 py-4 text-left hover:bg-white/[0.04]"
              >
                <span className="w-[72px] shrink-0 font-display display-tight text-[20px] text-ice">
                  {quote.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {quote.description}
                  </span>
                  <StatusPill tone={QUOTE_TONE[quote.status]} size="sm" className="mt-1.5">
                    {QUOTE_LABEL[quote.status]}
                  </StatusPill>
                </span>
                <span className="shrink-0 font-display display-tight tnum text-[22px]">
                  {usd(quoteTotals(quote).total)}
                </span>
              </button>
            </Panel>
          ) : (
            lead.status !== 'LOST' && (
              <Panel title="Quote">
                <EmptyState
                  title="No quote yet"
                  line="A quote carries the customer and the need across, so nothing gets retyped."
                  action={
                    <SecondaryButton size="sm" onClick={startQuote}>
                      Create Quote
                    </SecondaryButton>
                  }
                />
              </Panel>
            )
          )}

          {lead.lostReason && (
            <Panel title="Why it was lost">
              <p className="text-[15px] text-ink/85">{lead.lostReason}</p>
            </Panel>
          )}

          <Panel title="Notes">
            <TextArea
              value={notes}
              onChange={(value) => {
                setNotesDraft({ leadId: lead.id, value })
                updateLeadNotes(lead.id, value)
              }}
              rows={3}
              placeholder="Anything worth remembering about this one"
            />
            <p className="mt-2 text-[13px] text-cc-muted">Saves as you type.</p>
          </Panel>

          <Panel
            title="Activity"
            padded={false}
            right={
              customer && (
                <button
                  type="button"
                  onClick={() => navigate(`/admin/customers/${customer.id}`)}
                  className="flex h-11 items-center font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-cc-muted transition-colors hover:text-ink"
                >
                  Full history
                </button>
              )
            }
          >
            <div className="divide-y divide-line border-t border-line">
              {activities.length === 0 && (
                <div className="px-5 py-4 text-[15px] text-cc-muted">Nothing logged yet.</div>
              )}
              {activities.map((activity) => (
                <div key={activity.id} className="px-5 py-3.5">
                  <div className="text-[15px] font-semibold text-ink">{activity.title}</div>
                  {activity.body && (
                    <div className="mt-0.5 text-[14px] text-cc-muted">{activity.body}</div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      <ScheduleJobSheet
        open={scheduleSheet}
        onClose={() => setScheduleSheet(false)}
        quote={quote}
      />
    </div>
  )
}
