const ATTRIBUTION_KEY = 'mt_tracking_visit_v2'
const ATTRIBUTION_TTL_MS = 30 * 60 * 1000
let visitInitialized = false

export type TrackingAttribution = {
  trackingLinkId: string
  source: string
  campaign: string
  capturedAt: string
  version: 2
}

const clean = (value: string | null | undefined) => value?.trim() ?? ''

export function trackingRedirectUrl(slug: string): string {
  const safeSlug = encodeURIComponent(slug.trim())
  const configuredBase = clean(import.meta.env.VITE_TRACKING_REDIRECT_BASE_URL)
  if (configuredBase) return `${configuredBase.replace(/\/$/, '')}/${safeSlug}`

  const supabaseUrl = clean(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')
  return `${supabaseUrl}/functions/v1/tracking-redirect?slug=${safeSlug}`
}

export function captureTrackingAttribution(search = window.location.search): TrackingAttribution | null {
  if (!visitInitialized) {
    visitInitialized = true
    const navigation = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
    initializeTrackingVisit(document.referrer, navigation?.type)
  }
  const params = new URLSearchParams(search)
  const trackingLinkId = clean(params.get('mt_tracking'))
  const source = clean(params.get('mt_source'))
  const campaign = clean(params.get('mt_campaign'))
  if (!trackingLinkId || !source || !campaign) return null

  const existing = getTrackingAttribution()
  if (existing?.trackingLinkId === trackingLinkId) return existing
  const attribution: TrackingAttribution = { trackingLinkId, source, campaign, capturedAt: new Date().toISOString(), version: 2 }
  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
  } catch {
    // Attribution improves reporting but must never prevent public navigation.
  }
  return attribution
}

/** Preserve same-site navigation/reload, never a previous unrelated arrival. */
export function initializeTrackingVisit(referrer: string, navigationType?: string) {
  try {
    window.localStorage.removeItem('mt_tracking_attribution_v1')
    const sameSite = referrer && new URL(referrer).origin === window.location.origin
    if (!sameSite && !['reload', 'back_forward'].includes(navigationType ?? '')) {
      window.sessionStorage.removeItem(ATTRIBUTION_KEY)
    }
  } catch { /* Tracking must not block navigation. */ }
}

export function getTrackingAttribution(now = Date.now()): TrackingAttribution | null {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<TrackingAttribution>
    const capturedAt = Date.parse(value.capturedAt ?? '')
    if (value.version !== 2 || !value.trackingLinkId || !value.source || !value.campaign || !Number.isFinite(capturedAt)) return null
    if (now < capturedAt || now - capturedAt > ATTRIBUTION_TTL_MS) {
      window.sessionStorage.removeItem(ATTRIBUTION_KEY)
      return null
    }
    return value as TrackingAttribution
  } catch {
    return null
  }
}
