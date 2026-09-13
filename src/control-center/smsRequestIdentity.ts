// Store only a content hash and operation ID, never a message body or phone.
// Retries survive a dashboard reload without asking the provider to send twice.
export async function smsRequestIdentity(leadId: string, body: string, fallback: Map<string, string>) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${leadId}:${body}`))
  const key = `mt-sms:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
  let id = fallback.get(key)
  try { id ??= sessionStorage.getItem(key) ?? undefined } catch { /* storage may be disabled */ }
  id ??= crypto.randomUUID()
  fallback.set(key, id)
  try { sessionStorage.setItem(key, id) } catch { /* in-memory retry remains safe */ }
  return { id, key }
}

export function clearSmsRequestIdentity(key: string, fallback: Map<string, string>) {
  fallback.delete(key)
  try { sessionStorage.removeItem(key) } catch { /* storage may be disabled */ }
}
