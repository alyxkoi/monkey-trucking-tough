type Message = { id?: string; sender_type: string; body?: string; message_kind?: string; created_at?: string }

/** The durable queue coalesces for 3 seconds. Keep individual messages as tool
 * evidence; combine only the current unanswered burst for conversational intent. */
export function customerBurstMessages<T extends Message>(messages: T[]): T[] {
  const last = messages.findLastIndex(m => m.sender_type === 'CUSTOMER')
  if (last < 0) return []
  const newest = messages[last]
  if (newest.message_kind === 'COMPLIANCE') return [newest]
  const burst = [newest]
  for (let i = last - 1; i >= 0; i--) {
    const prior = messages[i]
    if (prior.sender_type !== 'CUSTOMER' || prior.message_kind === 'COMPLIANCE') break
    const gap = Date.parse(newest.created_at ?? '') - Date.parse(prior.created_at ?? '')
    if (!Number.isFinite(gap) || gap < 0 || gap > 10_000 || burst.length >= 6) break
    burst.unshift(prior)
  }
  return burst
}

export function latestCustomerTurn<T extends Message>(messages: T[]): T | undefined {
  const burst=customerBurstMessages(messages)
  const newest=burst.at(-1)
  return newest?{ ...newest, body: burst.map(m => m.body ?? '').join('\n') }:undefined
}
