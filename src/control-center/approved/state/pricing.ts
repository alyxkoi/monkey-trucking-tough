import { CURRENT_TAX_RATE_PERCENT, taxRateMultiplier } from '@/lib/tax'

/**
 * PRICING MIRROR OF THE EXISTING TICKET SYSTEM.
 *
 * Every value here is copied from MonkeyTrucking_TicketSystem_Handoff.md section 4.
 * In the real system these rows live in Supabase `materials` and `app_settings` and
 * are edited in Settings, not in code.
 *
 * This file is a prototype stand in for those rows. It is NOT a second price list.
 * Quotes and Tickets both read from here, exactly as they will both read from the
 * same settings tables in the real product.
 *
 * Everything is sold in YARDS. Tons are not used anywhere in this system.
 */

/** A full load is 20 yards, charged at a flat discounted rate, not 20x the per yard price. */
export const FULL_LOAD_YARDS = 20

export type Material = {
  id: string
  name: string
  pricePerYard: number
  fullLoadPrice: number
  fullLoadYards: number
  isActive: boolean
  sortOrder: number
}

export const MATERIALS: Material[] = [
  {
    id: 'mat-1',
    name: 'Commercial Crushed Concrete Clean',
    pricePerYard: 20,
    fullLoadPrice: 350,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'mat-2',
    name: 'Select Fill and Cushion Sand',
    pricePerYard: 20,
    fullLoadPrice: 350,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'mat-3',
    name: '3x4 Crushed Concrete',
    pricePerYard: 35,
    fullLoadPrice: 700,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'mat-4',
    name: 'Flexbase First Class 1" or 3"',
    pricePerYard: 38,
    fullLoadPrice: 720,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'mat-5',
    name: 'Mason Sand',
    pricePerYard: 45,
    fullLoadPrice: 820,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'mat-6',
    name: 'Millings Asphalt 1/2" Minus',
    pricePerYard: 45,
    fullLoadPrice: 840,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 6,
  },
  {
    id: 'mat-7',
    name: 'Native Gravel 3/8"-1"',
    pricePerYard: 53,
    fullLoadPrice: 980,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 7,
  },
  {
    id: 'mat-8',
    name: 'Concrete Sand Mix Native Gravel',
    pricePerYard: 55,
    fullLoadPrice: 1040,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 8,
  },
  {
    id: 'mat-9',
    name: 'Decomposed Granite',
    pricePerYard: 65,
    fullLoadPrice: 1200,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 9,
  },
  {
    id: 'mat-10',
    name: 'Limestone 1"-1 1/2"',
    pricePerYard: 95,
    fullLoadPrice: 1700,
    fullLoadYards: 20,
    isActive: true,
    sortOrder: 10,
  },
]

export function materialById(id: string): Material | undefined {
  return MATERIALS.find((material) => material.id === id)
}

/* ------------------------------------------------------------------ delivery */

export type DeliveryMode =
  | 'UNSET'
  | 'TIER_0_2'
  | 'TIER_3_5'
  | 'TIER_6_10'
  | 'OVER_10'
  | 'PICKUP'
  | 'CUSTOM'

export type DeliverySelection = {
  mode: DeliveryMode
  /** Total miles, only used by OVER_10. */
  miles?: number
  /** Manually typed fee per load, only used by CUSTOM. */
  customFee?: number
}

/** Delivery tiers, from app_settings in the real system. */
export const DELIVERY_TIERS = {
  tier3to5: 60,
  tier6to10: 100,
  over10Base: 100,
  over10PerMile: 10,
  over10Threshold: 10,
}

export const DELIVERY_OPTIONS: { mode: DeliveryMode; label: string; hint: string }[] = [
  { mode: 'TIER_0_2', label: '0 to 2 miles', hint: 'Free' },
  { mode: 'TIER_3_5', label: '3 to 5 miles', hint: '$60 per load' },
  { mode: 'TIER_6_10', label: '6 to 10 miles', hint: '$100 per load' },
  { mode: 'OVER_10', label: 'Over 10 miles', hint: '$100 plus $10 a mile past 10' },
  { mode: 'PICKUP', label: 'Customer pickup', hint: 'Free' },
  { mode: 'CUSTOM', label: 'Custom', hint: 'Typed in manually' },
]

/**
 * Delivery is charged PER LOAD, then multiplied by the number of loads.
 * 15 miles is $100 + $50 = $150 per load. Three loads to that address is $450.
 */
export function deliveryFeePerLoad(delivery: DeliverySelection): number {
  switch (delivery.mode) {
    // UNSET means the zone has not been picked yet. It charges nothing and blocks
    // sending, so delivery is never silently assumed on a quote.
    case 'UNSET':
    case 'TIER_0_2':
    case 'PICKUP':
      return 0
    case 'TIER_3_5':
      return DELIVERY_TIERS.tier3to5
    case 'TIER_6_10':
      return DELIVERY_TIERS.tier6to10
    case 'OVER_10': {
      const miles = delivery.miles ?? DELIVERY_TIERS.over10Threshold
      const extra = Math.max(0, miles - DELIVERY_TIERS.over10Threshold)
      return DELIVERY_TIERS.over10Base + extra * DELIVERY_TIERS.over10PerMile
    }
    case 'CUSTOM':
      return delivery.customFee ?? 0
  }
}

export function deliveryLabel(delivery: DeliverySelection): string {
  if (delivery.mode === 'UNSET') return 'Not picked yet'
  const option = DELIVERY_OPTIONS.find((entry) => entry.mode === delivery.mode)
  if (delivery.mode === 'OVER_10') return `${delivery.miles ?? 0} miles`
  return option?.label ?? 'Delivery'
}

/* ----------------------------------------------------------------------- tax */

/** Current operational rate, stored as percentage points. 8.25 means 8.25%. */
export const TAX_RATE = CURRENT_TAX_RATE_PERCENT

/** Applied to materials plus delivery by default. Settings can switch it to materials only. */
export const TAX_ON_DELIVERY = true

/**
 * Custom work tax treatment is UNRESOLVED.
 *
 * The Ticket System Handoff only defines tax behaviour for materials and delivery.
 * It says nothing about service labour, and section 13 already lists sales tax as
 * something to confirm with the bookkeeper. So the prototype does not guess.
 *
 * PENDING means custom work is excluded from the taxable base and the quote says
 * so on screen. Once the bookkeeper confirms, this becomes a real setting in
 * Settings, and the value is snapshotted onto each quote so the answer can change
 * later without rewriting old quotes.
 */
export type CustomWorkTaxRule = 'PENDING' | 'TAXED' | 'NOT_TAXED'

export const TAX_ON_CUSTOM_WORK: CustomWorkTaxRule = 'PENDING'

/**
 * Hydrates the approved UI's single pricing catalog from the managed Supabase
 * tables. The array/object identities stay stable because picker components
 * import them directly; only their contents are replaced after the authenticated
 * Control Center data has loaded.
 */
export function configurePricing(input: {
  materials: Material[]
  delivery?: Partial<typeof DELIVERY_TIERS>
}) {
  MATERIALS.splice(0, MATERIALS.length, ...input.materials.sort((a, b) => a.sortOrder - b.sortOrder))
  if (input.delivery) Object.assign(DELIVERY_TIERS, input.delivery)
}

/* --------------------------------------------------------------------- lines */

/**
 * A material line. `materialName`, `rateUsed` and `lineTotal` are SNAPSHOTS taken
 * when the line is created, exactly like ticket_items in the real database.
 * Never replace these with a live join to the materials table: doing so silently
 * rewrites historical quotes and tickets to current pricing.
 *
 * CODEX HANDOFF FLAG, LIKELY MIGRATION REQUIRED.
 * `loads` below is an ITEM LEVEL load count. The current real schema documented in
 * MonkeyTrucking_TicketSystem_Handoff.md section 10 does NOT have one:
 * `ticket_items` is ticket_id, material_id, material_name, yards, is_full_load,
 * rate_used, line_total, and the load count lives on `tickets` as a single record
 * level value.
 *
 * Monkey Trucking needs one ticket to carry different load counts for different
 * materials, for example 3 loads of Flexbase and 2 loads of Crushed Concrete. A
 * single record level load count cannot express that, so this prototype puts loads
 * on the line. That is a real schema gap, not something the current tables already
 * support.
 *
 * Codex must plan a historically safe migration, for example an added
 * `ticket_items.loads` column, or an equivalent representation that preserves what
 * old tickets actually charged. Legacy ticket rows must not be modified,
 * backfilled with guessed values, or reinterpreted. Existing records keep their
 * current meaning and the record level load count they were saved with.
 */
export type MaterialLine = {
  id: string
  materialId: string
  materialName: string
  isFullLoad: boolean
  /** Number of full loads on this line. Zero for a custom yardage line. */
  /** Null is preserved for legacy rows; it is never inferred or backfilled. */
  loads: number | null
  yards: number
  /** Full load price when isFullLoad, otherwise the per yard rate. */
  rateUsed: number
  lineTotal: number
}

/** Custom work belongs to Quotes only. Tickets are material and delivery proof. */
export type CustomLine = {
  id: string
  label: string
  amount: number
}

/**
 * Builds a snapshotted material line.
 *
 * The handoff's worked example prices a full load times the number of loads
 * ($980 x 3 = $2,940), so loads live on the line and expand into yards:
 * 3 full loads of a 20 yard material is 60 yards at the full load rate x 3.
 * The quote or ticket level load count then drives delivery only, which is what
 * lets one record carry 3 loads of one material and 2 loads of another.
 */
export function buildMaterialLine(
  id: string,
  material: Material,
  options: { isFullLoad: boolean; loads?: number; yards?: number },
): MaterialLine {
  if (options.isFullLoad) {
    const loads = Math.max(1, Math.round(options.loads ?? 1))
    return {
      id,
      materialId: material.id,
      materialName: material.name,
      isFullLoad: true,
      loads,
      yards: material.fullLoadYards * loads,
      rateUsed: material.fullLoadPrice,
      lineTotal: material.fullLoadPrice * loads,
    }
  }

  const yards = Math.max(0, options.yards ?? 0)
  return {
    id,
    materialId: material.id,
    materialName: material.name,
    isFullLoad: false,
    loads: 0,
    yards,
    rateUsed: material.pricePerYard,
    lineTotal: Math.round(yards * material.pricePerYard * 100) / 100,
  }
}

/**
 * Delivery loads implied by the material lines.
 * This is only the DEFAULT for the ticket or quote level delivery load count.
 * The stored value is never forced to equal this, because the real number of
 * trips can differ from the loads written on the material lines.
 */
export function suggestedDeliveryLoads(lines: MaterialLine[]): number {
  const full = lines
    .filter((line) => line.isFullLoad)
    .reduce((sum, line) => sum + (line.loads ?? 0), 0)
  const partial = lines.some((line) => !line.isFullLoad) ? 1 : 0
  return Math.max(1, full + partial)
}

export type Totals = {
  materials: number
  custom: number
  deliveryPerLoad: number
  delivery: number
  taxable: number
  tax: number
  taxRate: number
  total: number
  customWorkTax: CustomWorkTaxRule
  /** True only when custom work was actually included in the taxable base. */
  customTaxed: boolean
}

export function computeTotals(input: {
  materialLines: MaterialLine[]
  customLines: CustomLine[]
  delivery: DeliverySelection
  /**
   * Ticket or quote level count of PHYSICAL delivery loads.
   * This is a separate concept from the per material load count on each line.
   * It defaults to the sum of the material line loads, and it stays independent
   * so Salvador can correct the real number of trips when they differ.
   */
  deliveryLoads: number
  taxRate?: number
  taxOnDelivery?: boolean
  customWorkTax?: CustomWorkTaxRule
}): Totals {
  const taxRate = input.taxRate ?? TAX_RATE
  const taxOnDelivery = input.taxOnDelivery ?? TAX_ON_DELIVERY
  const customWorkTax = input.customWorkTax ?? TAX_ON_CUSTOM_WORK

  const materials = input.materialLines.reduce((sum, line) => sum + line.lineTotal, 0)
  const custom = input.customLines.reduce((sum, line) => sum + line.amount, 0)
  const deliveryPerLoad = deliveryFeePerLoad(input.delivery)
  const delivery = deliveryPerLoad * Math.max(0, input.deliveryLoads)

  // Custom work is only taxed once someone has actually decided that it should be.
  const customTaxed = customWorkTax === 'TAXED'
  const taxable =
    materials + (customTaxed ? custom : 0) + (taxOnDelivery ? delivery : 0)
  const tax = Math.round(taxable * taxRateMultiplier(taxRate) * 100) / 100
  const total = Math.round((materials + custom + delivery + tax) * 100) / 100

  return {
    materials,
    custom,
    deliveryPerLoad,
    delivery,
    taxable,
    tax,
    taxRate,
    total,
    customWorkTax,
    customTaxed,
  }
}
