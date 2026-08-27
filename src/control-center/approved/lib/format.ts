/** Money and time formatting for the Monkey Trucking control center. */

export { formatTaxRate } from '@/lib/tax'

/** Whole dollar money, used for the oversized number modules. */
export function usd(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

/** Money with cents, used where an exact figure matters. */
export function usdExact(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

/** Splits a dollar figure so the $ can be rendered smaller than the number. */
export function splitMoney(value: number): { symbol: string; amount: string } {
  return { symbol: '$', amount: Math.round(value).toLocaleString('en-US') }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "40m waiting", "3h waiting", "2d waiting". Drives Needs Attention sorting copy. */
export function waitingFor(since: number, now = Date.now()): string {
  const delta = Math.max(0, now - since)
  if (delta < HOUR) return `${Math.max(1, Math.round(delta / MINUTE))}m waiting`
  if (delta < DAY) return `${Math.round(delta / HOUR)}h waiting`
  return `${Math.round(delta / DAY)}d waiting`
}

export function shortAgo(since: number, now = Date.now()): string {
  const delta = Math.max(0, now - since)
  if (delta < HOUR) return `${Math.max(1, Math.round(delta / MINUTE))}m`
  if (delta < DAY) return `${Math.round(delta / HOUR)}h`
  return `${Math.round(delta / DAY)}d`
}

const WEEKDAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]

const MONTHS_LONG = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
]

export type DateParts = {
  day: string
  month: string
  monthLong: string
  weekday: string
  weekdayShort: string
  full: string
}

export function dateParts(date = new Date()): DateParts {
  const weekday = WEEKDAYS[date.getDay()]
  return {
    day: String(date.getDate()),
    month: MONTHS[date.getMonth()],
    monthLong: MONTHS_LONG[date.getMonth()],
    weekday,
    weekdayShort: weekday.slice(0, 3),
    full: `${weekday}, ${MONTHS_LONG[date.getMonth()]} ${date.getDate()}`,
  }
}

/** "Good morning", "Good afternoon", "Good evening". Local time on the device. */
export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Splits "7:30 AM" so the meridiem can be rendered smaller than the time. */
export function splitTime(label: string): { time: string; meridiem: string } {
  const [time, meridiem = ''] = label.split(' ')
  return { time, meridiem }
}
