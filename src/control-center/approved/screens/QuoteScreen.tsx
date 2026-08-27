import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ScheduleJobSheet } from '@/control-center/approved/components/jobs/ScheduleJobSheet'
import { CustomWorkSheet } from '@/control-center/approved/components/sales/CustomWorkSheet'
import { DeliverySheet } from '@/control-center/approved/components/sales/DeliverySheet'
import { MaterialLineRow } from '@/control-center/approved/components/sales/MaterialLineRow'
import { MaterialSheet } from '@/control-center/approved/components/sales/MaterialSheet'
import { PrimaryButton, QuietButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { ContextualActionBar } from '@/control-center/approved/components/ui/ContextualActionBar'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { Stepper, TextArea, TextField } from '@/control-center/approved/components/ui/Field'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { PinnedTotalBar } from '@/control-center/approved/components/ui/PinnedTotalBar'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { formatTaxRate, usd, usdExact } from '@/control-center/approved/lib/format'
import { QUOTE_LABEL, QUOTE_TONE } from '@/control-center/approved/lib/status'
import { useAppState } from '@/control-center/approved/state/AppState'
import { deliveryLabel } from '@/control-center/approved/state/pricing'
import { quoteTotals } from '@/control-center/approved/state/salesData'

export function QuoteScreen() {
  const { quoteId = '' } = useParams()
  const navigate = useNavigate()
  const {
    quoteById,
    customerById,
    updateQuoteMeta,
    addMaterialLine,
    removeMaterialLine,
    addCustomLine,
    removeCustomLine,
    setQuoteDelivery,
    setQuoteDeliveryLoads,
    sendQuote,
    acceptQuote,
    declineQuote,
    emailSendingFor,
  } = useAppState()

  const [materialSheet, setMaterialSheet] = useState(false)
  const [deliverySheet, setDeliverySheet] = useState(false)
  const [customSheet, setCustomSheet] = useState(false)
  const [scheduleSheet, setScheduleSheet] = useState(false)

  const quote = quoteById(quoteId)
  if (!quote) {
    return (
      <Panel>
        <EmptyState
          title="Quote not found"
          line="This quote record could not be found."
          action={<SecondaryButton onClick={() => navigate('/admin/leads')}>Back to leads</SecondaryButton>}
        />
      </Panel>
    )
  }

  const customer = customerById(quote.customerId)
  const totals = quoteTotals(quote)
  const editable = quote.status === 'DRAFT'
  const empty = quote.materialLines.length === 0 && quote.customLines.length === 0
  const deliveryUnset = quote.delivery.mode === 'UNSET'
  const canSend = !empty && !deliveryUnset

  return (
    <div className="space-y-5">
      <RecordHeader
        eyebrow={`Quote ${quote.number}`}
        title={customer?.name ?? 'Quote'}
        onBack={() => navigate(`/admin/leads/${quote.leadId}`)}
        right={<StatusPill tone={QUOTE_TONE[quote.status]}>{QUOTE_LABEL[quote.status]}</StatusPill>}
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-7">
          <Panel title="Details">
            {editable ? (
              <div className="space-y-4">
                <TextArea
                  label="What the work is"
                  value={quote.description}
                  onChange={(value) => updateQuoteMeta(quote.id, { description: value })}
                  rows={2}
                />
                <TextField
                  label="Job site address"
                  value={quote.address}
                  onChange={(value) => updateQuoteMeta(quote.id, { address: value })}
                  placeholder="Where is it going"
                  hint="The address belongs to the job and the ticket, not to the permanent customer record."
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[17px] font-semibold leading-snug text-ink">
                  {quote.description}
                </p>
                <p className="text-[15px] text-cc-muted">{quote.address || 'No address on file'}</p>
              </div>
            )}
          </Panel>

          <Panel
            title="Material"
            padded={false}
            right={
              editable && (
                <SecondaryButton
                  size="sm"
                  onClick={() => setMaterialSheet(true)}
                  icon={<Plus className="h-4 w-4" strokeWidth={2.6} />}
                >
                  Add
                </SecondaryButton>
              )
            }
          >
            {quote.materialLines.length === 0 ? (
              <div className="border-t border-line">
                <EmptyState
                  title="No material yet"
                  line="Rates come from the Ticket system settings, so a quote and a ticket always price the same."
                  action={
                    editable ? (
                      <SecondaryButton size="sm" onClick={() => setMaterialSheet(true)}>
                        Add material
                      </SecondaryButton>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {quote.materialLines.map((line) => (
                  <MaterialLineRow
                    key={line.id}
                    line={line}
                    action={
                      editable ? (
                        <button
                          type="button"
                          aria-label="Remove line"
                          onClick={() => removeMaterialLine(quote.id, line.id)}
                          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-idle transition-colors hover:bg-white/[0.07] hover:text-ink"
                        >
                          <X className="h-4 w-4" strokeWidth={2.4} />
                        </button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Custom work"
            padded={false}
            right={
              editable && (
                <SecondaryButton
                  size="sm"
                  onClick={() => setCustomSheet(true)}
                  icon={<Plus className="h-4 w-4" strokeWidth={2.6} />}
                >
                  Add
                </SecondaryButton>
              )
            }
          >
            {quote.customLines.length === 0 ? (
              <div className="border-t border-line px-5 py-5 text-[15px] text-cc-muted">
                Driveways, ponds, grading and clearing go here. Salvador prices these, the
                AI never does.
              </div>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {quote.customLines.map((line) => (
                  <div key={line.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1 text-[16px] leading-snug text-ink">
                      {line.label}
                    </div>
                    <div className="shrink-0 font-display display-tight tnum text-[22px]">
                      {usd(line.amount)}
                    </div>
                    {editable && (
                      <button
                        type="button"
                        aria-label="Remove custom work"
                        onClick={() => removeCustomLine(quote.id, line.id)}
                        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-idle transition-colors hover:bg-raised hover:text-ink"
                      >
                        <X className="h-4 w-4" strokeWidth={2.4} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-5">
          <Panel title="Delivery">
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div
                    className={
                      deliveryUnset
                        ? 'text-[17px] font-semibold text-warn'
                        : 'text-[17px] font-semibold text-ink'
                    }
                  >
                    {deliveryLabel(quote.delivery)}
                  </div>
                  <div className="mt-1 text-[14px] text-cc-muted">
                    {deliveryUnset
                      ? 'Pick a zone before this quote goes out'
                      : `${usd(totals.deliveryPerLoad)} per load`}
                  </div>
                </div>
                {editable && (
                  <SecondaryButton size="sm" onClick={() => setDeliverySheet(true)}>
                    Change
                  </SecondaryButton>
                )}
              </div>

              <div>
                <div className="mb-2 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
                  Loads
                </div>
                {editable ? (
                  <Stepper
                    value={quote.deliveryLoads}
                    onChange={(value) => setQuoteDeliveryLoads(quote.id, value)}
                    min={1}
                    max={30}
                  />
                ) : (
                  <div className="font-display display-tight tnum text-[24px]">{quote.deliveryLoads}</div>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Totals">
            <dl className="space-y-3">
              <Row label="Material" value={usdExact(totals.materials)} />
              {totals.custom > 0 && (
                <Row label="Custom work" value={usdExact(totals.custom)} />
              )}
              <Row
                label={`Delivery, ${quote.deliveryLoads} ${quote.deliveryLoads === 1 ? 'load' : 'loads'}`}
                value={usdExact(totals.delivery)}
              />
              <Row
                label={`Tax ${formatTaxRate(totals.taxRate)}`}
                value={usdExact(totals.tax)}
                hint={quote.taxOnDelivery ? 'On material and delivery' : 'On material only'}
              />
            </dl>

            <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
              <span className="font-label text-[13px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
                Total
              </span>
              <span className="font-display display-tight tnum text-[38px]">
                {usdExact(totals.total)}
              </span>
            </div>
          </Panel>

          {!editable && (
            <Panel title="Next">
              <ContextualActionBar align="start" className="sm:flex-col sm:items-stretch">
                {quote.status === 'SENT' && (
                  <>
                    <PrimaryButton onClick={() => acceptQuote(quote.id)}>
                      Accept Quote
                    </PrimaryButton>
                    <SecondaryButton disabled={emailSendingFor === quote.id} onClick={() => sendQuote(quote.id)}>
                      {emailSendingFor === quote.id ? 'Sending…' : 'Resend Quote'}
                    </SecondaryButton>
                    <QuietButton onClick={() => declineQuote(quote.id)}>
                      Customer declined
                    </QuietButton>
                  </>
                )}
                {quote.status === 'ACCEPTED' && (
                  <>
                    <PrimaryButton onClick={() => setScheduleSheet(true)}>
                      Schedule Job
                    </PrimaryButton>
                    <p className="text-[14px] leading-snug text-cc-muted">
                      Accepted work with no date stays off the calendar and in Needs
                      Attention until a real work date is agreed.
                    </p>
                  </>
                )}
                {quote.status === 'DECLINED' && (
                  <p className="text-[15px] text-cc-muted">
                    This quote was declined. The lead stays open until you mark it lost.
                  </p>
                )}
              </ContextualActionBar>
            </Panel>
          )}
        </div>
      </div>

      {editable && (
        <>
          <div className="h-24 lg:hidden" />
          <PinnedTotalBar
            label={empty ? 'Nothing on this quote yet' : 'Quote total'}
            total={usdExact(totals.total)}
            note={
              empty
                ? 'Add material or custom work'
                : deliveryUnset
                  ? 'Pick a delivery zone'
                  : `${quote.materialLines.length} material ${quote.materialLines.length === 1 ? 'line' : 'lines'}, tax included`
            }
            action={
              <PrimaryButton disabled={!canSend || emailSendingFor === quote.id} onClick={() => sendQuote(quote.id)}>
                {emailSendingFor === quote.id ? 'Sending…' : 'Send Quote'}
              </PrimaryButton>
            }
          />
        </>
      )}

      <MaterialSheet
        open={materialSheet}
        onClose={() => setMaterialSheet(false)}
        onAdd={(materialId, options) => addMaterialLine(quote.id, materialId, options)}
      />
      <DeliverySheet
        open={deliverySheet}
        onClose={() => setDeliverySheet(false)}
        delivery={quote.delivery}
        deliveryLoads={quote.deliveryLoads}
        onApply={(delivery) => setQuoteDelivery(quote.id, delivery)}
      />
      <ScheduleJobSheet
        open={scheduleSheet}
        onClose={() => setScheduleSheet(false)}
        quote={quote}
      />
      <CustomWorkSheet
        open={customSheet}
        onClose={() => setCustomSheet(false)}
        onAdd={(label, amount) => addCustomLine(quote.id, label, amount)}
      />
    </div>
  )
}

function Row({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="min-w-0 font-label text-[13px] uppercase tracking-[0.1em] text-cc-muted">
        {label}
        {hint && <span className="ml-2 normal-case tracking-normal text-idle">{hint}</span>}
      </dt>
      <dd className="shrink-0 tnum text-[16px] text-ink">{value}</dd>
    </div>
  )
}
