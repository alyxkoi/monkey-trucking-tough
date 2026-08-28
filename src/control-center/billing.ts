type TaxSettings = {
  tax_enabled?: boolean | null
  tax_rate?: number | string | null
}

type ProcessingFeeSettings = {
  processing_fee_enabled?: boolean | null
  processing_fee_rate?: number | string | null
}

export function percentagePoints(value: unknown): number {
  const rate = Number(value)
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0
}

/** Legacy schemas have no tax_enabled column, so their stored rate remains authoritative. */
export function effectiveTaxRate(settings: TaxSettings | null | undefined): number {
  if (settings?.tax_enabled === false) return 0
  return percentagePoints(settings?.tax_rate)
}

export function processingFeeFor(
  subtotal: number,
  settings: ProcessingFeeSettings | null | undefined,
) {
  const safeSubtotal = Math.max(0, Number.isFinite(subtotal) ? subtotal : 0)
  const rate = settings?.processing_fee_enabled ? percentagePoints(settings.processing_fee_rate) : 0
  const amount = Math.round(safeSubtotal * (rate / 100) * 100) / 100
  return {
    subtotal: Math.round(safeSubtotal * 100) / 100,
    rate,
    amount,
    total: Math.round((safeSubtotal + amount) * 100) / 100,
  }
}
