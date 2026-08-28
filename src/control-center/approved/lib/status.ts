import type { PillTone } from '@/control-center/approved/components/ui/StatusPill'
import type { LeadStatus, QuoteStatus } from '@/control-center/approved/state/salesData'

/**
 * Status colors follow the locked utility meanings.
 * Acid green is new/fresh, amber is waiting on someone, green is settled,
 * gray is closed. Red never carries a passive status.
 */
export const LEAD_TONE: Record<LeadStatus, PillTone> = {
  NEW: 'ice',
  TALKING: 'neutral',
  QUOTED: 'warn',
  WON: 'ok',
  LOST: 'idle',
}

export const LEAD_LABEL: Record<LeadStatus, string> = {
  NEW: 'New',
  TALKING: 'Talking',
  QUOTED: 'Quoted',
  WON: 'Won',
  LOST: 'Lost',
}

export const QUOTE_TONE: Record<QuoteStatus, PillTone> = {
  DRAFT: 'neutral',
  SENT: 'warn',
  ACCEPTED: 'ok',
  DECLINED: 'idle',
}

export const QUOTE_LABEL: Record<QuoteStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function smsHref(phone: string): string {
  return `sms:${phone.replace(/[^\d+]/g, '')}`
}
