import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AlertCircle, CheckCircle2, Plus, X } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { effectiveTaxRate } from '@/control-center/billing'
import { DeliverySheet } from '@/control-center/approved/components/sales/DeliverySheet'
import { MaterialLineRow } from '@/control-center/approved/components/sales/MaterialLineRow'
import { MaterialSheet } from '@/control-center/approved/components/sales/MaterialSheet'
import { DriverPicker } from '@/control-center/approved/components/tickets/DriverPicker'
import { PrimaryButton, QuietButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { cn } from '@/control-center/approved/lib/cn'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { CustomerPicker } from '@/control-center/approved/components/ui/CustomerPicker'
import { Stepper, TextArea, TextField } from '@/control-center/approved/components/ui/Field'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { PinnedTotalBar } from '@/control-center/approved/components/ui/PinnedTotalBar'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { formatTaxRate, usd, usdExact } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import {
  buildMaterialLine,
  computeTotals,
  deliveryLabel,
  materialById,
  suggestedDeliveryLoads,
  type DeliverySelection,
  type MaterialLine,
} from '@/control-center/approved/state/pricing'
import { useDemoMode } from '@/control-center/demo/DemoMode'
import { QA_MISSING_DELIVERY_CUSTOMER_ID, QA_MISSING_DELIVERY_MATERIAL_ID } from '@/control-center/demo/constants'

/**
 * Ticket builder.
 *
 * One ticket, as many materials and as many loads as the day actually had. The
 * running total never leaves the screen, and nothing entered here is thrown away
 * by a save that cannot reach the server, it queues instead.
 */
export function TicketBuilder() {
  const { ticketId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const demo = useDemoMode()
  const {
    customers,
    customerById,
    jobById,
    ticketById,
    saveTicket,
    updateTicket,
    printTicket,
    sync,
    sourceData,
  } = useAppState()

  const editing = ticketId ? ticketById(ticketId) : undefined
  const fromJob = params.get('job') ? jobById(params.get('job') as string) : undefined
  const missingDeliveryFixture = demo.enabled && params.get('fixture') === 'missing-delivery'
  const missingDeliveryMaterial = missingDeliveryFixture ? materialById(QA_MISSING_DELIVERY_MATERIAL_ID) : undefined

  const [customerId, setCustomerId] = useState(
    editing?.customerId ?? fromJob?.customerId ?? (missingDeliveryFixture ? QA_MISSING_DELIVERY_CUSTOMER_ID : ''),
  )
  const [driverId, setDriverId] = useState(editing?.driverId ?? '')
  const [address, setAddress] = useState(editing?.address ?? fromJob?.address ?? (missingDeliveryFixture ? '2290 County Road 4104, Kaufman' : ''))
  const [lines, setLines] = useState<MaterialLine[]>(editing?.materialLines ?? (missingDeliveryMaterial ? [buildMaterialLine('qa-missing-delivery-line', missingDeliveryMaterial, { isFullLoad: true, loads: 1 })] : []))
  const [delivery, setDelivery] = useState<DeliverySelection>(
    editing?.delivery ?? { mode: 'UNSET' },
  )
  const [deliveryLoads, setDeliveryLoads] = useState(editing?.deliveryLoads ?? 1)
  /** True once Salvador has set the delivery count himself, so adding a line stops overwriting it. */
  const [loadsOverridden, setLoadsOverridden] = useState(Boolean(editing))
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [editNote, setEditNote] = useState('')

  const [materialSheet, setMaterialSheet] = useState(false)
  const [deliverySheet, setDeliverySheet] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const lineSeed = useRef(0)

  /**
   * A save has been attempted. The flagged sections are derived from the live
   * problems rather than stored, so a section stops being red the moment it is
   * filled in, instead of staying red until the next save.
   */
  const [attempted, setAttempted] = useState(false)
  const whoRef = useRef<HTMLDivElement>(null)
  const materialRef = useRef<HTMLDivElement>(null)
  const deliveryRef = useRef<HTMLDivElement>(null)

  const jobId = editing?.jobId ?? fromJob?.id
  const job = jobId ? jobById(jobId) : undefined
  const totals = useMemo(
    () => computeTotals({
      materialLines: lines,
      customLines: [],
      delivery,
      deliveryLoads,
      taxRate: effectiveTaxRate(sourceData?.appSettings),
      taxOnDelivery: sourceData?.appSettings?.tax_applies_to_delivery ?? true,
    }),
    [delivery, deliveryLoads, lines, sourceData?.appSettings],
  )

  const suggested = suggestedDeliveryLoads(lines)
  const deliveryUnset = delivery.mode === 'UNSET'
  const ticketSettings = sourceData?.appSettings
  const materialCatalogReady = Boolean(sourceData?.materials.some((material) => material.is_active))
  const deliveryPricingReady = Boolean(ticketSettings && [
    ticketSettings.delivery_tier_1_fee,
    ticketSettings.delivery_tier_2_fee,
    ticketSettings.delivery_tier_3_fee,
    ticketSettings.delivery_overage_base_fee,
    ticketSettings.delivery_overage_per_mile,
  ].every((value) => Number.isFinite(Number(value))))
  const rawConfiguredTaxRate = Number(ticketSettings?.tax_rate)
  const taxEnabled = ticketSettings?.tax_enabled ?? (Number.isFinite(rawConfiguredTaxRate) && rawConfiguredTaxRate > 0)
  const taxPricingReady = Boolean(
    ticketSettings
      && (!taxEnabled || (
        Number.isFinite(rawConfiguredTaxRate)
        && rawConfiguredTaxRate > 0
        && rawConfiguredTaxRate <= 100
      )),
  )
  const setupProblems = [
    !materialCatalogReady && 'No active materials are configured',
    !deliveryPricingReady && 'Delivery pricing is not configured',
    !taxPricingReady && 'Ticket tax is not configured',
  ].filter(Boolean) as string[]

  /**
   * Adding material updates the SUGGESTED delivery load count, but never
   * overwrites a count Salvador set himself. The two numbers are related by
   * default and independent when the real trips differ from the line loads.
   */
  const syncSuggestedLoads = (next: MaterialLine[]) => {
    if (!loadsOverridden) setDeliveryLoads(suggestedDeliveryLoads(next))
  }

  const addLine = (
    materialId: string,
    options: { isFullLoad: boolean; loads?: number; yards?: number },
  ) => {
    const material = materialById(materialId)
    if (!material) return
    lineSeed.current += 1
    const next = [...lines, buildMaterialLine(`draft-${lineSeed.current}`, material, options)]
    setLines(next)
    syncSuggestedLoads(next)
  }

  const removeLine = (id: string) => {
    const next = lines.filter((line) => line.id !== id)
    setLines(next)
    syncSuggestedLoads(next)
  }

  /**
   * What is stopping this ticket from being saved, in the order the form asks
   * for it. Derived, never stored, so it can never disagree with the fields.
   */
  const problems: Problem[] = [
    setupProblems.length > 0 && {
      section: 'delivery' as SectionId,
      message: setupProblems.join(' and '),
    },
    !customerId && { section: 'who' as SectionId, message: 'A customer is still required' },
    !address.trim() && { section: 'who' as SectionId, message: 'A job site address is still required' },
    lines.length === 0 && {
      section: 'material' as SectionId,
      message: 'At least one material is still required',
    },
    lines.some((line) => line.yards <= 0 || line.lineTotal <= 0) && {
      section: 'material' as SectionId,
      message: 'Every material needs a valid quantity',
    },
    deliveryUnset && {
      section: 'delivery' as SectionId,
      message: 'Delivery is still required',
    },
    delivery.mode === 'OVER_10' && (delivery.miles ?? 0) <= 10 && {
      section: 'delivery' as SectionId,
      message: 'Enter total mileage greater than 10 miles',
    },
  ].filter(Boolean) as Problem[]

  /**
   * Takes Salvador to the problem instead of describing it and leaving him to
   * find it. Scrolls the section into view, and puts focus on the control that
   * actually resolves it where there is one.
   */
  const goToProblem = (problem: Problem) => {
    const targets: Partial<Record<SectionId, RefObject<HTMLDivElement>>> = {
      who: whoRef,
      material: materialRef,
      delivery: deliveryRef,
    }
    targets[problem.section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Land on the control that resolves it, once the scroll has settled.
    window.setTimeout(() => {
      document.getElementById(FOCUS_TARGET[problem.section] ?? '')?.focus()
    }, 340)
  }

  const missing = attempted
    ? new Set(problems.map((problem) => problem.section))
    : new Set<SectionId>()

  const save = async () => {
    if (problems.length > 0) {
      setAttempted(true)
      goToProblem(problems[0])
      return
    }
    setAttempted(false)
    if (editing && editNote.trim().length === 0) return
    const input = {
      customerId,
      jobId,
      driverId,
      address,
      materialLines: lines,
      delivery,
      deliveryLoads,
      notes,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateTicket(editing.id, input, editNote.trim())
        navigate(`/admin/tickets/${editing.id}`)
        return
      }
      setSavedId(await saveTicket(input))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ticket could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  /* ------------------------------------------------------------ saved view */

  const saved = savedId ? ticketById(savedId) : undefined
  if (saved) {
    const pending = saved.sync === 'PENDING'
    return (
      <div className="space-y-5">
        <RecordHeader
          eyebrow="Ticket"
          title={saved.number ?? 'Saved on the device'}
          onBack={() => navigate('/admin/tickets')}
        />

        <Panel>
          <div className="flex flex-col items-center py-6 text-center">
            <span
              className={
                pending
                  ? 'flex h-14 w-14 items-center justify-center rounded-2xl border border-warn/40 bg-warn/10 text-warn'
                  : 'flex h-14 w-14 items-center justify-center rounded-2xl border border-ok/40 bg-ok/10 text-ok'
              }
            >
              <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
            </span>

            <h2 className="mt-5 font-display display-tight text-[40px]">
              {saved.number ?? 'Saved here'}
            </h2>
            <p className="mt-2 max-w-[46ch] text-[16px] leading-snug text-cc-muted">
              {pending
                ? 'No signal right now, so it is saved on this device. It takes its number the moment it syncs, which keeps the sequence in order.'
                : 'Ticket saved. Print it for the customer or come back to it any time.'}
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <PrimaryButton
                onClick={() => {
                  printTicket(saved.id)
                  navigate(`/admin/tickets/${saved.id}?print=1`)
                }}
              >
                Print Ticket
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate(`/admin/tickets/${saved.id}`)}>
                View Ticket
              </SecondaryButton>
              <QuietButton onClick={() => navigate('/admin/tickets')}>Done</QuietButton>
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  /* ---------------------------------------------------------- builder view */

  return (
    <div className="space-y-5">
      <RecordHeader
        eyebrow={editing ? `Editing ${editing.number ?? 'ticket'}` : 'New ticket'}
        title={customerById(customerId)?.name ?? 'Ticket'}
        onBack={() => navigate(editing ? `/admin/tickets/${editing.id}` : '/admin/tickets')}
      />

      {editing && (
        <div className="rounded-panel border border-warn/40 bg-warn/10 p-4 text-[15px] leading-snug text-warn">
          You are changing a ticket that was already finalised and may already be in the
          customer's hands. The change is recorded in the ticket history.
        </div>
      )}

      {sync !== 'synced' && (
        <div className="rounded-panel border border-warn/40 bg-warn/10 p-4 text-[15px] leading-snug text-warn">
          No signal. You can keep working, the ticket saves on this device and syncs when
          the connection comes back. Nothing you type here is lost.
        </div>
      )}

      {setupProblems.length > 0 && (
        <div className="rounded-panel border border-warn/40 bg-warn/10 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="font-label text-[13px] font-semibold uppercase tracking-[0.12em] text-warn">Ticket setup required</div>
            <p className="mt-1 text-[14px] leading-snug text-ink/80">{setupProblems.join('. ')}. Saving is held until current pricing is safe.</p>
          </div>
          <SecondaryButton className="mt-3 shrink-0 sm:mt-0" size="sm" onClick={() => navigate('/admin/settings/materials')}>
            Review settings
          </SecondaryButton>
        </div>
      )}

      {/*
        Something was attempted and could not be saved. This is the only place the
        builder raises its voice, and it names what is missing rather than leaving
        a dead Save button to be reasoned about.
      */}
      {attempted && problems.length > 0 && (
        <div className="animate-rise rounded-panel border border-mt-red/50 bg-mt-red/[0.1] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-mt-red" strokeWidth={2.2} />
            <span className="font-label text-[14px] font-semibold uppercase tracking-[0.1em] text-mt-red">
              {problems.length === 1
                ? problems[0].message
                : `${problems.length} things still need to be completed`}
            </span>
          </div>
          {problems.length > 1 && (
            <ul className="mt-3 space-y-1.5">
              {problems.map((problem) => (
                <li key={problem.section} className="text-[15px] leading-snug text-ink/85">
                  {problem.message}
                </li>
              ))}
            </ul>
          )}
          <QuietButton
            size="sm"
            className="-ml-1 mt-3 px-1 text-mt-red hover:text-mt-red"
            onClick={() => goToProblem(problems[0])}
          >
            Take me there
          </QuietButton>
        </div>
      )}

      {/*
        One continuous form. Sections are told apart by a label, a divider and
        their own rhythm, not by being scattered into separate floating cards, so
        the ticket is filled top to bottom in a single pass.
      */}
      <Panel padded={false}>
        <FormSection
          id="who"
          label="Who and where"
          missing={missing.has('who')}
          nodeRef={whoRef}
        >
          {job ? (
            <div className="rounded-xl border border-ice/30 bg-ice/10 p-4">
              <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-ice">
                From job
              </div>
              <div className="mt-1.5 text-[15px] font-semibold text-ink">
                {customerById(job.customerId)?.name}
              </div>
              <div className="text-[14px] text-cc-muted">{job.description}</div>
            </div>
          ) : (
            <CustomerPicker
              value={customerId}
              onChange={setCustomerId}
              allowCreate
              createLabel="Add them as a new customer"
              hint="Search by name, phone or email."
            />
          )}

          <TextField
            label="Job site address"
            value={address}
            onChange={setAddress}
            placeholder="Where it went"
          />

          <DriverPicker value={driverId} onChange={setDriverId} />
        </FormSection>

        <FormSection
          id="material"
          label="Material"
          missing={missing.has('material')}
          nodeRef={materialRef}
          right={
            lines.length > 0 && (
              <SecondaryButton
                size="sm"
                onClick={() => setMaterialSheet(true)}
                icon={<Plus className="h-4 w-4" strokeWidth={2.6} />}
              >
                Add
              </SecondaryButton>
            )
          }
          bare={lines.length > 0}
        >
          {lines.length === 0 ? (
            <EmptyState
              title="Nothing on the ticket yet"
              line="Add every material that went out. Three loads of one and two of another all live on this one ticket."
              action={
                <SecondaryButton size="sm" onClick={() => setMaterialSheet(true)}>
                  Add material
                </SecondaryButton>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {lines.map((line) => (
                <MaterialLineRow
                  key={line.id}
                  line={line}
                  action={
                    <button
                      type="button"
                      aria-label="Remove line"
                      onClick={() => removeLine(line.id)}
                      className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-idle transition-colors hover:bg-white/[0.07] hover:text-ink"
                    >
                      <X className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </FormSection>

        <FormSection
          id="delivery"
          label="Delivery"
          missing={missing.has('delivery')}
          nodeRef={deliveryRef}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div
                className={
                  deliveryUnset
                    ? 'text-[17px] font-semibold text-mt-red'
                    : 'text-[17px] font-semibold text-ink'
                }
              >
                {deliveryLabel(delivery)}
              </div>
              <div className="mt-1 text-[14px] text-cc-muted">
                {deliveryUnset
                  ? 'Pick a zone, or customer pickup'
                  : `${usd(totals.deliveryPerLoad)} per load`}
              </div>
            </div>
            <SecondaryButton
              id="ticket-delivery-choose"
              size="sm"
              onClick={() => setDeliverySheet(true)}
            >
              {deliveryUnset ? 'Choose delivery' : 'Change'}
            </SecondaryButton>
          </div>

          <div>
            <div className="mb-2 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
              Delivery loads
            </div>
            <Stepper
              value={deliveryLoads}
              onChange={(value) => {
                setLoadsOverridden(true)
                setDeliveryLoads(value)
              }}
              min={1}
              max={40}
            />
            <p className="mt-3 text-[13px] leading-snug text-cc-muted">
              This is the number of real trips, and it is what delivery is charged on. It
              starts from the loads on the material lines and stays yours to correct.
            </p>
            {loadsOverridden && deliveryLoads !== suggested && lines.length > 0 && (
              <p className="mt-2 text-[13px] leading-snug text-warn">
                The material lines add up to {suggested}{' '}
                {suggested === 1 ? 'load' : 'loads'}. You set delivery to {deliveryLoads},
                which is kept.
              </p>
            )}
          </div>
        </FormSection>

        <FormSection id="notes" label="Notes">
          <TextArea
            value={notes}
            onChange={setNotes}
            rows={2}
            placeholder="Where it was dropped, who signed, anything worth keeping"
          />
          {editing && (
            <TextField
              label="Why this ticket is changing"
              value={editNote}
              onChange={setEditNote}
              placeholder="Recorded in the ticket history"
              hint="Required. The reason stays with the historical correction."
            />
          )}
        </FormSection>

        <FormSection id="total" label="Total" last>
          <dl className="space-y-3">
            <Row label="Material" value={usdExact(totals.materials)} />
            <Row
              label={`Delivery, ${deliveryLoads} ${deliveryLoads === 1 ? 'load' : 'loads'}`}
              value={usdExact(totals.delivery)}
            />
            <Row
              label={`Tax ${formatTaxRate(totals.taxRate)}`}
              value={usdExact(totals.tax)}
            />
          </dl>
          <div className="flex items-end justify-between gap-4 border-t border-line pt-4">
            <span className="font-label text-[13px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
              Total
            </span>
            <span className="num-safe font-display display-tight tnum text-[38px]">
              {usdExact(totals.total)}
            </span>
          </div>
        </FormSection>
      </Panel>

      <div className="h-24 lg:hidden" />
      <PinnedTotalBar
        label={lines.length === 0 ? 'Nothing on this ticket yet' : 'Ticket total'}
        total={usdExact(totals.total)}
        note={
          lines.length === 0
            ? 'Add material to get started'
            : deliveryUnset
              ? 'Pick a delivery zone'
              : `${lines.length} material ${lines.length === 1 ? 'line' : 'lines'}, ${deliveryLoads} ${deliveryLoads === 1 ? 'load' : 'loads'}`
        }
        action={
          <PrimaryButton
            onClick={save}
            disabled={saving || Boolean(editing && editNote.trim().length === 0)}
          >
            {saving ? 'Saving' : editing ? 'Save Changes' : 'Save Ticket'}
          </PrimaryButton>
        }
      />

      <MaterialSheet
        open={materialSheet}
        onClose={() => setMaterialSheet(false)}
        onAdd={addLine}
      />
      <DeliverySheet
        open={deliverySheet}
        onClose={() => setDeliverySheet(false)}
        delivery={delivery}
        deliveryLoads={deliveryLoads}
        onApply={setDelivery}
      />
    </div>
  )
}

type SectionId = 'who' | 'material' | 'delivery' | 'notes' | 'total'
type Problem = { section: SectionId; message: string }

/** The control that actually resolves each section, focused after the scroll. */
const FOCUS_TARGET: Partial<Record<SectionId, string>> = {
  delivery: 'ticket-delivery-choose',
}

/**
 * One band of the form.
 *
 * Sections are separated by a label, a divider and their own spacing rather than
 * by being cut into floating cards, so the builder reads as a single sheet worked
 * top to bottom. A section that is holding up the save turns red at the label and
 * along its leading edge, which is enough to find it after a scroll without
 * shouting over the rest of the form.
 */
function FormSection({
  id,
  label,
  children,
  right,
  missing,
  nodeRef,
  bare,
  last,
}: {
  id: SectionId
  label: string
  children: ReactNode
  right?: ReactNode
  missing?: boolean
  nodeRef?: RefObject<HTMLDivElement>
  /** Rows supply their own padding, so the body drops its own. */
  bare?: boolean
  last?: boolean
}) {
  return (
    <section
      id={`ticket-${id}`}
      ref={nodeRef}
      className={cn(
        'scroll-mt-28 transition-colors',
        !last && 'border-b border-line',
        missing && 'bg-mt-red/[0.06] shadow-[inset_3px_0_0_0_#FF3131]',
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 lg:px-6">
        <h2
          className={cn(
            'flex items-center gap-2.5 font-label text-[12px] font-semibold uppercase tracking-[0.22em]',
            missing ? 'text-mt-red' : 'text-ink/85',
          )}
        >
          <span
            className={cn(
              'h-[11px] w-[3px] shrink-0 rounded-full',
              missing ? 'bg-mt-red' : 'bg-ice',
            )}
          />
          {label}
        </h2>
        {right}
      </header>
      <div className={cn('space-y-4', bare ? 'pb-2' : 'px-5 pb-6 lg:px-6')}>{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="min-w-0 font-label text-[13px] uppercase tracking-[0.1em] text-cc-muted">
        {label}
      </dt>
      <dd className="shrink-0 tnum text-[16px] text-ink">{value}</dd>
    </div>
  )
}
