// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  readCookie,
  signTrackingSession,
  trackingSession,
  verifyTrackingSession,
  TRACKING_SESSION_COOKIE,
  TRACKING_SESSION_MAX_AGE_SECONDS,
} from '../../supabase/functions/_shared/tracking-session'

const secret = 'test-only-tracking-session-secret'
const sessionId = '11111111-1111-4111-8111-111111111111'
const now = Date.UTC(2026, 8, 1, 12)

describe('tracking redirect sessions', () => {
  it('accepts a signed session inside the rolling 30-minute window', async () => {
    const token = await signTrackingSession(sessionId, secret, now)
    expect(await verifyTrackingSession(token, secret, now + (TRACKING_SESSION_MAX_AGE_SECONDS - 1) * 1000)).toBe(sessionId)
  })

  it('rejects expired or tampered sessions', async () => {
    const token = await signTrackingSession(sessionId, secret, now)
    expect(await verifyTrackingSession(token, secret, now + TRACKING_SESSION_MAX_AGE_SECONDS * 1000)).toBeNull()
    expect(await verifyTrackingSession(token, secret, now + (TRACKING_SESSION_MAX_AGE_SECONDS + 1) * 1000)).toBeNull()
    expect(await verifyTrackingSession(`${token}tampered`, secret, now)).toBeNull()
    expect(await verifyTrackingSession(token, `${secret}-wrong`, now)).toBeNull()
  })

  it('reuses the session id while renewing the signed cookie', async () => {
    const token = await signTrackingSession(sessionId, secret, now)
    const result = await trackingSession(`${TRACKING_SESSION_COOKIE}=${token}`, secret, now + 60_000)
    expect(result.id).toBe(sessionId)
    expect(result.cookie).toContain(`Max-Age=${TRACKING_SESSION_MAX_AGE_SECONDS}`)
    expect(result.cookie).toContain('HttpOnly; Secure; SameSite=Lax')
  })

  it('parses the named cookie without depending on cookie order', () => {
    expect(readCookie(`theme=dark; ${TRACKING_SESSION_COOKIE}=signed-value; other=1`, TRACKING_SESSION_COOKIE)).toBe('signed-value')
  })
})
