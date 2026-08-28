import type { ControlData } from '@/control-center/data'
import { APPROVED_MATERIALS } from '@/control-center/approved/state/pricing'
import type { PillTone } from '@/control-center/approved/components/ui/StatusPill'

export type ReadinessStatus = 'READY' | 'NEEDS_INFO' | 'WAITING' | 'TEST_REQUIRED' | 'ERROR'
export type ReadinessKey = 'business' | 'materials' | 'workers' | 'communication' | 'tracking' | 'users' | 'printing'

export type ReadinessItem = {
  status: ReadinessStatus
  label: string
  reason: string
  actions: string[]
}

export type SettingsReadiness = {
  categories: Record<ReadinessKey, ReadinessItem>
  capabilities: {
    ai: ReadinessItem
    email: ReadinessItem
    sms: ReadinessItem
    calling: ReadinessItem
    automations: ReadinessItem
    payments: ReadinessItem
  }
  blockers: Array<{ key: string; label: string; detail: string; to: string }>
}

const ready = (reason: string): ReadinessItem => ({ status: 'READY', label: 'Ready', reason, actions: [] })
const item = (status: ReadinessStatus, label: string, reason: string, actions: string[]): ReadinessItem => ({ status, label, reason, actions })
const sameNumber = (left: unknown, right: number) => Math.abs(Number(left) - right) < 0.001

export function readinessTone(status: ReadinessStatus): PillTone {
  if (status === 'READY') return 'ok'
  if (status === 'WAITING') return 'ice'
  if (status === 'ERROR') return 'now'
  return 'warn'
}

export function deriveSettingsReadiness(data: ControlData | null): SettingsReadiness {
  if (!data) {
    const unavailable = item('ERROR', 'Error', 'Managed configuration could not be loaded.', ['Restore the database connection and authorization.'])
    return {
      categories: { business: unavailable, materials: unavailable, workers: unavailable, communication: unavailable, tracking: unavailable, users: unavailable, printing: unavailable },
      capabilities: { ai: unavailable, email: unavailable, sms: unavailable, calling: unavailable, automations: unavailable, payments: unavailable },
      blockers: [{ key: 'database', label: 'Database connection', detail: unavailable.actions[0], to: '/admin/settings/printing' }],
    }
  }

  const app = data.appSettings
  const control = data.controlSettings

  const businessMissing: string[] = []
  if (!app?.company_name?.trim()) businessMissing.push('company name')
  if (!app?.company_phone?.trim()) businessMissing.push('public business phone')
  if (!control?.company_email?.trim()) businessMissing.push('business email')
  if (!app?.company_address?.trim()) businessMissing.push('street or service address')
  if (!app?.company_city_state_zip?.trim()) businessMissing.push('city, state and ZIP')
  if (control?.custom_work_tax_rule === 'PENDING') businessMissing.push('custom work tax treatment')
  const business = !app || !control
    ? item('ERROR', 'Error', 'Business settings tables are unavailable.', ['Apply and verify the Control Center settings migration.'])
    : !sameNumber(app.tax_rate, 0)
      ? item('ERROR', 'Error', 'Current tax does not match the approved 0% setting.', ['Set the current app tax rate to 0 without rewriting historical snapshots.'])
      : businessMissing.length > 0
        ? item('NEEDS_INFO', 'Needs info', `Missing ${businessMissing.join(', ')}.`, businessMissing)
        : ready(`Company information is complete. Tax is 0% and invoices default to ${control.default_invoice_due_days} days.`)

  const activeMaterials = data.materials.filter((material) => material.is_active)
  const catalogMatches = activeMaterials.length === APPROVED_MATERIALS.length && APPROVED_MATERIALS.every((approved) => {
    const current = activeMaterials.find((material) => material.name.trim().toLowerCase() === approved.name.toLowerCase())
    return Boolean(current)
      && sameNumber(current?.price_per_yard, approved.pricePerYard)
      && sameNumber(current?.full_load_price, approved.fullLoadPrice)
      && sameNumber(current?.full_load_yards, approved.fullLoadYards)
  })
  const deliveryMatches = Boolean(app)
    && sameNumber(app?.delivery_tier_1_max_miles, 2)
    && sameNumber(app?.delivery_tier_1_fee, 0)
    && sameNumber(app?.delivery_tier_2_max_miles, 5)
    && sameNumber(app?.delivery_tier_2_fee, 60)
    && sameNumber(app?.delivery_tier_3_max_miles, 10)
    && sameNumber(app?.delivery_tier_3_fee, 100)
    && sameNumber(app?.delivery_overage_base_fee, 100)
    && sameNumber(app?.delivery_overage_per_mile, 10)
  const materialActions = [
    ...(!catalogMatches ? ['Reconcile the 10 approved active materials, rates and 20-yard load values.'] : []),
    ...(!deliveryMatches ? ['Reconcile the approved delivery tiers.'] : []),
    ...(!sameNumber(app?.tax_rate, 0) ? ['Set current tax to 0%.'] : []),
  ]
  const materials = materialActions.length === 0
    ? ready('The approved catalog, load size, delivery tiers and current tax are loaded.')
    : item('ERROR', 'Error', materialActions.join(' '), materialActions)

  const workerActions: string[] = []
  if (data.drivers.filter((driver) => driver.is_active).length === 0) workerActions.push('Add the real active driver roster.')
  if (data.workers.filter((worker) => worker.is_active).length === 0) workerActions.push('Add the real crew and pay information.')
  if (data.workers.some((worker) => worker.is_active && worker.pay_type === 'HOURLY' && (!worker.hourly_rate || Number(worker.hourly_rate) <= 0))) {
    workerActions.push('Add hourly rates for every active hourly worker.')
  }
  const workers = workerActions.length === 0
    ? ready('Driver and worker records have active roster and pay information.')
    : item('NEEDS_INFO', 'Needs info', workerActions.join(' '), workerActions)

  const ai = data.aiIntegration.status === 'ERROR'
    ? item('ERROR', 'Error', data.aiIntegration.message ?? 'AI schema or service is failing.', ['Review the AI function and audit error.'])
    : data.aiIntegration.status === 'SETUP_REQUIRED'
      ? item('WAITING', 'Deployment required', data.aiIntegration.message ?? 'AI schema is not deployed.', ['Apply the AI draft migration and deploy ai-draft.'])
      : control?.ai_status === 'READY'
        ? ready('Structured server-side drafts and audit data are verified.')
        : item('TEST_REQUIRED', 'Test required', 'AI schema is available, but live server-side draft generation has not been marked verified.', ['Run authenticated English, Spanish and Spanglish draft tests.'])

  const email = control?.email_status === undefined
    ? item('WAITING', 'Deployment required', 'Email readiness state is not installed in the managed schema.', ['Apply the production-readiness migration.'])
    : control.email_status === 'READY'
      ? ready('Quote, Invoice and Payment Received transactional email is verified.')
      : control.email_status === 'OFF'
        ? item('WAITING', 'Off', 'Transactional customer email is intentionally off.', ['Enable and verify Resend before launch.'])
        : item('TEST_REQUIRED', 'Test required', 'Email source is prepared but provider-accepted delivery has not been marked verified.', ['Verify Resend credentials and send all three templates.'])

  const hasNumber = Boolean(control?.business_number?.trim())
  const sms = !hasNumber
    ? item('WAITING', 'Waiting on number', 'The business SMS number has not been assigned.', ['Add the approved business number and provider credentials.'])
    : control?.sms_status === 'READY'
      ? ready('Business SMS transport is verified.')
      : item('TEST_REQUIRED', 'Test required', 'A number exists, but SMS transport is not verified.', ['Verify inbound, outbound, delivery receipt, STOP and HELP behavior.'])
  const calling = !hasNumber
    ? item('WAITING', 'Waiting on number', 'The business calling number has not been assigned.', ['Add the approved business number and calling credentials.'])
    : control?.calling_status === 'READY'
      ? ready('Business calling transport is verified.')
      : item('TEST_REQUIRED', 'Test required', 'A number exists, but calling and missed-call events are not verified.', ['Verify calling and missed-call webhooks.'])

  const requiredRules = ['new-lead', 'missed-call', 'quote-follow-up', 'job-reminder', 'invoice-follow-up', 'review-request', 'reactivation']
  const rulesPresent = requiredRules.every((id) => data.automations.some((rule) => rule.id === id))
  const automations = !rulesPresent
    ? item('ERROR', 'Error', 'One or more approved automation rules is missing.', ['Restore all seven approved automation definitions.'])
    : data.aiIntegration.status === 'READY'
      ? item('READY', 'Dry run ready', 'Eligibility, stop conditions and previews are available. Customer sending remains off.', [])
      : item('WAITING', 'Waiting on AI', 'Deterministic eligibility exists, but contextual draft generation needs the AI schema.', ['Deploy and verify AI drafts.'])

  const payments = data.stripeIntegration.status === 'ERROR'
    ? item('ERROR', 'Error', data.stripeIntegration.message ?? 'Stripe reconciliation data is failing.', ['Review Stripe webhook reconciliation.'])
    : data.stripeIntegration.status === 'SETUP_REQUIRED'
      ? item('WAITING', 'Deployment required', data.stripeIntegration.message ?? 'Stripe schema is not deployed.', ['Apply the Stripe migration and deploy Checkout/webhook functions.'])
      : control?.payment_processor_status === 'READY'
        ? ready('Stripe test-mode Checkout produced one verified Monkey Trucking Payment.')
        : item('TEST_REQUIRED', 'Test required', 'Stripe schema is available, but an end-to-end test payment is not verified.', ['Run one test-mode Checkout and verify exactly one Payment.'])

  const communication = [ai, email, sms, calling, automations].some((entry) => entry.status === 'ERROR')
    ? item('ERROR', 'Error', 'A communication capability is currently failing.', ['Open Communication & AI for the exact failing capability.'])
    : !hasNumber
      ? item('WAITING', 'Waiting on number', 'AI and automation preparation is separate; SMS and calling wait on the approved business number.', ['Business SMS/calling number'])
      : [ai, email, sms, calling].some((entry) => entry.status === 'TEST_REQUIRED' || entry.status === 'WAITING')
        ? item('TEST_REQUIRED', 'Test required', 'One or more connected communication capabilities still needs deployment or verification.', ['Complete the capability tests shown inside Communication & AI.'])
        : ready('AI drafts, email, SMS, calling and automation controls are verified.')

  const tracking = ready('Tracking links store simple source and campaign metadata and can be created from this screen.')
  const authorizedRoles = data.userRoles.filter((role) => role.role === 'admin' || role.role === 'staff')
  const users = authorizedRoles.length > 0
    ? ready(`${authorizedRoles.length} authorized admin/staff role${authorizedRoles.length === 1 ? '' : 's'} loaded. Workers have no login.`)
    : item('ERROR', 'Error', 'No admin or staff role is visible to the authenticated account.', ['Restore user_roles authorization before launch.'])
  const printing = app && ['share', 'direct'].includes(app.print_method) && app.print_copies > 0
    ? ready('The tested 4×6 monochrome output, print path, build ID, sync and offline queue are available.')
    : item('ERROR', 'Error', 'Printing configuration could not be loaded.', ['Restore app_settings printing values.'])

  const categories = { business, materials, workers, communication, tracking, users, printing }
  const blockers: SettingsReadiness['blockers'] = []
  for (const [key, category] of Object.entries(categories) as Array<[ReadinessKey, ReadinessItem]>) {
    if (category.status !== 'READY') {
      blockers.push({
        key,
        label: key === 'communication' ? category.label : category.reason.split('.')[0],
        detail: category.actions.join(' '),
        to: `/admin/settings/${key === 'materials' ? 'materials' : key === 'printing' ? 'printing' : key}`,
      })
    }
  }
  if (payments.status !== 'READY') {
    blockers.push({ key: 'payments', label: payments.label, detail: payments.actions.join(' '), to: '/admin/settings/business' })
  }

  return { categories, capabilities: { ai, email, sms, calling, automations, payments }, blockers }
}
