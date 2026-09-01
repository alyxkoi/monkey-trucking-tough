export const TRACKING_SESSION_COOKIE = 'mt_tracking_session'
export const TRACKING_SESSION_MAX_AGE_SECONDS = 30 * 60

const encoder = new TextEncoder()

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    const binary = atob(padded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=') || null
  }
  return null
}

export async function signTrackingSession(
  sessionId: string,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + TRACKING_SESSION_MAX_AGE_SECONDS
  const payload = `${sessionId}.${expiresAt}`
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(payload))
  return `${payload}.${base64Url(new Uint8Array(signature))}`
}

export async function verifyTrackingSession(
  token: string | null,
  secret: string,
  now = Date.now(),
): Promise<string | null> {
  if (!token) return null
  const [sessionId, rawExpiry, rawSignature, ...extra] = token.split('.')
  if (extra.length > 0 || !sessionId || !rawExpiry || !rawSignature) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return null

  const expiresAt = Number(rawExpiry)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return null
  const signature = fromBase64Url(rawSignature)
  if (!signature) return null

  const valid = await crypto.subtle.verify(
    'HMAC',
    await signingKey(secret),
    signature,
    encoder.encode(`${sessionId}.${rawExpiry}`),
  )
  return valid ? sessionId : null
}

export async function trackingSession(
  cookieHeader: string | null,
  secret: string,
  now = Date.now(),
): Promise<{ id: string; cookie: string }> {
  const currentToken = readCookie(cookieHeader, TRACKING_SESSION_COOKIE)
  const id = await verifyTrackingSession(currentToken, secret, now) ?? crypto.randomUUID()
  const token = await signTrackingSession(id, secret, now)
  return {
    id,
    cookie: `${TRACKING_SESSION_COOKIE}=${token}; Max-Age=${TRACKING_SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  }
}
