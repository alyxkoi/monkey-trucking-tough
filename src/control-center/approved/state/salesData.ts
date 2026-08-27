/**
 * Representative prototype data for the sales flow.
 * Local mock only. Pricing always comes from `pricing.ts`, which mirrors the
 * existing Ticket system settings. Nothing here invents a rate.
 */

import {
  buildMaterialLine,
  computeTotals,
  materialById,
  TAX_ON_CUSTOM_WORK,
  TAX_ON_DELIVERY,
  TAX_RATE,
  type CustomLine,
  type CustomWorkTaxRule,
  type DeliverySelection,
  type MaterialLine,
} from './pricing'

export type LeadStatus = 'NEW' | 'TALKING' | 'QUOTED' | 'WON' | 'LOST'
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED'
export type Actor = 'customer' | 'ai' | 'salvador' | 'system'

export type Message = {
  id: string
  actor: Actor
  at: number
  text: string
  /** Marks the moment the AI handed the conversation to a human. */
  escalation?: boolean
}

/** A Customer is the permanent identity. Job sites live on the Job or the Ticket. */
export type Customer = {
  id: string
  name: string
  phone: string
  email?: string
  source: string
  notes: string
  createdAt: number
}

export type KnownFact = { label: string; value: string }

export type Lead = {
  id: string
  customerId: string
  status: LeadStatus
  need: string
  source: string
  campaign?: string
  createdAt: number
  lastActivityAt: number
  /** Urgency is separate from status. */
  needsSalvador: boolean
  /** A human reply pauses the active AI conversation. */
  aiPaused: boolean
  notes: string
  lostReason?: string
  quoteId?: string
  messages: Message[]
  known: KnownFact[]
  missing: string[]
}

export type Quote = {
  id: string
  number: string
  leadId: string
  customerId: string
  status: QuoteStatus
  description: string
  address: string
  materialLines: MaterialLine[]
  customLines: CustomLine[]
  delivery: DeliverySelection
  /** Physical delivery loads. Separate from the per material load counts. */
  deliveryLoads: number
  /** Snapshotted at creation so later settings changes never rewrite this quote. */
  taxRate: number
  taxOnDelivery: boolean
  customWorkTax: CustomWorkTaxRule
  /** Persisted pricing snapshots win over live settings for saved quotes. */
  snapshotTotals?: ReturnType<typeof computeTotals>
  createdAt: number
  sentAt?: number
  acceptedAt?: number
  declinedAt?: number
  /** Set in Prompt 3 when the accepted quote becomes scheduled work. */
  jobId?: string
}

export type ActivityKind =
  | 'lead'
  | 'quote'
  | 'job'
  | 'ticket'
  | 'money'
  | 'note'

export type Activity = {
  id: string
  customerId: string
  kind: ActivityKind
  at: number
  title: string
  body?: string
  amount?: number
  ref?: string
  photos?: string[]
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const now = Date.now()

/* ----------------------------------------------------------------- customers */

export const CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Ortiz Ranch',
    phone: '(972) 555 0142',
    email: 'office@ortizranch.example',
    source: 'Word of mouth',
    notes: 'Gate code changes with the season. Call before the first load of the day.',
    createdAt: now - 420 * DAY,
  },
  {
    id: 'cust-2',
    name: 'Blanchard Excavating',
    phone: '(214) 555 0198',
    source: 'Facebook',
    notes: 'Trey Blanchard is the owner. Prefers a call over a text.',
    createdAt: now - 96 * DAY,
  },
  {
    id: 'cust-3',
    name: 'Marisol Reyes',
    phone: '(469) 555 0177',
    source: 'Facebook',
    notes: '',
    createdAt: now - 40 * MINUTE,
  },
  {
    id: 'cust-4',
    name: 'Kaufman Feed and Supply',
    phone: '(972) 555 0119',
    email: 'orders@kaufmanfeed.example',
    source: 'Walk in',
    notes: 'Deliveries have to clear the loading dock before 7 am or after 5 pm.',
    createdAt: now - 210 * DAY,
  },
  {
    id: 'cust-5',
    name: 'Dwayne Roth',
    phone: '(903) 555 0163',
    email: 'dwayne.roth@example.com',
    source: 'Word of mouth',
    notes: 'Repeat customer. Pays by check or zelle.',
    createdAt: now - 300 * DAY,
  },
  {
    id: 'cust-6',
    name: 'Hector Salinas',
    phone: '(469) 555 0134',
    source: 'Website',
    notes: '',
    createdAt: now - 9 * DAY,
  },
  {
    id: 'cust-7',
    name: 'Rancho La Esperanza',
    phone: '(972) 555 0155',
    source: 'Word of mouth',
    notes: 'Habla español. Preguntar por Doña Chela.',
    createdAt: now - 14 * DAY,
  },
  {
    id: 'cust-8',
    name: 'Wade Pittman',
    phone: '(214) 555 0122',
    source: 'Website',
    notes: '',
    createdAt: now - 26 * DAY,
  },
  {
    id: 'cust-9',
    name: 'Ramirez Brothers Concrete',
    phone: '(972) 555 0188',
    email: 'yard@ramirezbros.example',
    source: 'Word of mouth',
    notes: 'Orders straight from the yard, no quote needed.',
    createdAt: now - 160 * DAY,
  },
  {
    id: 'cust-10',
    name: 'Kyle Vance',
    phone: '(903) 555 0107',
    source: 'Website',
    notes: '',
    createdAt: now - 70 * DAY,
  },
  {
    id: 'cust-11',
    name: 'Delia Fuentes',
    phone: '(469) 555 0151',
    source: 'Facebook',
    notes: 'Habla español.',
    createdAt: now - 45 * DAY,
  },
  {
    id: 'cust-12',
    name: 'Sunset Acres',
    phone: '(972) 555 0173',
    source: 'Word of mouth',
    notes: '',
    createdAt: now - 190 * DAY,
  },
]

/** Phone is the primary duplicate match. Digits only, so formatting never blocks a match. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Duplicate handling: phone is the primary match, email is the secondary match.
 * Similar names alone never merge two people.
 */
export function matchCustomer(
  customers: Customer[],
  phone: string,
  email?: string,
): Customer | undefined {
  const digits = normalizePhone(phone)
  if (digits.length >= 7) {
    const byPhone = customers.find((c) => normalizePhone(c.phone) === digits)
    if (byPhone) return byPhone
  }
  const cleanEmail = email?.trim().toLowerCase()
  if (cleanEmail) {
    const byEmail = customers.find((c) => c.email?.toLowerCase() === cleanEmail)
    if (byEmail) return byEmail
  }
  return undefined
}

/* --------------------------------------------------------------------- leads */

export const LEADS: Lead[] = [
  {
    id: 'lead-1',
    customerId: 'cust-3',
    status: 'NEW',
    need: 'Rock for the driveway, about 200 feet',
    source: 'Facebook',
    campaign: 'marketplace-driveway',
    createdAt: now - 40 * MINUTE,
    lastActivityAt: now - 38 * MINUTE,
    needsSalvador: false,
    aiPaused: false,
    notes: '',
    messages: [
      {
        id: 'm-1',
        actor: 'customer',
        at: now - 40 * MINUTE,
        text: 'hi, how much would it be for rock for my driveway',
      },
      {
        id: 'm-2',
        actor: 'ai',
        at: now - 38 * MINUTE,
        text: 'hey, we can help you with that. what city is the driveway in so i can check the delivery for you.',
      },
    ],
    known: [
      { label: 'Name', value: 'Marisol Reyes' },
      { label: 'Phone', value: '(469) 555 0177' },
      { label: 'Service', value: 'Driveway rock' },
      { label: 'Size', value: 'About 200 feet' },
    ],
    missing: ['Exact address', 'How many yards', 'When they need it'],
  },
  {
    id: 'lead-2',
    customerId: 'cust-2',
    status: 'TALKING',
    need: 'Pond, about half an acre, off FM 987',
    source: 'Facebook',
    createdAt: now - 4 * HOUR,
    lastActivityAt: now - 95 * MINUTE,
    needsSalvador: true,
    aiPaused: false,
    notes: 'Wants it before the fall rain.',
    messages: [
      {
        id: 'm-3',
        actor: 'customer',
        at: now - 4 * HOUR,
        text: 'i need a pond dug on my place off fm 987, about half an acre',
      },
      {
        id: 'm-4',
        actor: 'ai',
        at: now - 4 * HOUR + 2 * MINUTE,
        text: 'got it. is there water running to that spot already, or is it dry ground right now.',
      },
      {
        id: 'm-5',
        actor: 'customer',
        at: now - 2 * HOUR,
        text: 'dry right now. how much would something like that run me',
      },
      {
        id: 'm-6',
        actor: 'ai',
        at: now - 95 * MINUTE,
        text: 'a pond that size is not a set price, salvador puts the number on those himself. i am getting him on this for you.',
        escalation: true,
      },
    ],
    known: [
      { label: 'Service', value: 'Pond, about half an acre' },
      { label: 'City', value: 'Off FM 987, Kaufman' },
      { label: 'Ground', value: 'Dry right now' },
      { label: 'Timing', value: 'Before the fall rain' },
    ],
    missing: ['Site access for equipment', 'Depth they want', 'Your price'],
  },
  {
    id: 'lead-3',
    customerId: 'cust-7',
    status: 'TALKING',
    need: 'Material to fill a low area at the ranch',
    source: 'Word of mouth',
    createdAt: now - 2 * DAY,
    lastActivityAt: now - 2 * DAY + 20 * MINUTE,
    needsSalvador: false,
    aiPaused: false,
    notes: '',
    messages: [
      {
        id: 'm-7',
        actor: 'customer',
        at: now - 2 * DAY,
        text: 'buenas, necesito material para rellenar un area en el rancho',
      },
      {
        id: 'm-8',
        actor: 'ai',
        at: now - 2 * DAY + 3 * MINUTE,
        text: 'claro que sí. como cuántas yardas cree que necesita y en qué parte de kaufman está el rancho.',
      },
      {
        id: 'm-9',
        actor: 'customer',
        at: now - 2 * DAY + 18 * MINUTE,
        text: 'como 40 yardas, estamos por el camino 4021',
      },
      {
        id: 'm-10',
        actor: 'ai',
        at: now - 2 * DAY + 20 * MINUTE,
        text: 'perfecto, eso son dos cargas completas. le preparo el precio con la entrega y se lo paso.',
      },
    ],
    known: [
      { label: 'Service', value: 'Fill material' },
      { label: 'Quantity', value: 'About 40 yards' },
      { label: 'City', value: 'County Road 4021, Kaufman' },
      { label: 'Language', value: 'Spanish' },
    ],
    missing: ['Which material they want', 'When they need it'],
  },
  {
    id: 'lead-4',
    customerId: 'cust-4',
    status: 'WON',
    need: 'Base material for the front entrance, 3 loads',
    source: 'Walk in',
    createdAt: now - 6 * DAY,
    lastActivityAt: now - 20 * HOUR,
    needsSalvador: false,
    aiPaused: false,
    notes: 'Accepted yesterday. Still needs a work date.',
    quoteId: 'q-1',
    messages: [
      {
        id: 'm-11',
        actor: 'customer',
        at: now - 6 * DAY,
        text: 'hey we need base material for the entrance, como 3 loads',
      },
      {
        id: 'm-12',
        actor: 'ai',
        at: now - 6 * DAY + 4 * MINUTE,
        text: 'perfecto, 3 cargas de flexbase. what is the address for the entrance so i can add the delivery.',
      },
      {
        id: 'm-13',
        actor: 'customer',
        at: now - 6 * DAY + 30 * MINUTE,
        text: 'highway 175 frontage, right by the feed store',
      },
      {
        id: 'm-14',
        actor: 'ai',
        at: now - 6 * DAY + 32 * MINUTE,
        text: 'got it. le paso la cotización con material y entrega en un momento.',
      },
      {
        id: 'm-15',
        actor: 'customer',
        at: now - 20 * HOUR,
        text: 'looks good, we are ready whenever you are',
      },
    ],
    known: [
      { label: 'Service', value: 'Base material, 3 full loads' },
      { label: 'Address', value: 'Highway 175 frontage, Kaufman' },
      { label: 'Material', value: 'Flexbase First Class' },
      { label: 'Language', value: 'Spanglish' },
    ],
    missing: ['Work date'],
  },
  {
    id: 'lead-5',
    customerId: 'cust-5',
    status: 'QUOTED',
    need: 'Gravel for the back road',
    source: 'Word of mouth',
    createdAt: now - 5 * DAY,
    lastActivityAt: now - 3 * DAY,
    needsSalvador: false,
    aiPaused: false,
    notes: 'Second job for Dwayne. First one was the back road base last year.',
    quoteId: 'q-2',
    messages: [
      {
        id: 'm-16',
        actor: 'customer',
        at: now - 5 * DAY,
        text: 'hey salvador, the back road needs gravel again after all that rain',
      },
      {
        id: 'm-17',
        actor: 'ai',
        at: now - 5 * DAY + 5 * MINUTE,
        text: 'hey dwayne, good to hear from you. same stretch as last time, or a longer run this time.',
      },
      {
        id: 'm-18',
        actor: 'customer',
        at: now - 5 * DAY + 40 * MINUTE,
        text: 'same stretch, maybe a little past the barn',
      },
      {
        id: 'm-19',
        actor: 'salvador',
        at: now - 3 * DAY,
        text: 'Sent you a quote for three loads of native gravel. Let me know and we will get it on the calendar.',
      },
    ],
    known: [
      { label: 'Service', value: 'Gravel, back road' },
      { label: 'Address', value: 'On file from the 2025 job' },
      { label: 'Quantity', value: '3 full loads' },
      { label: 'History', value: 'Repeat customer' },
    ],
    missing: ['Answer on the quote'],
  },
  {
    id: 'lead-6',
    customerId: 'cust-6',
    status: 'QUOTED',
    need: 'Driveway, 300 feet, needs base and topping',
    source: 'Website',
    campaign: 'flyer-qr-spring',
    createdAt: now - 9 * DAY,
    lastActivityAt: now - 7 * DAY,
    needsSalvador: false,
    aiPaused: false,
    notes: '',
    quoteId: 'q-3',
    messages: [
      {
        id: 'm-20',
        actor: 'customer',
        at: now - 9 * DAY,
        text: 'saw your flyer, i need a driveway put in, about 300 feet',
      },
      {
        id: 'm-21',
        actor: 'ai',
        at: now - 9 * DAY + 6 * MINUTE,
        text: 'we can do that. is there anything down now, or is it bare dirt at the moment.',
      },
      {
        id: 'm-22',
        actor: 'customer',
        at: now - 9 * DAY + 90 * MINUTE,
        text: 'bare dirt, gets soft when it rains',
      },
      {
        id: 'm-23',
        actor: 'ai',
        at: now - 7 * DAY,
        text: 'your quote is on the way. it covers grading the run first, then base on top so it holds up in the wet.',
      },
    ],
    known: [
      { label: 'Service', value: 'New driveway, 300 feet' },
      { label: 'Condition', value: 'Bare dirt, soft when wet' },
      { label: 'Source', value: 'Flyer QR code' },
    ],
    missing: ['Answer on the quote', 'Work date'],
  },
  {
    id: 'lead-7',
    customerId: 'cust-1',
    status: 'WON',
    need: 'Material delivery, County Road 4021',
    source: 'Word of mouth',
    createdAt: now - 11 * DAY,
    lastActivityAt: now - 3 * DAY,
    needsSalvador: false,
    aiPaused: false,
    notes: 'On the calendar for today.',
    quoteId: 'q-4',
    messages: [
      {
        id: 'm-24',
        actor: 'customer',
        at: now - 11 * DAY,
        text: 'we need two loads of crushed concrete out at the ranch',
      },
      {
        id: 'm-25',
        actor: 'ai',
        at: now - 11 * DAY + 3 * MINUTE,
        text: 'sure thing. same gate off county road 4021.',
      },
      {
        id: 'm-26',
        actor: 'customer',
        at: now - 11 * DAY + 25 * MINUTE,
        text: 'yes same gate',
      },
    ],
    known: [
      { label: 'Service', value: 'Material delivery, 2 full loads' },
      { label: 'Address', value: 'County Road 4021, Kaufman' },
      { label: 'Material', value: 'Commercial Crushed Concrete Clean' },
    ],
    missing: ['Current gate code'],
  },
  {
    id: 'lead-8',
    customerId: 'cust-8',
    status: 'LOST',
    need: 'Dirt work behind the shop',
    source: 'Website',
    createdAt: now - 26 * DAY,
    lastActivityAt: now - 19 * DAY,
    needsSalvador: false,
    aiPaused: false,
    notes: '',
    lostReason: 'Went with someone closer to Terrell',
    messages: [
      {
        id: 'm-27',
        actor: 'customer',
        at: now - 26 * DAY,
        text: 'do you all do dirt work behind a shop building',
      },
      {
        id: 'm-28',
        actor: 'ai',
        at: now - 26 * DAY + 8 * MINUTE,
        text: 'we do. what is the address and about how big is the area.',
      },
      {
        id: 'm-29',
        actor: 'customer',
        at: now - 19 * DAY,
        text: 'we went with someone closer to terrell, thanks anyway',
      },
    ],
    known: [
      { label: 'Service', value: 'Dirt work' },
      { label: 'Outcome', value: 'Went with another company' },
    ],
    missing: [],
  },
  {
    id: 'lead-9',
    customerId: 'cust-5',
    status: 'WON',
    need: 'Back road base, first job',
    source: 'Word of mouth',
    createdAt: now - 300 * DAY,
    lastActivityAt: now - 292 * DAY,
    needsSalvador: false,
    aiPaused: false,
    notes: 'Completed and paid. This is the job that brought him back.',
    messages: [
      {
        id: 'm-30',
        actor: 'customer',
        at: now - 300 * DAY,
        text: 'a neighbor said you all put in his road, mine washes out every spring',
      },
      {
        id: 'm-31',
        actor: 'salvador',
        at: now - 299 * DAY,
        text: 'We can fix that. I will come look at it this week.',
      },
    ],
    known: [
      { label: 'Service', value: 'Back road base' },
      { label: 'Outcome', value: 'Completed and paid' },
    ],
    missing: [],
  },
]

/* -------------------------------------------------------------------- quotes */

function line(id: string, materialId: string, loads: number): MaterialLine {
  const material = materialById(materialId)
  if (!material) throw new Error(`Unknown material ${materialId}`)
  return buildMaterialLine(id, material, { isFullLoad: true, loads })
}

export const QUOTES: Quote[] = [
  {
    id: 'q-1',
    number: 'Q1004',
    leadId: 'lead-4',
    customerId: 'cust-4',
    status: 'ACCEPTED',
    description: 'Base material for the front entrance',
    address: 'Highway 175 frontage, Kaufman',
    materialLines: [line('ql-1', 'mat-4', 3)],
    customLines: [],
    delivery: { mode: 'TIER_3_5' },
    deliveryLoads: 3,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    customWorkTax: TAX_ON_CUSTOM_WORK,
    createdAt: now - 6 * DAY + 40 * MINUTE,
    sentAt: now - 6 * DAY + 45 * MINUTE,
    acceptedAt: now - 20 * HOUR,
  },
  {
    id: 'q-2',
    number: 'Q1005',
    leadId: 'lead-5',
    customerId: 'cust-5',
    status: 'SENT',
    description: 'Gravel for the back road, same stretch as the 2025 job',
    address: 'County Road 317, Kaufman',
    materialLines: [line('ql-2', 'mat-7', 3)],
    customLines: [],
    delivery: { mode: 'OVER_10', miles: 15 },
    deliveryLoads: 3,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    customWorkTax: TAX_ON_CUSTOM_WORK,
    createdAt: now - 3 * DAY - HOUR,
    sentAt: now - 3 * DAY,
  },
  {
    id: 'q-3',
    number: 'Q1003',
    leadId: 'lead-6',
    customerId: 'cust-6',
    status: 'SENT',
    description: 'New driveway, 300 feet, graded then based',
    address: '4118 County Road 210, Kaufman',
    materialLines: [line('ql-3', 'mat-4', 4)],
    customLines: [{ id: 'qc-1', label: 'Grade and shape the driveway before base', amount: 900 }],
    delivery: { mode: 'TIER_6_10' },
    deliveryLoads: 4,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    customWorkTax: TAX_ON_CUSTOM_WORK,
    createdAt: now - 7 * DAY - 2 * HOUR,
    sentAt: now - 7 * DAY,
  },
  {
    id: 'q-4',
    number: 'Q1002',
    leadId: 'lead-7',
    customerId: 'cust-1',
    status: 'ACCEPTED',
    description: 'Two loads of crushed concrete to the ranch',
    address: 'County Road 4021, Kaufman',
    materialLines: [line('ql-4', 'mat-1', 2)],
    customLines: [],
    delivery: { mode: 'TIER_6_10' },
    deliveryLoads: 2,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    customWorkTax: TAX_ON_CUSTOM_WORK,
    createdAt: now - 11 * DAY,
    sentAt: now - 11 * DAY + HOUR,
    acceptedAt: now - 3 * DAY,
  },
]

export function quoteTotals(quote: Quote) {
  return quote.snapshotTotals ?? computeTotals({
    materialLines: quote.materialLines,
    customLines: quote.customLines,
    delivery: quote.delivery,
    deliveryLoads: quote.deliveryLoads,
    taxRate: quote.taxRate,
    taxOnDelivery: quote.taxOnDelivery,
    customWorkTax: quote.customWorkTax,
  })
}

export function quoteTotal(quoteId: string): number {
  const quote = QUOTES.find((entry) => entry.id === quoteId)
  return quote ? quoteTotals(quote).total : 0
}

/* ------------------------------------------------------------------- history */

/* Photos and job history now live on Job records in jobsData.ts. */

export const ACTIVITIES: Activity[] = [
  // Dwayne Roth, the repeat customer
  {
    id: 'a-1',
    customerId: 'cust-5',
    kind: 'lead',
    at: now - 300 * DAY,
    title: 'Lead created from word of mouth',
    body: 'Neighbor referral. Back road washes out every spring.',
  },
  {
    id: 'a-2',
    customerId: 'cust-5',
    kind: 'job',
    at: now - 292 * DAY,
    title: 'Job completed, back road base',
    ref: 'job-17',
    photos: ['/photos/job-1.jpg', '/photos/job-2.jpg'],
  },
  {
    id: 'a-3',
    customerId: 'cust-5',
    kind: 'ticket',
    at: now - 292 * DAY,
    title: 'Ticket MT1043 saved',
    body: '3 full loads, Native Gravel, delivered 15 miles',
    amount: 3669.68,
    ref: 'MT1043',
  },
  {
    id: 'a-4',
    customerId: 'cust-5',
    kind: 'money',
    at: now - 290 * DAY,
    title: 'Invoice 1021 paid by check',
    amount: 3669.68,
    ref: '1021',
  },
  {
    id: 'a-5',
    customerId: 'cust-5',
    kind: 'job',
    at: now - 38 * DAY,
    title: 'Job completed, driveway apron repair',
    ref: 'job-15',
    photos: ['/photos/job-3.jpg'],
  },
  {
    id: 'a-6',
    customerId: 'cust-5',
    kind: 'ticket',
    at: now - 38 * DAY,
    title: 'Ticket MT1092 saved',
    body: '20 yards, Commercial Crushed Concrete Clean',
    amount: 640,
    ref: 'MT1092',
  },
  {
    id: 'a-7',
    customerId: 'cust-5',
    kind: 'money',
    at: now - 5 * HOUR,
    title: 'Customer says the zelle was sent',
    body: 'Invoice 1039. Nothing is marked paid until you confirm it landed.',
    amount: 640,
    ref: '1039',
  },
  {
    id: 'a-8',
    customerId: 'cust-5',
    kind: 'lead',
    at: now - 5 * DAY,
    title: 'New lead on the same customer record',
    body: 'Gravel for the back road. No duplicate customer was created.',
  },
  {
    id: 'a-9',
    customerId: 'cust-5',
    kind: 'quote',
    at: now - 3 * DAY,
    title: 'Quote Q1005 sent',
    amount: 3669.68,
    ref: 'q-2',
  },

  // Ortiz Ranch
  {
    id: 'a-10',
    customerId: 'cust-1',
    kind: 'job',
    at: now - 120 * DAY,
    title: 'Job completed, pad build behind the barn',
    ref: 'job-16',
    photos: ['/photos/job-4.jpg', '/photos/job-5.jpg'],
  },
  {
    id: 'a-11',
    customerId: 'cust-1',
    kind: 'quote',
    at: now - 11 * DAY,
    title: 'Quote Q1002 sent',
    ref: 'q-4',
  },
  {
    id: 'a-12',
    customerId: 'cust-1',
    kind: 'quote',
    at: now - 3 * DAY,
    title: 'Quote Q1002 accepted',
    ref: 'q-4',
  },
  {
    id: 'a-13',
    customerId: 'cust-1',
    kind: 'job',
    at: now - 2 * DAY,
    title: 'Job scheduled for today',
    body: 'Material delivery, 7:30 AM',
  },

  // Kaufman Feed and Supply
  {
    id: 'a-14',
    customerId: 'cust-4',
    kind: 'quote',
    at: now - 6 * DAY,
    title: 'Quote Q1004 sent',
    ref: 'q-1',
  },
  {
    id: 'a-15',
    customerId: 'cust-4',
    kind: 'quote',
    at: now - 20 * HOUR,
    title: 'Quote Q1004 accepted',
    body: 'Waiting on a work date.',
    ref: 'q-1',
  },

  // Hector Salinas
  {
    id: 'a-16',
    customerId: 'cust-6',
    kind: 'quote',
    at: now - 7 * DAY,
    title: 'Quote Q1003 sent',
    ref: 'q-3',
  },
  {
    id: 'a-17',
    customerId: 'cust-6',
    kind: 'note',
    at: now - 4 * DAY,
    title: 'Note',
    body: 'Said he was comparing two prices. Worth one more follow up.',
  },
]
