import { timingSafeEqual } from 'node:crypto'

const same = (a: string, b: string) => {
  const left = new TextEncoder().encode(a), right = new TextEncoder().encode(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

// Vault owns the random credential; the Edge Function never retrieves its value.
// Only a digest reaches the service-only verifier. Untrusted JWT claims are unused.
export async function workerAuthorized(
  service: { rpc: (name: string, args: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }> },
  token: string, serviceKey: string, edgeSecret?: string,
) {
  if (!token) return false
  if (same(token, serviceKey) || (edgeSecret && same(token, edgeSecret))) return true
  if (!/^[a-f0-9]{64}$/.test(token)) return false
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const checked = await service.rpc('verify_communications_worker', { p_token_hash: tokenHash })
    return !checked.error && checked.data === true
  } catch { return false }
}
