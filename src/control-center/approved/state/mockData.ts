/**
 * Period control shared by the Overview Money Snapshot and the Money section.
 *
 * Everything that used to be mocked here now comes from real records: money from
 * invoices, payments and worker pay, the schedule from jobs, the pipeline from
 * leads and quotes, and Needs Attention derived from all of them.
 */

export type Period = '7D' | 'MTD' | 'LAST_MONTH'

export const PERIOD_LABELS: Record<Period, string> = {
  '7D': '7 Days',
  MTD: 'Month to Date',
  LAST_MONTH: 'Last Month',
}
