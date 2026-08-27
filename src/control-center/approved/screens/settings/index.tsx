import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, Copy, Link2, Printer, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { PrimaryButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { SelectField, Stepper, TextArea, TextField } from '@/control-center/approved/components/ui/Field'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { StatusPill, type PillTone } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import { shortAgo, usd } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { AI_SAMPLES, type AutomationStatus } from '@/control-center/approved/state/automationData'
import { DELIVERY_OPTIONS, MATERIALS, TAX_RATE } from '@/control-center/approved/state/pricing'
import {
  BUSINESS,
  LINK_SOURCES,
  PRINTING,
} from '@/control-center/approved/state/settingsData'
import { controlDb } from '@/control-center/data'
import { useControlCenter } from '@/control-center/context'
import { useDemoMode } from '@/control-center/demo/DemoMode'
import { QA_FIXTURE_USER_ID } from '@/control-center/demo/constants'
import { supabase } from '@/integrations/supabase/client'
import { outputTicketPng, renderTicketPng } from '@/lib/admin/print'
import { buildAutomationPreviews } from '@/control-center/ai/automationDryRun'
import { generateAutomationDraft } from '@/control-center/ai/service'

/* ------------------------------------------------------------------ shared */

function SettingsScreen({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <RecordHeader
        eyebrow="Settings"
        title={title}
        onBack={() => navigate('/admin/settings')}
      />
      {children}
    </div>
  )
}

function StatusRow({
  label,
  value,
  tone = 'neutral',
  line,
}: {
  label: string
  value: string
  tone?: PillTone
  line?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="font-label text-[13px] font-semibold uppercase tracking-[0.1em] text-ink">
          {label}
        </div>
        {line && <div className="mt-0.5 text-[14px] leading-snug text-cc-muted">{line}</div>}
      </div>
      <StatusPill tone={tone} size="sm" className="shrink-0">
        {value}
      </StatusPill>
    </div>
  )
}

const AUTOMATION_TONE: Record<AutomationStatus, PillTone> = {
  ON: 'ok',
  SETUP_REQUIRED: 'warn',
  OFF: 'idle',
}

const AUTOMATION_LABEL: Record<AutomationStatus, string> = {
  ON: 'On',
  SETUP_REQUIRED: 'Setup required',
  OFF: 'Off',
}

/* ---------------------------------------------------------------- business */

export function SettingsBusiness() {
  const { sourceData } = useAppState()
  const { refresh } = useControlCenter()
  const demo = useDemoMode()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [dueDays, setDueDays] = useState(3)
  const [taxOnDelivery, setTaxOnDelivery] = useState(true)
  const [customWorkTax, setCustomWorkTax] = useState<'PENDING' | 'TAXED' | 'NOT_TAXED'>('PENDING')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const business = sourceData?.appSettings
    const control = sourceData?.controlSettings
    if (business) {
      setName(business.company_name)
      setPhone(business.company_phone)
      setAddress(business.company_address)
      setTaxOnDelivery(business.tax_applies_to_delivery)
    }
    if (control) {
      setEmail(control.company_email ?? '')
      setDueDays(control.default_invoice_due_days)
      setCustomWorkTax(control.custom_work_tax_rule === 'EXEMPT' ? 'NOT_TAXED' : control.custom_work_tax_rule)
    }
  }, [sourceData])

  const save = async () => {
    if (!sourceData?.appSettings || !sourceData.controlSettings) return
    setSaving(true)
    try {
      if (demo.enabled) {
        const now = new Date().toISOString()
        demo.updateData((current) => ({
          ...current,
          appSettings: current.appSettings ? { ...current.appSettings, company_name: name.trim(), company_phone: phone.trim(), company_address: address.trim(), tax_applies_to_delivery: taxOnDelivery, updated_at: now } : null,
          controlSettings: current.controlSettings ? { ...current.controlSettings, company_email: email.trim() || null, default_invoice_due_days: dueDays, custom_work_tax_rule: customWorkTax === 'NOT_TAXED' ? 'EXEMPT' : customWorkTax, updated_at: now } : null,
        }))
        toast.success('Business settings saved in demo memory.')
        return
      }
      const [business, control] = await Promise.all([
        supabase.from('app_settings').update({
          company_name: name.trim(),
          company_phone: phone.trim(),
          company_address: address.trim(),
          tax_applies_to_delivery: taxOnDelivery,
        }).eq('id', sourceData.appSettings.id),
        controlDb.from('control_center_settings').update({
          company_email: email.trim() || null,
          default_invoice_due_days: dueDays,
          custom_work_tax_rule: customWorkTax === 'NOT_TAXED' ? 'EXEMPT' : customWorkTax,
        }).eq('id', 1),
      ])
      if (business.error) throw new Error(business.error.message)
      if (control.error) throw new Error(control.error.message)
      await refresh()
      toast.success('Business settings saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Business settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsScreen title="Business">
      <Panel title="Company">
        <div className="space-y-4">
          <TextField label="Company name" value={name} onChange={setName} />
          <TextField
            label="Phone"
            value={phone}
            onChange={setPhone}
            inputMode="tel"
            placeholder="Prints on every ticket"
            hint={phone ? undefined : 'Needed before launch. It prints on the ticket.'}
          />
          <TextField
            label="Email"
            value={email}
            onChange={setEmail}
            inputMode="email"
            placeholder="Goes on invoices"
            hint={email ? undefined : 'Needed before launch.'}
          />
          <TextArea label="Address" value={address} onChange={setAddress} rows={2} />
        </div>
      </Panel>

      <Panel title="Tax">
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
                Rate
              </div>
              <div className="mt-1 font-display display-tight tnum text-[36px]">
                {((sourceData?.appSettings?.tax_rate ?? TAX_RATE) * 100).toFixed(2)}%
              </div>
              <div className="mt-1 text-[14px] text-cc-muted">The Kaufman rate.</div>
            </div>
          </div>

          <Toggle
            label="Charge tax on delivery"
            line="Off means tax applies to material only."
            value={taxOnDelivery}
            onChange={setTaxOnDelivery}
          />

          {/*
            Internal only. This question is never phrased on a customer facing
            quote or invoice, it lives here as an admin decision.
          */}
          <div className="rounded-panel border border-warn/40 bg-warn/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-label text-[13px] font-semibold uppercase tracking-[0.12em] text-warn">
                Custom work tax
              </span>
              {customWorkTax === 'PENDING' && (
                <StatusPill tone="warn" size="sm">
                  Setup required
                </StatusPill>
              )}
            </div>
            <p className="mt-2 text-[14px] leading-snug text-ink/80">
              The ticket system only defines tax on material and delivery. Until this is
              set, service work stays out of the taxable base. This is a prelaunch item.
            </p>
            <div className="mt-4">
              <SegmentControl
                options={[
                  { value: 'PENDING' as const, label: 'Not set' },
                  { value: 'TAXED' as const, label: 'Taxed' },
                  { value: 'NOT_TAXED' as const, label: 'Not taxed' },
                ]}
                value={customWorkTax}
                onChange={setCustomWorkTax}
                size="sm"
              />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Invoicing">
        <div className="space-y-5">
          <div>
            <div className="mb-2 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
              Default due days
            </div>
            <Stepper value={dueDays} onChange={setDueDays} min={0} max={30} suffix="days" />
          </div>
          <div>
            <div className="mb-2 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
              Payment methods
            </div>
            <div className="flex flex-wrap gap-2">
              {BUSINESS.paymentMethods.map((method) => (
                <StatusPill key={method} tone="neutral" size="sm">
                  {method}
                </StatusPill>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel padded={false} title="Logo">
        <div className="border-t border-line">
          <StatusRow
            label="Printable logo"
            value="Setup required"
            tone="warn"
            line="The label needs a bold, simplified, high contrast bitmap. The detailed logo turns to mud at 203 dpi."
          />
        </div>
      </Panel>

      <div className="flex justify-end">
        <PrimaryButton onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving' : 'Save Changes'}
        </PrimaryButton>
      </div>
    </SettingsScreen>
  )
}

/* --------------------------------------------------- materials and delivery */

export function SettingsMaterials() {
  return (
    <SettingsScreen title="Materials & Delivery">
      <Panel padded={false} title={`${MATERIALS.length} materials`}>
        <div className="divide-y divide-line border-t border-line">
          {MATERIALS.map((material) => (
            <div key={material.id} className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-ink">{material.name}</div>
                <div className="mt-0.5 font-label text-[12px] uppercase tracking-[0.08em] text-cc-muted">
                  {material.fullLoadYards} yards to a full load
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display display-tight tnum text-[20px]">
                  {usd(material.pricePerYard)}
                </div>
                <div className="font-label text-[11px] uppercase tracking-[0.1em] text-idle">
                  per yard
                </div>
              </div>
              <div className="w-[92px] shrink-0 text-right">
                <div className="font-display display-tight tnum text-[20px] text-ice">
                  {usd(material.fullLoadPrice)}
                </div>
                <div className="font-label text-[11px] uppercase tracking-[0.1em] text-idle">
                  full load
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-cc-muted">
          This is the one price list. Quotes and Tickets both read it, and there is never a
          second one. A material that stops being sold is made inactive, never deleted, so
          old tickets keep their history.
        </p>
      </Panel>

      <Panel padded={false} title="Delivery">
        <div className="divide-y divide-line border-t border-line">
          {DELIVERY_OPTIONS.map((option) => (
            <div key={option.mode} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <span className="text-[15px] font-semibold text-ink">{option.label}</span>
              <span className="font-label text-[13px] uppercase tracking-[0.08em] text-cc-muted">
                {option.hint}
              </span>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-cc-muted">
          Delivery is charged per load and multiplied by the delivery load count on the
          record. Everything is sold in yards, tons are not used anywhere.
        </p>
      </Panel>
    </SettingsScreen>
  )
}

/* ----------------------------------------------------------------- workers */

export function SettingsWorkers() {
  const { workers } = useAppState()

  return (
    <SettingsScreen title="Workers">
      <Panel padded={false} title={`${workers.length} on the crew`}>
        <div className="divide-y divide-line border-t border-line">
          {workers.map((worker) => (
            <div key={worker.id} className="flex items-start gap-4 px-5 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-raised font-label text-[15px] font-semibold text-cc-muted">
                {worker.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[16px] font-semibold text-ink">{worker.name}</span>
                  {worker.isDriver && (
                    <StatusPill tone="ice" size="sm">
                      Driver
                    </StatusPill>
                  )}
                  <StatusPill tone={worker.isActive ? 'ok' : 'idle'} size="sm">
                    {worker.isActive ? 'Active' : 'Inactive'}
                  </StatusPill>
                </div>
                <div className="mt-1 font-label text-[13px] uppercase tracking-[0.08em] text-cc-muted">
                  {worker.payType === 'HOURLY'
                    ? `${usd(worker.hourlyRate ?? 0)} an hour`
                    : 'Paid by loads and routes'}
                </div>
                {worker.notes && (
                  <div className="mt-1 text-[14px] leading-snug text-cc-muted">{worker.notes}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-5 py-4">
          {workers.length === 0 && (
            <StatusPill tone="warn" size="sm">
              Setup required
            </StatusPill>
          )}
          <p className="mt-2 text-[13px] leading-snug text-cc-muted">
            {workers.length === 0 ? 'Add the real roster before launch. ' : ''}
            Workers never get a login, a portal or a time clock.
          </p>
        </div>
      </Panel>
    </SettingsScreen>
  )
}

/* ------------------------------------------------------- communication and AI */

export function SettingsCommunication() {
  const { sourceData } = useAppState()
  const { refresh } = useControlCenter()
  const demo = useDemoMode()
  const [number, setNumber] = useState('')
  const [english, setEnglish] = useState(true)
  const [spanish, setSpanish] = useState(true)
  const [takeover, setTakeover] = useState(true)
  const [openRule, setOpenRule] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewDrafts, setPreviewDrafts] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<Record<string, string>>({})
  const settings = sourceData?.controlSettings
  const automations = sourceData?.automations ?? []
  const previews = useMemo(() => sourceData ? buildAutomationPreviews(sourceData) : [], [sourceData])

  const generatePreview = async (ruleId: string) => {
    const preview = previews.find((item) => item.ruleId === ruleId)
    if (!preview) return
    setPreviewLoading(ruleId)
    setPreviewError((current) => ({ ...current, [ruleId]: '' }))
    try {
      const draft = await generateAutomationDraft({ preview, demo: demo.enabled })
      setPreviewDrafts((current) => ({ ...current, [ruleId]: draft }))
      if (!demo.enabled) await refresh()
    } catch (error) {
      setPreviewError((current) => ({ ...current, [ruleId]: error instanceof Error ? error.message : 'Preview generation failed.' }))
    } finally {
      setPreviewLoading(null)
    }
  }

  useEffect(() => {
    if (!settings) return
    setNumber(settings.business_number ?? '')
    setEnglish(settings.ai_english)
    setSpanish(settings.ai_spanish)
    setTakeover(settings.human_takeover_on_reply)
  }, [settings])

  const save = async () => {
    setSaving(true)
    try {
      if (demo.enabled) {
        const now = new Date().toISOString()
        demo.updateData((current) => ({ ...current, controlSettings: current.controlSettings ? { ...current.controlSettings, business_number: number.trim() || null, ai_english: english, ai_spanish: spanish, human_takeover_on_reply: takeover, updated_at: now } : null }))
        toast.success('Communication settings saved in demo memory.')
        return
      }
      const { error } = await controlDb.from('control_center_settings').update({
        business_number: number.trim() || null,
        ai_english: english,
        ai_spanish: spanish,
        human_takeover_on_reply: takeover,
      }).eq('id', 1)
      if (error) throw new Error(error.message)
      await refresh()
      toast.success('Communication settings saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Communication settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsScreen title="Communication & AI">
      <Panel title="The business number">
        <TextField
          label="Number"
          value={number}
          onChange={setNumber}
          inputMode="tel"
          placeholder="Not connected yet"
          hint="This is what keeps business texts off Salvador's personal phone. Every customer automation stays off until it is connected."
        />
      </Panel>

      <Panel padded={false} title="Channels">
        <div className="divide-y divide-line border-t border-line">
          <StatusRow label="SMS" value={setupLabel(settings?.sms_status)} tone={setupTone(settings?.sms_status)} line={settings?.sms_status === 'READY' ? 'Connected.' : 'Not connected.'} />
          <StatusRow label="Calling" value={setupLabel(settings?.calling_status)} tone={setupTone(settings?.calling_status)} line={settings?.calling_status === 'READY' ? 'Connected.' : 'Not connected.'} />
          <StatusRow
            label="AI replies"
            value="Draft ready"
            tone="ice"
            line="OpenAI drafts and dry runs are available internally. No customer transport is enabled."
          />
        </div>
      </Panel>

      <Panel title="How it talks">
        <div className="space-y-4">
          <Toggle label="English" line="Replies naturally in English." value={english} onChange={setEnglish} />
          <Toggle
            label="Spanish"
            line="Replies naturally in Spanish, and understands Spanglish either way."
            value={spanish}
            onChange={setSpanish}
          />
          <Toggle
            label="Human takeover"
            line="When you reply, the AI stops talking on that conversation."
            value={takeover}
            onChange={setTakeover}
          />
        </div>
        <p className="mt-4 text-[13px] leading-snug text-cc-muted">
          Dashboard copy stays English. The language rules apply to what customers receive.
        </p>
        <div className="mt-5">
          <PrimaryButton onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving' : 'Save Changes'}
          </PrimaryButton>
        </div>
      </Panel>

      <Panel padded={false} title={`${automations.length} automations`}>
        <div className="divide-y divide-line border-t border-line">
          {automations.map((rule) => {
            const open = openRule === rule.id
            const status = rule.status as AutomationStatus
            return (
              <div key={rule.id}>
                <button
                  type="button"
                  onClick={() => setOpenRule(open ? null : rule.id)}
                  className="row-hover flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold text-ink">{rule.name}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-cc-muted">
                      {rule.delay_description}
                    </span>
                  </span>
                  <StatusPill tone={AUTOMATION_TONE[status]} size="sm" className="shrink-0">
                    {AUTOMATION_LABEL[status]}
                  </StatusPill>
                </button>

                {open && (
                  <div className="space-y-4 border-t border-line bg-canvas/40 px-5 py-4">
                    <Detail label="Trigger" value={rule.trigger_description} />
                    <DetailList label="Conditions" values={jsonTextList(rule.conditions)} />
                    <Detail label="Action" value={rule.action_description} />
                    <DetailList label="Stops when" values={jsonTextList(rule.stop_conditions)} />
                    <Detail label="If it fails" value={rule.fallback_description} />
                    <Detail label="Logged" value={rule.log_description} />
                    {rule.id !== 'human-takeover' && (() => {
                      const preview = previews.find((item) => item.ruleId === rule.id)
                      if (!preview) return null
                      const draft = previewDrafts[rule.id] ?? preview.draft
                      return (
                        <div className="rounded-xl border border-ice/20 bg-ice/[0.06] p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone="ice" size="sm">Dry run</StatusPill>
                            <StatusPill tone={preview.eligible ? 'ok' : 'idle'} size="sm">
                              {preview.eligible ? 'Eligible' : 'Not eligible'}
                            </StatusPill>
                            <StatusPill tone="warn" size="sm">SMS setup required</StatusPill>
                          </div>
                          <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
                            <Detail label="Customer" value={preview.customerName} />
                            <Detail label="Language" value={preview.language} />
                            <Detail label="Why" value={preview.reason} />
                            <Detail label="Would run" value={preview.dueAt ? new Date(preview.dueAt).toLocaleString() : 'No due time'} />
                          </div>
                          {preview.blockedReason && <p className="mt-3 text-[13px] text-warn">Blocked: {preview.blockedReason}</p>}
                          <div className="mt-3 rounded-lg border border-white/[0.08] bg-canvas/50 p-3">
                            <div className="font-label text-[11px] font-semibold uppercase tracking-[0.12em] text-cc-muted">Customer draft</div>
                            <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{draft || 'No draft is generated while this rule has no customer subject.'}</p>
                          </div>
                          <p className="mt-3 text-[12px] text-cc-muted">Stops: {preview.stopConditions.join(', ')}</p>
                          {previewError[rule.id] && <p className="mt-3 text-[13px] text-mt-red">{previewError[rule.id]} Nothing was sent.</p>}
                          <div className="mt-4">
                            <SecondaryButton
                              size="sm"
                              disabled={!preview.subjectId || previewLoading === rule.id}
                              onClick={() => void generatePreview(rule.id)}
                              icon={<Sparkles className="h-4 w-4" />}
                            >
                              {previewLoading === rule.id ? 'Generating' : 'Generate contextual draft'}
                            </SecondaryButton>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel padded={false} title="How the AI sounds">
        <div className="divide-y divide-line border-t border-line">
          {AI_SAMPLES.map((sample) => (
            <div key={sample.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="ice" size="sm">
                  {sample.language}
                </StatusPill>
                <span className="font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                  {sample.context}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{sample.text}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-cc-muted">
          Lowercase start, short, friendly, no hyphens and no em dashes. It reads the whole
          conversation first and only asks for what is still missing. Anything that needs
          business judgement goes to Salvador instead of being guessed.
        </p>
      </Panel>
    </SettingsScreen>
  )
}

/* ---------------------------------------------------------- tracking links */

export function SettingsTracking() {
  const { sourceData } = useAppState()
  const { refresh } = useControlCenter()
  const demo = useDemoMode()
  const [source, setSource] = useState(LINK_SOURCES[0])
  const [campaign, setCampaign] = useState('')
  const [destination, setDestination] = useState('monkeytrucking.llc')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const links = sourceData?.trackingLinks ?? []

  const slug = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '-')
  const preview = `${destination}/?source=${slug(source)}${campaign ? `&campaign=${slug(campaign)}` : ''}`

  const generate = async () => {
    if (!campaign.trim()) {
      toast.error('Campaign is required.')
      return
    }
    setSaving(true)
    try {
      const uniqueSlug = `${slug(source)}-${slug(campaign)}-${Date.now().toString(36)}`
      if (demo.enabled) {
        const now = new Date().toISOString()
        demo.updateData((current) => ({ ...current, trackingLinks: [{ id: `qa-runtime-link-${current.trackingLinks.length + 1}`, source, campaign: campaign.trim(), destination: destination.trim(), slug: uniqueSlug, visits: 0, leads: 0, customers: 0, created_by: QA_FIXTURE_USER_ID, created_at: now }, ...current.trackingLinks] }))
        setCampaign('')
        toast.success('Tracking link created in demo memory.')
        return
      }
      const { error } = await controlDb.from('tracking_links').insert({
        source,
        campaign: campaign.trim(),
        destination: destination.trim(),
        slug: uniqueSlug,
      })
      if (error) throw new Error(error.message)
      await refresh()
      setCampaign('')
      toast.success('Tracking link created.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tracking link could not be created.')
    } finally {
      setSaving(false)
    }
  }

  const linkUrl = (link: (typeof links)[number]) =>
    `${link.destination}/?source=${slug(link.source)}${link.campaign ? `&campaign=${slug(link.campaign)}` : ''}`

  const copy = (link: (typeof links)[number]) => {
    navigator.clipboard?.writeText(linkUrl(link))
    setCopiedId(link.id)
    window.setTimeout(() => setCopiedId((current) => (current === link.id ? null : current)), 2000)
  }

  return (
    <SettingsScreen title="Tracking Links">
      <Panel title="Make a link">
        <div className="space-y-4">
          <SelectField label="Source" value={source} onChange={setSource} options={LINK_SOURCES} />
          <TextField
            label="Campaign"
            value={campaign}
            onChange={setCampaign}
            placeholder="spring-flyer"
          />
          <TextField label="Destination" value={destination} onChange={setDestination} />

          <div className="rounded-xl border border-line bg-raised px-4 py-3">
            <div className="font-label text-[12px] font-semibold uppercase tracking-[0.14em] text-cc-muted">
              Preview
            </div>
            <div className="mt-1 break-all text-[14px] text-ice">{preview}</div>
          </div>

          <PrimaryButton
            onClick={() => void generate()}
            disabled={saving}
            icon={<Link2 className="h-4 w-4" strokeWidth={2.2} />}
          >
            {saving ? 'Generating' : 'Generate Link'}
          </PrimaryButton>
        </div>
      </Panel>

      <Panel padded={false} title={`${links.length} links`}>
        <div className="divide-y divide-line border-t border-line">
          {links.map((link) => (
            <div key={link.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{link.source}</span>
                {link.campaign && (
                  <StatusPill tone="neutral" size="sm">
                    {link.campaign}
                  </StatusPill>
                )}
              </div>
              <div className="mt-1 break-all text-[13px] text-cc-muted">{linkUrl(link)}</div>

              <div className="mt-3 flex flex-wrap items-center gap-5">
                <Metric label="Visits" value={link.visits} />
                <Metric label="Leads" value={link.leads} />
                <Metric label="Customers" value={link.customers} />
                <SecondaryButton
                  size="sm"
                  className="ml-auto"
                  onClick={() => copy(link)}
                  icon={
                    copiedId === link.id ? (
                      <Check className="h-4 w-4" strokeWidth={2.6} />
                    ) : (
                      <Copy className="h-4 w-4" strokeWidth={2.2} />
                    )
                  }
                >
                  {copiedId === link.id ? 'Copied' : 'Copy Link'}
                </SecondaryButton>
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-cc-muted">
          A lead created from one of these links carries its source and campaign. That is
          the whole point, this is not an attribution platform.
        </p>
      </Panel>
    </SettingsScreen>
  )
}

/* ----------------------------------------------------------- users and access */

export function SettingsUsers() {
  const { sourceData } = useAppState()
  const { user: currentUser, signOut } = useAuth()
  const demo = useDemoMode()
  const users = sourceData?.userRoles ?? []

  return (
    <SettingsScreen title="Users & Access">
      <Panel padded={false} title="Who can get in">
        <div className="divide-y divide-line border-t border-line">
          {users.map((user) => {
            const isCurrent = demo.enabled ? user.user_id === QA_FIXTURE_USER_ID : user.user_id === currentUser?.id
            const name = demo.enabled && isCurrent ? 'Salvador' : isCurrent ? currentUser?.email?.split('@')[0] || 'Current user' : `${user.role} account`
            return <div key={user.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-raised font-label text-[15px] font-semibold text-ice">
                {name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-ink">{name}</div>
                <div className="mt-0.5 font-label text-[12px] uppercase tracking-[0.1em] text-cc-muted">
                  {user.role}
                </div>
              </div>
              <StatusPill tone="neutral" size="sm">
                Full
              </StatusPill>
            </div>
          })}
        </div>
        <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-cc-muted">
          Access is read from the existing user roles table. Public signup is off, and
          workers never get an account.
        </p>
      </Panel>
      <div className={demo.enabled ? 'hidden' : 'lg:hidden'}>
        <SecondaryButton onClick={() => void signOut()}>Sign out</SecondaryButton>
      </div>
    </SettingsScreen>
  )
}

/* ------------------------------------------------------- printing and system */

export function SettingsPrinting() {
  const { sync, queued, lastSyncAt, tickets, sourceData } = useAppState()
  const { refresh } = useControlCenter()
  const demo = useDemoMode()
  const [method, setMethod] = useState<'SHARE_SHEET' | 'DIRECT'>('SHARE_SHEET')
  const [copies, setCopies] = useState(1)
  const [testPrint, setTestPrint] = useState<'IDLE' | 'SENT' | 'BUSY'>('IDLE')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const settings = sourceData?.appSettings
    if (!settings) return
    setMethod(settings.print_method === 'direct' ? 'DIRECT' : 'SHARE_SHEET')
    setCopies(settings.print_copies)
  }, [sourceData?.appSettings])

  const save = async () => {
    if (!sourceData?.appSettings) return
    setSaving(true)
    try {
      if (demo.enabled) {
        const now = new Date().toISOString()
        demo.updateData((current) => ({ ...current, appSettings: current.appSettings ? { ...current.appSettings, print_method: method === 'DIRECT' ? 'direct' : 'share', print_copies: copies, updated_at: now } : null }))
        toast.success('Printing settings saved in demo memory.')
        return
      }
      const { error } = await supabase.from('app_settings').update({
        print_method: method === 'DIRECT' ? 'direct' : 'share',
        print_copies: copies,
      }).eq('id', sourceData.appSettings.id)
      if (error) throw new Error(error.message)
      await refresh()
      toast.success('Printing settings saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Printing settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const runTestPrint = async () => {
    setTestPrint('BUSY')
    try {
      const business = sourceData?.appSettings
      const blob = await renderTicketPng({
        companyName: business?.company_name ?? 'Monkey Trucking LLC',
        companyTagline: 'Print alignment test',
        companyAddress: business?.company_address ?? '',
        companyCityStateZip: business?.company_city_state_zip ?? '',
        companyPhone: business?.company_phone ?? '',
        ticketNumber: 'TEST',
        createdAt: new Date(),
        customerName: 'Sample Customer',
        customerPhone: '(000) 000-0000',
        jobSiteAddress: '4 x 6 alignment test',
        items: [{ name: 'Sample Material', detail: '1 load / 12 yd', amount: '$100.00' }],
        subtotal: '$100.00', deliveryLabel: 'Delivery', deliveryAmount: '$0.00',
        taxLabel: 'Tax', taxAmount: '$0.00', total: '$100.00',
        driver: 'Sample Driver', copies,
      })
      const result = await outputTicketPng(blob, method === 'DIRECT' ? 'direct' : 'share', 'monkey-trucking-test-label.png', 'Monkey Trucking test label')
      setTestPrint(result === 'cancelled' ? 'IDLE' : 'SENT')
    } catch (error) {
      setTestPrint('IDLE')
      toast.error(error instanceof Error ? error.message : 'Test print could not be created.')
    }
  }

  return (
    <SettingsScreen title="Printing & System">
      <Panel title="Printing">
        <div className="space-y-5">
          <div>
            <div className="mb-2 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
              Print method
            </div>
            <SegmentControl
              fullWidth
              options={[
                { value: 'SHARE_SHEET' as const, label: 'Share sheet' },
                { value: 'DIRECT' as const, label: 'Direct print' },
              ]}
              value={method}
              onChange={setMethod}
            />
            <p className="mt-3 text-[14px] leading-snug text-cc-muted">
              {method === 'SHARE_SHEET'
                ? 'The label goes to the iOS share menu and you pick the printer app. Two extra taps, and it works over Bluetooth.'
                : 'Opens the print dialog set to 4 x 6 with no margins. Only works if the printer supports AirPrint.'}
            </p>
          </div>

          <div>
            <div className="mb-2 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
              Copies per ticket
            </div>
            <Stepper value={copies} onChange={setCopies} min={1} max={5} />
          </div>

          <div>
            <SecondaryButton
              onClick={() => void runTestPrint()}
              disabled={testPrint === 'BUSY'}
              icon={<Printer className="h-4 w-4" strokeWidth={2.2} />}
            >
              {testPrint === 'BUSY' ? 'Preparing' : 'Test Print'}
            </SecondaryButton>
            {testPrint === 'SENT' && (
              <p className="mt-3 text-[14px] leading-snug text-ok">
                Sample label sent. Check the alignment and how dark it came out before you
                print a real ticket.
              </p>
            )}
          </div>

          <PrimaryButton onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving' : 'Save Changes'}
          </PrimaryButton>
        </div>
      </Panel>

      <Panel padded={false} title="Printer">
        <div className="divide-y divide-line border-t border-line">
          <StatusRow
            label="On hand"
            value="80mm only"
            tone="warn"
            line={PRINTING.printerName}
          />
          <StatusRow
            label="Label format"
            value="Setup required"
            tone="warn"
            line={`${PRINTING.labelSize}. The printer on hand cannot do 4 x 6, so the final printer path is still open.`}
          />
        </div>
      </Panel>

      <Panel padded={false} title="System">
        <div className="divide-y divide-line border-t border-line">
          <StatusRow label="Database" value="Connected" tone="ok" line="Supabase." />
          <StatusRow label="SMS" value="Setup required" tone="warn" line="No business number yet." />
          <StatusRow
            label="Offline queue"
            value={queued === 0 ? 'Empty' : `${queued} waiting`}
            tone={queued === 0 ? 'ok' : 'warn'}
            line="Tickets saved with no signal wait here and take their number at sync."
          />
          <StatusRow
            label="Last sync"
            value={sync === 'synced' ? `${shortAgo(lastSyncAt)} ago` : 'Syncing'}
            tone={sync === 'synced' ? 'ok' : 'ice'}
            line={`${tickets.length} tickets on this device.`}
          />
        </div>
      </Panel>
    </SettingsScreen>
  )
}

/* ----------------------------------------------------------------- helpers */

function setupLabel(status?: string) {
  if (status === 'READY') return 'Ready'
  if (status === 'OFF') return 'Off'
  return 'Setup required'
}

function setupTone(status?: string): PillTone {
  if (status === 'READY') return 'ok'
  if (status === 'OFF') return 'idle'
  return 'warn'
}

function jsonTextList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function Toggle({
  label,
  line,
  value,
  onChange,
}: {
  label: string
  line?: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex min-h-[44px] w-full items-start justify-between gap-4 py-1 text-left"
    >
      <span className="min-w-0">
        <span className="block font-label text-[14px] font-semibold uppercase tracking-[0.08em] text-ink">
          {label}
        </span>
        {line && <span className="mt-0.5 block text-[14px] leading-snug text-cc-muted">{line}</span>}
      </span>
      <span
        className={cn(
          'relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors',
          value ? 'bg-ice' : 'bg-raised border border-line',
        )}
      >
        <span
          className={cn(
            'absolute top-1 h-5 w-5 rounded-full transition-all',
            value ? 'left-6 bg-canvas' : 'left-1 bg-cc-muted',
          )}
        />
      </span>
    </button>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-label text-[12px] font-semibold uppercase tracking-[0.14em] text-cc-muted">
        {label}
      </div>
      <div className="mt-1 text-[15px] leading-snug text-ink/85">{value}</div>
    </div>
  )
}

function DetailList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="font-label text-[12px] font-semibold uppercase tracking-[0.14em] text-cc-muted">
        {label}
      </div>
      <ul className="mt-1.5 space-y-1.5">
        {values.map((value) => (
          <li key={value} className="flex gap-2.5">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ice" />
            <span className="text-[15px] leading-snug text-ink/85">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="block font-display display-tight tnum text-[22px]">{value}</span>
      <span className="block font-label text-[11px] uppercase tracking-[0.1em] text-idle">
        {label}
      </span>
    </span>
  )
}
