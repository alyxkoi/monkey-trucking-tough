import { HttpError as ResponseError } from './staff-auth.ts'
function base64Bytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

function signatureCandidates(signatureHeader: string): Uint8Array[] {
  return signatureHeader.split(' ').flatMap((part) => part.split(','))
    .map((part) => part.trim()).filter((part) => part && part !== 'v1')
    .map(base64Bytes).filter((candidate): candidate is Uint8Array => Boolean(candidate))
}

async function hmacMatches(keyBytes: Uint8Array, payload: string, candidates: Uint8Array[]): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
  return candidates.some((candidate) => equalBytes(expected, candidate))
}

export async function verifySignature(req: Request, rawBody: string, secret: string): Promise<boolean> {
  const webhookId = req.headers.get('X-Webhook-ID')
  const timestamp = req.headers.get('X-Webhook-Timestamp')
  const signatureHeader = req.headers.get('X-Webhook-Signature')
  if (!webhookId || !timestamp || !signatureHeader) throw new ResponseError(400, 'Missing webhook signature headers')
  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false

  const keyBytes = base64Bytes(secret.replace(/^whsec_/, ''))
  if (!keyBytes) return false
  return hmacMatches(keyBytes, `${webhookId}.${timestamp}.${rawBody}`, signatureCandidates(signatureHeader))
}
