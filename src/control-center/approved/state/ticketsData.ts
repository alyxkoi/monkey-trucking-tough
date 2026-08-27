/**
 * Tickets.
 *
 * A Ticket is proof and record of the material and delivery that was provided.
 * It is NOT the invoice and NOT the payment source of truth.
 *
 * One ticket can carry several materials, several loads of the same material,
 * several loads of different materials, and more than one truck's worth of
 * material, printed as one combined record. One truck does not equal one ticket.
 *
 * Pricing always comes from `pricing.ts`, the shared mirror of the Ticket system
 * settings, and every line snapshots what was actually charged.
 */

import {
  buildMaterialLine,
  computeTotals,
  materialById,
  TAX_ON_DELIVERY,
  TAX_RATE,
  type DeliverySelection,
  type MaterialLine,
} from './pricing'

export type TicketStatus = 'SAVED' | 'VOID'

/** A ticket saved with no signal waits locally until it can sync. */
export type TicketSync = 'SYNCED' | 'PENDING'

export type Driver = {
  id: string
  name: string
  isActive: boolean
}

/** The handoff records exactly one driver today. The roster is built in Settings. */
export const DRIVERS: Driver[] = [{ id: 'drv-1', name: 'Salvador Alvarez', isActive: true }]

export function configureDrivers(drivers: Driver[]) {
  DRIVERS.splice(0, DRIVERS.length, ...drivers)
}

export type TicketEdit = {
  at: number
  note: string
}

export type Ticket = {
  id: string
  /** MT1001 upward. Undefined until a queued ticket syncs and takes its number. */
  number?: string
  customerId: string
  /** Optional. A ticket can stand alone with no job behind it. */
  jobId?: string
  driverId: string
  address: string
  materialLines: MaterialLine[]
  delivery: DeliverySelection
  /**
   * Physical delivery loads, the number of trips actually charged for.
   * Defaults to the sum of the per material load counts and stays correctable.
   */
  deliveryLoads: number
  /** Snapshotted, exactly like the real tickets table. */
  taxRate: number
  taxOnDelivery: boolean
  notes: string
  status: TicketStatus
  sync: TicketSync
  createdAt: number
  printedAt?: number
  printCount: number
  voidedAt?: number
  voidReason?: string
  /** Every meaningful change after a ticket is finalised is recorded, never silent. */
  edits: TicketEdit[]
  /** Database snapshots win for finalized/legacy records; never recompute history. */
  snapshotTotals?: ReturnType<typeof computeTotals>
  /**
   * Legacy only. Payment status now lives on Invoice and Payment. These values are
   * kept for historical compatibility and are deliberately not emphasised in the
   * new design.
   */
  legacyPaymentStatus?: 'PAID' | 'UNPAID'
}

export const TICKET_PREFIX = 'MT'
export const TICKET_START = 1001

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

function line(id: string, materialId: string, loads: number): MaterialLine {
  const material = materialById(materialId)
  if (!material) throw new Error(`Unknown material ${materialId}`)
  return buildMaterialLine(id, material, { isFullLoad: true, loads })
}

function yards(id: string, materialId: string, amount: number): MaterialLine {
  const material = materialById(materialId)
  if (!material) throw new Error(`Unknown material ${materialId}`)
  return buildMaterialLine(id, material, { isFullLoad: false, yards: amount })
}

export const TICKETS: Ticket[] = [
  {
    id: 'tk-1',
    number: 'MT1043',
    customerId: 'cust-5',
    jobId: 'job-17',
    driverId: 'drv-1',
    address: 'County Road 317, Kaufman',
    materialLines: [line('tl-1', 'mat-7', 3)],
    delivery: { mode: 'OVER_10', miles: 15 },
    deliveryLoads: 3,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    notes: '',
    status: 'SAVED',
    sync: 'SYNCED',
    createdAt: now - 292 * DAY,
    printedAt: now - 292 * DAY,
    printCount: 1,
    edits: [],
    legacyPaymentStatus: 'PAID',
  },
  {
    id: 'tk-2',
    number: 'MT1092',
    customerId: 'cust-5',
    jobId: 'job-15',
    driverId: 'drv-1',
    address: 'County Road 317, Kaufman',
    materialLines: [yards('tl-2', 'mat-1', 20)],
    delivery: { mode: 'TIER_3_5' },
    deliveryLoads: 1,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    notes: 'Dropped at the apron, not the barn.',
    status: 'SAVED',
    sync: 'SYNCED',
    createdAt: now - 38 * DAY,
    printedAt: now - 38 * DAY,
    printCount: 1,
    edits: [],
    legacyPaymentStatus: 'UNPAID',
  },
  {
    id: 'tk-3',
    number: 'MT1096',
    customerId: 'cust-4',
    jobId: 'job-14',
    driverId: 'drv-1',
    address: 'Highway 175 frontage, Kaufman',
    materialLines: [line('tl-3', 'mat-4', 2)],
    delivery: { mode: 'TIER_3_5' },
    deliveryLoads: 2,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    notes: '',
    status: 'SAVED',
    sync: 'SYNCED',
    createdAt: now - 16 * DAY,
    printedAt: now - 16 * DAY,
    printCount: 2,
    edits: [],
    legacyPaymentStatus: 'PAID',
  },
  {
    id: 'tk-4',
    number: 'MT1097',
    customerId: 'cust-1',
    jobId: 'job-12',
    driverId: 'drv-1',
    address: 'County Road 4021, Kaufman',
    materialLines: [line('tl-4', 'mat-7', 3)],
    delivery: { mode: 'TIER_6_10' },
    deliveryLoads: 3,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    notes: '',
    status: 'SAVED',
    sync: 'SYNCED',
    createdAt: now - 9 * DAY,
    printedAt: now - 9 * DAY,
    printCount: 1,
    edits: [],
    legacyPaymentStatus: 'PAID',
  },
  {
    // Two materials on one ticket, three loads in total.
    id: 'tk-5',
    number: 'MT1098',
    customerId: 'cust-11',
    jobId: 'job-9',
    driverId: 'drv-1',
    address: '812 County Road 143, Kaufman',
    materialLines: [line('tl-5', 'mat-4', 2), line('tl-6', 'mat-1', 1)],
    delivery: { mode: 'TIER_6_10' },
    deliveryLoads: 3,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    notes: 'Base first, then the crushed concrete on top.',
    status: 'SAVED',
    sync: 'SYNCED',
    createdAt: now - 2 * DAY,
    printedAt: now - 2 * DAY,
    printCount: 1,
    edits: [],
    legacyPaymentStatus: 'UNPAID',
  },
  {
    // Standalone. No job behind it, the customer came to the yard.
    id: 'tk-6',
    number: 'MT1099',
    customerId: 'cust-9',
    driverId: 'drv-1',
    address: 'Picked up at the yard',
    materialLines: [line('tl-7', 'mat-3', 1)],
    delivery: { mode: 'PICKUP' },
    deliveryLoads: 1,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    notes: '',
    status: 'SAVED',
    sync: 'SYNCED',
    createdAt: now - 5 * DAY,
    printedAt: now - 5 * DAY,
    printCount: 1,
    edits: [],
    legacyPaymentStatus: 'PAID',
  },
  {
    id: 'tk-7',
    number: 'MT1100',
    customerId: 'cust-2',
    jobId: 'job-11',
    driverId: 'drv-1',
    address: 'Private road off FM 987',
    materialLines: [line('tl-8', 'mat-2', 1)],
    delivery: { mode: 'TIER_6_10' },
    deliveryLoads: 1,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    notes: '',
    status: 'VOID',
    sync: 'SYNCED',
    createdAt: now - 6 * DAY,
    voidedAt: now - 6 * DAY + 3600_000,
    voidReason: 'Written on the wrong customer, replaced the same day',
    printCount: 1,
    printedAt: now - 6 * DAY,
    edits: [],
  },
  {
    id: 'tk-8',
    number: 'MT1101',
    customerId: 'cust-9',
    jobId: 'job-2',
    driverId: 'drv-1',
    address: 'Industrial Boulevard yard, Kaufman',
    materialLines: [line('tl-9', 'mat-1', 2)],
    delivery: { mode: 'TIER_0_2' },
    deliveryLoads: 2,
    taxRate: TAX_RATE,
    taxOnDelivery: TAX_ON_DELIVERY,
    notes: '',
    status: 'SAVED',
    sync: 'SYNCED',
    createdAt: now - 3 * 3600_000,
    printCount: 0,
    edits: [],
    legacyPaymentStatus: 'UNPAID',
  },
]

export function ticketTotals(ticket: Ticket) {
  return ticket.snapshotTotals ?? computeTotals({
    materialLines: ticket.materialLines,
    customLines: [],
    delivery: ticket.delivery,
    deliveryLoads: ticket.deliveryLoads,
    taxRate: ticket.taxRate,
    taxOnDelivery: ticket.taxOnDelivery,
  })
}

/** Concise material summary for a list row. Never the whole line breakdown. */
export function materialSummary(ticket: Ticket): string {
  if (ticket.materialLines.length === 0) return 'No material'
  const totalLoads = ticket.materialLines.reduce((sum, line) => sum + (line.loads ?? 0), 0)
  const first = ticket.materialLines[0]
  const rest = ticket.materialLines.length - 1
  const loadPart = totalLoads > 0 ? `${totalLoads} ${totalLoads === 1 ? 'load' : 'loads'}, ` : ''
  return rest > 0
    ? `${loadPart}${first.materialName} and ${rest} more`
    : `${loadPart}${first.materialName}`
}

export function totalYards(ticket: Ticket): number {
  return ticket.materialLines.reduce((sum, line) => sum + line.yards, 0)
}

export function driverName(id: string): string {
  return DRIVERS.find((driver) => driver.id === id)?.name ?? 'Unassigned'
}
