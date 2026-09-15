import { normalizeUsE164 } from './sent-dm-domain.ts'

export type ReconciledInboundSms = {
  messageId: string
  phone: string
  body: string
  occurredAt: string
}

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Normalize the read-only sent.DM conversation feed into the same inbound contract as webhooks. */
export function sentDmInboundMessages(payload: unknown): ReconciledInboundSms[] {
  const root = record(payload)
  const data = record(root?.data)
  const messages = Array.isArray(data?.messages)
    ? data.messages
    : Array.isArray(root?.messages) ? root.messages : []

  const normalized: ReconciledInboundSms[] = []
  for (const item of messages) {
    const message = record(item)
    if (!message) continue
    if (text(message.direction)?.toUpperCase() !== 'INBOUND') continue
    if (text(message.channel)?.toLowerCase() !== 'sms') continue
    if (text(message.status)?.toUpperCase() !== 'RECEIVED') continue

    const messageId = text(message.id)
    const phone = normalizeUsE164(message.phone_international ?? message.phone)
    const occurredAt = text(message.created_at)
    if (!messageId || !phone || !occurredAt || !Number.isFinite(Date.parse(occurredAt))) continue

    const messageBody = record(message.message_body)
    const content = text(messageBody?.content) ?? '[Non-text SMS received]'
    normalized.push({ messageId, phone, body: content.slice(0, 1600), occurredAt })
  }

  return normalized.sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
}
