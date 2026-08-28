const ATTRIBUTION_KEY = 'mt_tracking_attribution_v1'
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type TrackingAttribution = {
  trackingLinkId: string
  source: string
  campaign: string
  capturedAt: string
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
  const params = new URLSearchParams(search)
  const trackingLinkId = clean(params.get('mt_tracking'))
  const source = clean(params.get('mt_source'))
  const campaign = clean(params.get('mt_campaign'))
  if (!trackingLinkId || !source || !campaign) return null

  const attribution = { trackingLinkId, source, campaign, capturedAt: new Date().toISOString() }
  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
  } catch {
    // Attribution improves reporting but must never prevent public navigation.
  }
  return attribution
}

export function getTrackingAttribution(now = Date.now()): TrackingAttribution | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<TrackingAttribution>
    const capturedAt = Date.parse(value.capturedAt ?? '')
    if (!value.trackingLinkId || !value.source || !value.campaign || !Number.isFinite(capturedAt)) return null
    if (now - capturedAt > ATTRIBUTION_TTL_MS) {
      window.localStorage.removeItem(ATTRIBUTION_KEY)
      return null
    }
    return value as TrackingAttribution
  } catch {
    return null
  }
}
