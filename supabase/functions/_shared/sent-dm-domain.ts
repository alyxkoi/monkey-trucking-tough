export const SENT_DM_PROVIDER = 'SENT_DM' as const

export type SentDmStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'ROUTED'
  | 'SCHEDULED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'FILTERED'
  | 'BLOCKED'
  | 'RECEIVED'

export type ComplianceKeyword = 'STOP' | 'START' | 'HELP' | null

const STOP = new Set(['STOP', 'CANCEL', 'UNSUBSCRIBE', 'QUIT', 'END'])
const START = new Set(['START', 'UNSTOP', 'SUBSCRIBE'])
const HELP = new Set(['HELP', 'INFO'])

export function complianceKeyword(body: unknown): ComplianceKeyword {
  if (typeof body !== 'string') return null
  const keyword = body.trim().toUpperCase()
  if (STOP.has(keyword)) return 'STOP'
  if (START.has(keyword)) return 'START'
  if (HELP.has(keyword)) return 'HELP'
  return null
}

export function normalizeUsE164(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function normalizeSentDmStatus(value: unknown): SentDmStatus | null {
  if (typeof value !== 'string') return null
  const status = value.trim().toUpperCase()
  return [
    'PENDING', 'QUEUED', 'ROUTED', 'SCHEDULED', 'SENT', 'DELIVERED',
    'READ', 'FAILED', 'FILTERED', 'BLOCKED', 'RECEIVED',
  ].includes(status) ? status as SentDmStatus : null
}

export function sentDmEventKey(messageId: string, status: SentDmStatus): string {
  return `${messageId}:${status}`
}

export function sentDmIdempotencyKey(messageId: string): string {
  return `sms_${messageId.replaceAll('-', '_')}`
}

export function isTerminalFailure(status: SentDmStatus): boolean {
  return status === 'FAILED' || status === 'FILTERED' || status === 'BLOCKED'
}
