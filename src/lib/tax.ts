/** Tax rates are stored and transported as percentage points: 8.25 means 8.25%. */
export const CURRENT_TAX_RATE_PERCENT = 0

export function taxRateMultiplier(ratePercent: number): number {
  return Number.isFinite(ratePercent) ? ratePercent / 100 : 0
}

export function formatTaxRate(ratePercent: number): string {
  const safeRate = Number.isFinite(ratePercent) ? ratePercent : 0
  return `${safeRate.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    useGrouping: false,
  })}%`
}
