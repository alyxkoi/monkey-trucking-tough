/**
 * Settings.
 *
 * A directory of dedicated screens, never one endless page. Materials and
 * delivery deliberately have no separate store here: they read the same pricing
 * source the Ticket builder and the Quote builder read.
 */

export type SetupState = 'READY' | 'SETUP_REQUIRED' | 'OFF'

export type BusinessSettings = {
  companyName: string
  phone: string
  email: string
  address: string
  taxRate: number
  taxOnDelivery: boolean
  defaultDueDays: number
  paymentMethods: string[]
  logoState: SetupState
}

export const BUSINESS: BusinessSettings = {
  companyName: 'Monkey Trucking LLC',
  // The handoff does not record a business phone or address, so these are blank
  // rather than invented. They print on the ticket, so they are prelaunch items.
  phone: '',
  email: '',
  address: 'Kaufman, Texas',
  taxRate: 0,
  taxOnDelivery: true,
  defaultDueDays: 3,
  paymentMethods: ['ACH', 'Card', 'Zelle', 'Apple Pay', 'Check', 'Other'],
  logoState: 'SETUP_REQUIRED',
}

export type CommunicationSettings = {
  businessNumber: string
  smsState: SetupState
  callingState: SetupState
  aiState: SetupState
  english: boolean
  spanish: boolean
  humanTakeover: boolean
}

export const COMMUNICATION: CommunicationSettings = {
  businessNumber: '',
  smsState: 'SETUP_REQUIRED',
  callingState: 'SETUP_REQUIRED',
  aiState: 'SETUP_REQUIRED',
  english: true,
  spanish: true,
  humanTakeover: true,
}

export type PrintingSettings = {
  method: 'SHARE_SHEET' | 'DIRECT'
  printerName: string
  copies: number
  labelSize: string
}

export const PRINTING: PrintingSettings = {
  method: 'SHARE_SHEET',
  printerName: 'MUNBYN ITPP047P, pairs as TM-m30III',
  copies: 1,
  labelSize: '4 x 6 inch thermal label, 812 x 1218 at 203 dpi',
}

export type TrackingLink = {
  id: string
  source: string
  campaign: string
  destination: string
  url: string
  createdAt: number
  visits: number
  leads: number
  customers: number
}

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

export const TRACKING_LINKS: TrackingLink[] = [
  {
    id: 'tl-1',
    source: 'Facebook',
    campaign: 'marketplace-driveway',
    destination: 'monkeytrucking.llc',
    url: 'monkeytrucking.llc/?source=facebook-marketplace&campaign=marketplace-driveway',
    createdAt: now - 34 * DAY,
    visits: 412,
    leads: 9,
    customers: 3,
  },
  {
    id: 'tl-2',
    source: 'QR code',
    campaign: 'flyer-qr-spring',
    destination: 'monkeytrucking.llc',
    url: 'monkeytrucking.llc/?source=flyer&campaign=flyer-qr-spring',
    createdAt: now - 62 * DAY,
    visits: 88,
    leads: 4,
    customers: 1,
  },
  {
    id: 'tl-3',
    source: 'Website',
    campaign: 'ranch-sign',
    destination: 'monkeytrucking.llc',
    url: 'monkeytrucking.llc/?source=billboard&campaign=ranch-sign',
    createdAt: now - 120 * DAY,
    visits: 143,
    leads: 6,
    customers: 2,
  },
]

/**
 * Where a tracking link is placed. Kept in step with the manual lead source list
 * so a link and a hand entered lead never describe the same thing two ways. The
 * specific placement, a spring flyer or a particular sign, belongs to Campaign.
 */
export const LINK_SOURCES: ('Facebook' | 'Website' | 'QR code' | 'Other')[] = ['Facebook', 'Website', 'QR code', 'Other']

export type SystemUser = {
  id: string
  name: string
  role: 'Owner' | 'Alyxlab admin'
  email: string
  access: 'Full'
}

/** One shared login today. Individual accounts can be added without a rebuild. */
export const USERS: SystemUser[] = [
  { id: 'usr-1', name: 'Salvador Alvarez', role: 'Owner', email: '', access: 'Full' },
  { id: 'usr-2', name: 'Alyxlab', role: 'Alyxlab admin', email: '', access: 'Full' },
]
