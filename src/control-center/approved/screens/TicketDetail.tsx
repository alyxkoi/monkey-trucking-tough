import { useState } from 'react'
import { Printer } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MaterialLineRow } from '@/control-center/approved/components/sales/MaterialLineRow'
import { TicketLabelPreview } from '@/control-center/approved/components/tickets/TicketLabelPreview'
import { PrimaryButton, QuietButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { ContextualActionBar } from '@/control-center/approved/components/ui/ContextualActionBar'
import { NextStep } from '@/control-center/approved/components/ui/Guidance'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { TextArea } from '@/control-center/approved/components/ui/Field'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { Sheet } from '@/control-center/approved/components/shell/Sheet'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { usd, usdExact } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { deliveryLabel } from '@/control-center/approved/state/pricing'
import { driverName, ticketTotals, totalYards } from '@/control-center/approved/state/ticketsData'

export function TicketDetail() {
  const { ticketId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const {
    ticketById,
    customerById,
    jobById,
    printTicket,
    voidTicket,
    createInvoiceFromTicket,
    invoiceForTicket,
  } = useAppState()

  const [printOpen, setPrintOpen] = useState(params.get('print') === '1')
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [editWarning, setEditWarning] = useState(false)

  const ticket = ticketById(ticketId)
  if (!ticket) {
    return (
      <Panel>
        <EmptyState
          title="Ticket not found"
          line="This ticket record could not be found."
          action={
            <SecondaryButton onClick={() => navigate('/admin/tickets')}>Back to tickets</SecondaryButton>
          }
        />
      </Panel>
    )
  }

  const customer = customerById(ticket.customerId)
  const job = ticket.jobId ? jobById(ticket.jobId) : undefined
  const totals = ticketTotals(ticket)
  const voided = ticket.status === 'VOID'
  const pending = ticket.sync === 'PENDING'
  const created = new Date(ticket.createdAt)
  const existingInvoice = invoiceForTicket(ticket.id)

  return (
    <div className="space-y-5">
      <RecordHeader
        eyebrow={`Ticket ${ticket.number ?? 'waiting for a number'}`}
        title={customer?.name ?? 'Ticket'}
        onBack={() => navigate('/admin/tickets')}
        right={
          voided ? (
            <StatusPill tone="idle">Void</StatusPill>
          ) : pending ? (
            <StatusPill tone="warn">Waiting to sync</StatusPill>
          ) : (
            <StatusPill tone="ok">Synced</StatusPill>
          )
        }
      />

      {pending && (
        <div className="rounded-panel border border-warn/40 bg-warn/10 p-4 text-[15px] leading-snug text-warn">
          This ticket is saved on the device and safe. It takes its real number the moment
          the signal comes back, so the sequence never skips or repeats.
        </div>
      )}

      {voided && (
        <div className="rounded-panel border border-line bg-panel p-4">
          <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
            Voided
          </div>
          <p className="mt-1.5 text-[15px] leading-snug text-ink/80">{ticket.voidReason}</p>
          <p className="mt-2 text-[14px] text-cc-muted">
            The record is kept exactly as it was written. Tickets are never deleted.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-7">
          {/*
            The primary ticket summary, and the only platinum surface in the
            product. Everything else on this screen is a quiet dark panel, so the
            plate is what tells you at a glance which card is the ticket itself.
            Number and total lead, the four facts underneath support them.
          */}
          <section className="surface-platinum overflow-hidden rounded-block text-canvas">
            <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6 lg:p-7">
              <div className="min-w-0">
                <div className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-canvas/70">
                  Ticket
                </div>
                <div className="num-safe mt-2 font-display display-tight text-[46px] sm:text-[54px]">
                  {ticket.number ?? 'Pending'}
                </div>
                <div className="mt-2.5 font-label text-[13px] font-semibold uppercase tracking-[0.1em] text-canvas/75">
                  {created.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  <span className="px-1.5 text-canvas/45">/</span>
                  {created
                    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    .toUpperCase()}
                </div>
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <div className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-canvas/70">
                  Total
                </div>
                <div className="num-safe mt-2 font-display display-tight tnum text-[40px] sm:text-[48px]">
                  {usdExact(totals.total)}
                </div>
              </div>
            </div>

            <div className="grid gap-x-6 gap-y-5 border-t border-canvas/15 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:px-7">
              <PlateField label="Job site" value={ticket.address} />
              <PlateField label="Driver" value={driverName(ticket.driverId)} />
              <PlateField label="Total yards" value={`${totalYards(ticket)} yd`} />
              <PlateField
                label="Loads"
                value={`${ticket.deliveryLoads} ${ticket.deliveryLoads === 1 ? 'load' : 'loads'}`}
              />
            </div>

            {ticket.notes && (
              <div className="border-t border-canvas/15 px-5 py-5 sm:px-6 lg:px-7">
                <PlateField label="Notes" value={ticket.notes} />
              </div>
            )}
          </section>

          <Panel title="Material" padded={false}>
            <div className="divide-y divide-line border-t border-line">
              {ticket.materialLines.map((line) => (
                <MaterialLineRow key={line.id} line={line} />
              ))}
            </div>

            <div className="space-y-3 border-t border-line px-5 py-4">
              <Row label="Material" value={usdExact(totals.materials)} />
              <Row
                label={`Delivery, ${deliveryLabel(ticket.delivery)}, ${ticket.deliveryLoads} ${ticket.deliveryLoads === 1 ? 'load' : 'loads'}`}
                value={usdExact(totals.delivery)}
              />
              <Row
                label={`Tax ${(totals.taxRate * 100).toFixed(2)}%`}
                value={usdExact(totals.tax)}
              />
            </div>

            <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-cc-muted">
              These rates are what was charged on the day. Changing prices in Settings later
              never rewrites this ticket.
            </p>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-5">
          {/*
            A finalised standalone ticket is a direct material order. With no job
            and no quote behind it, the ticket's own grand total is what gets
            invoiced. A voided ticket can never produce one.
          */}
          {!job && (
            <Panel title="Invoice" padded={!existingInvoice}>
              {existingInvoice ? (
                <button
                  type="button"
                  onClick={() => navigate(`/admin/money/invoices/${existingInvoice.id}`)}
                  className="row-hover flex w-full items-center gap-4 border-t border-line px-5 py-4 text-left hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-label text-[12px] uppercase tracking-[0.12em] text-idle">
                      Invoice {existingInvoice.number}
                    </span>
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {existingInvoice.description}
                    </span>
                  </span>
                  <span className="shrink-0 font-display display-tight tnum text-[20px]">
                    {usd(existingInvoice.amount)}
                  </span>
                </button>
              ) : voided ? (
                <p className="text-[15px] leading-snug text-cc-muted">
                  A voided ticket cannot be invoiced.
                </p>
              ) : pending ? (
                <p className="text-[15px] leading-snug text-cc-muted">
                  This ticket still has to sync and take its number before it can be
                  invoiced.
                </p>
              ) : (
                <ContextualActionBar align="start" className="sm:flex-col sm:items-stretch">
                  <p className="text-[14px] leading-snug text-cc-muted">
                    Direct material order. The invoice takes this ticket's finalised total
                    of {usdExact(totals.total)}.
                  </p>
                </ContextualActionBar>
              )}
            </Panel>
          )}

          {/*
            A finalised standalone ticket is a direct order, so billing it is the
            normal next step rather than an exception.
          */}
          {!job && !existingInvoice && !voided && !pending && (
            <NextStep
              line="Send the bill for this direct material order."
              action={
                <PrimaryButton
                  tone="onSolid"
                  onClick={async () => {
                    const id = await createInvoiceFromTicket(ticket.id)
                    if (id) navigate(`/admin/money/invoices/${id}`)
                  }}
                >
                  Create Invoice
                </PrimaryButton>
              }
            />
          )}

          <Panel title="Print">
            <ContextualActionBar align="start" className="sm:flex-col sm:items-stretch">
              <PrimaryButton
                onClick={() => setPrintOpen(true)}
                icon={<Printer className="h-5 w-5" strokeWidth={2.2} />}
              >
                {ticket.printCount > 0 ? 'Reprint Ticket' : 'Print Ticket'}
              </PrimaryButton>
            </ContextualActionBar>
            <p className="mt-3 text-[14px] leading-snug text-cc-muted">
              {ticket.printCount === 0
                ? 'Not printed yet.'
                : `Printed ${ticket.printCount} ${ticket.printCount === 1 ? 'time' : 'times'}, last on ${new Date(ticket.printedAt ?? 0).toLocaleDateString('en-US')}.`}
            </p>
          </Panel>

          <Panel title="Job" padded={false}>
            {job ? (
              <button
                type="button"
                onClick={() => navigate(`/admin/jobs/${job.id}`)}
                className="row-hover flex w-full items-center gap-4 border-t border-line px-5 py-4 text-left hover:bg-white/[0.04]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {job.description}
                  </span>
                  <span className="mt-0.5 block font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                    {job.date}
                  </span>
                </span>
                <span className="shrink-0 font-display display-tight tnum text-[18px]">
                  {usd(job.agreedAmount)}
                </span>
              </button>
            ) : (
              <div className="border-t border-line px-5 py-5 text-[15px] leading-snug text-cc-muted">
                Standalone ticket. There is no job behind this one, and that is a normal way
                to work.
              </div>
            )}
          </Panel>

          {!voided && (
            <Panel title="Change this ticket">
              {editWarning ? (
                <div className="space-y-3">
                  <p className="text-[15px] leading-snug text-ink/85">
                    This ticket is finalised and the customer may already have a copy.
                    Editing it changes a record of what was delivered, and the change is
                    written into the ticket history.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton
                      size="sm"
                      onClick={() => navigate(`/admin/tickets/${ticket.id}/edit`)}
                    >
                      Edit anyway
                    </SecondaryButton>
                    <QuietButton size="sm" onClick={() => setEditWarning(false)}>
                      Leave it
                    </QuietButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton size="sm" onClick={() => setEditWarning(true)}>
                    Edit Ticket
                  </SecondaryButton>
                  <QuietButton size="sm" onClick={() => setVoidOpen(true)}>
                    Void Ticket
                  </QuietButton>
                </div>
              )}
            </Panel>
          )}

          {ticket.edits.length > 0 && (
            <Panel title="Ticket history" padded={false}>
              <div className="divide-y divide-line border-t border-line">
                {ticket.edits.map((edit) => (
                  <div key={edit.at} className="px-5 py-3.5">
                    <div className="font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                      {new Date(edit.at).toLocaleString('en-US')}
                    </div>
                    <div className="mt-0.5 text-[15px] text-ink">{edit.note}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/*
            Archival. It is kept because deleting history is not something this
            product does, and it is deliberately the quietest thing on the screen
            because nothing about it should ever be acted on.
          */}
          {ticket.legacyPaymentStatus && (
            <div className="rounded-panel border border-white/[0.05] px-5 py-4">
              <div className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-idle">
                Legacy field
              </div>
              <p className="mt-2 text-[13px] leading-snug text-idle">
                This ticket carries an old payment flag of{' '}
                <span className="text-cc-muted">{ticket.legacyPaymentStatus}</span>. Payment
                now lives on the Invoice and the Payment, not on the ticket. The old value
                is kept for history and is not used to decide anything.
              </p>
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        eyebrow="4 x 6 thermal label"
        title="Print preview"
        footer={
          <div className="space-y-3">
            <PrimaryButton
              fullWidth
              onClick={() => {
                printTicket(ticket.id)
                setPrintOpen(false)
              }}
            >
              Send to printer
            </PrimaryButton>
            <p className="text-[13px] leading-snug text-cc-muted">
              The printer path is still being decided between the share sheet and direct
              AirPrint. This preview is the artifact either path sends.
            </p>
          </div>
        }
      >
        <div className="p-5">
          <TicketLabelPreview ticket={ticket} customerName={customer?.name ?? 'Customer'} />
        </div>
      </Sheet>

      <Sheet
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        eyebrow="This cannot be undone"
        title="Void ticket"
        footer={
          <PrimaryButton
            fullWidth
            disabled={voidReason.trim().length === 0}
            onClick={() => {
              voidTicket(ticket.id, voidReason.trim())
              setVoidOpen(false)
            }}
          >
            Void this ticket
          </PrimaryButton>
        }
      >
        <div className="space-y-4 p-5">
          <p className="text-[15px] leading-snug text-cc-muted">
            Voiding keeps the ticket and everything on it. Nothing is deleted, the record
            stays in the customer history with the reason you give here.
          </p>
          <TextArea
            label="Why is it being voided"
            value={voidReason}
            onChange={setVoidReason}
            rows={3}
            placeholder="Written on the wrong customer, replaced the same day"
          />
        </div>
      </Sheet>
    </div>
  )
}

/** Supporting fact on the platinum plate. Near black on a light surface. */
function PlateField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-canvas/70">
        {label}
      </div>
      <div className="mt-1.5 text-[16px] font-semibold leading-snug text-canvas">{value}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0 font-label text-[13px] uppercase tracking-[0.1em] text-cc-muted">
        {label}
      </span>
      <span className="shrink-0 tnum text-[16px] text-ink">{value}</span>
    </div>
  )
}
