/**
 * Jobs are actual scheduled work.
 * The calendar reads Job records directly. There is no second calendar store and
 * no duplicated schedule data.
 */

export type JobStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type JobCategory =
  | 'MATERIAL_DELIVERY'
  | 'DRIVEWAY'
  | 'POND'
  | 'DIRT_GRADING'
  | 'LIGHT_CLEARING'
  | 'OTHER'

export const JOB_CATEGORY_LABEL: Record<JobCategory, string> = {
  MATERIAL_DELIVERY: 'Material Delivery',
  DRIVEWAY: 'Driveway or Private Road',
  POND: 'Pond',
  DIRT_GRADING: 'Dirt or Grading',
  LIGHT_CLEARING: 'Light Land Clearing',
  OTHER: 'Other',
}

export const JOB_CATEGORIES = Object.keys(JOB_CATEGORY_LABEL) as JobCategory[]

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export type Job = {
  id: string
  customerId: string
  /** Optional. A job can exist without a quote, that bypass is approved. */
  quoteId?: string
  category: JobCategory
  status: JobStatus
  /** Local calendar day, YYYY-MM-DD. */
  date: string
  /** 24 hour HH:MM. Absent when the job is all day. */
  time?: string
  allDay: boolean
  address: string
  description: string
  agreedAmount: number
  notes: string
  photos: string[]
  /** Filled in Prompt 5. */
  invoiceId?: string
  /** The customer asked to move it. AI never moves a job on its own. */
  changeRequested?: boolean
  /** Something is stopping today's work. Drives the top of Needs Attention. */
  blocked?: string
  blockedAt?: number
  createdAt: number
  completedAt?: number
  cancelledAt?: number
  cancelReason?: string
}

/* ----------------------------------------------------------------- date help */

export function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** All day work is treated as starting at 8 am for reminder timing only. */
export function jobStart(job: Job): Date {
  const date = parseDateKey(job.date)
  const [hours, minutes] = (job.allDay ? '08:00' : (job.time ?? '08:00')).split(':').map(Number)
  date.setHours(hours, minutes, 0, 0)
  return date
}

/**
 * One reminder, roughly 24 hours before the job.
 * Skipped when the job was scheduled less than 24 hours before the work, because
 * a reminder that lands after the truck does is noise.
 */
export function reminderFor(job: Job): { at: number; skipped: boolean } {
  const at = jobStart(job).getTime() - 24 * 60 * 60 * 1000
  return { at, skipped: job.createdAt > at }
}

export function formatTime(job: Job): string {
  if (job.allDay || !job.time) return 'ALL DAY'
  const [hours, minutes] = job.time.split(':').map(Number)
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${String(minutes).padStart(2, '0')} ${meridiem}`
}

/* ---------------------------------------------------------------------- seed */

const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()
const today = new Date()

function offset(days: number): string {
  const date = new Date(today)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export const JOBS: Job[] = [
  /* ------------------------------------------------------------ today */
  {
    id: 'job-1',
    customerId: 'cust-1',
    quoteId: 'q-4',
    category: 'MATERIAL_DELIVERY',
    status: 'SCHEDULED',
    date: offset(0),
    time: '07:30',
    allDay: false,
    address: 'County Road 4021, Kaufman',
    description: 'Two loads of crushed concrete to the ranch',
    agreedAmount: 974.25,
    notes: 'Gate code changes with the season, call before the first load.',
    photos: [],
    blocked: 'Gate code missing for this morning',
    blockedAt: now - 25 * 60 * 1000,
    createdAt: now - 3 * DAY_MS,
  },
  {
    id: 'job-2',
    customerId: 'cust-9',
    category: 'MATERIAL_DELIVERY',
    status: 'SCHEDULED',
    date: offset(0),
    time: '11:00',
    allDay: false,
    address: 'Industrial Boulevard yard, Kaufman',
    description: 'Straight material order, no quote needed',
    agreedAmount: 1240,
    notes: '',
    photos: [],
    createdAt: now - 2 * DAY_MS,
  },
  {
    id: 'job-3',
    customerId: 'cust-10',
    category: 'POND',
    status: 'IN_PROGRESS',
    date: offset(0),
    time: undefined,
    allDay: true,
    address: 'County Road 4088, Kaufman',
    description: 'Pond dig, second day on site',
    agreedAmount: 8400,
    notes: 'Day two. Spoil pile goes on the north side.',
    photos: [],
    createdAt: now - 9 * DAY_MS,
  },

  /* ----------------------------------------------------------- upcoming */
  {
    id: 'job-4',
    customerId: 'cust-9',
    category: 'DRIVEWAY',
    status: 'SCHEDULED',
    date: offset(3),
    time: '08:00',
    allDay: false,
    address: 'Industrial Boulevard yard, Kaufman',
    description: 'Rebuild the yard entrance',
    agreedAmount: 3150,
    notes: '',
    photos: [],
    createdAt: now - 4 * DAY_MS,
  },
  {
    id: 'job-5',
    customerId: 'cust-1',
    category: 'MATERIAL_DELIVERY',
    status: 'SCHEDULED',
    date: offset(4),
    time: '09:00',
    allDay: false,
    address: 'County Road 4021, Kaufman',
    description: 'Two more loads for the back pens',
    agreedAmount: 974.25,
    notes: '',
    photos: [],
    changeRequested: true,
    createdAt: now - 5 * DAY_MS,
  },
  {
    id: 'job-6',
    customerId: 'cust-12',
    category: 'DIRT_GRADING',
    status: 'SCHEDULED',
    date: offset(7),
    time: undefined,
    allDay: true,
    address: 'FM 1388, Kaufman',
    description: 'Level the pasture road and shape the ditches',
    agreedAmount: 5600,
    notes: '',
    photos: [],
    createdAt: now - 6 * DAY_MS,
  },
  {
    id: 'job-7',
    customerId: 'cust-11',
    category: 'MATERIAL_DELIVERY',
    status: 'SCHEDULED',
    date: offset(9),
    time: '13:30',
    allDay: false,
    address: '812 County Road 143, Kaufman',
    description: 'One load of decomposed granite',
    agreedAmount: 1420,
    notes: '',
    photos: [],
    createdAt: now - DAY_MS,
  },
  {
    id: 'job-8',
    customerId: 'cust-10',
    category: 'DIRT_GRADING',
    status: 'SCHEDULED',
    date: offset(12),
    time: '08:00',
    allDay: false,
    address: 'County Road 4088, Kaufman',
    description: 'Shape the spoil pile and seed it',
    agreedAmount: 1800,
    notes: '',
    photos: [],
    createdAt: now - 2 * DAY_MS,
  },

  /* --------------------------------------------------------------- past */
  {
    id: 'job-9',
    customerId: 'cust-11',
    category: 'DRIVEWAY',
    status: 'COMPLETED',
    date: offset(-2),
    time: '08:00',
    allDay: false,
    address: '812 County Road 143, Kaufman',
    description: 'Driveway base and topping',
    agreedAmount: 4180,
    notes: '',
    photos: [],
    createdAt: now - 12 * DAY_MS,
    completedAt: now - 2 * DAY_MS,
  },
  {
    id: 'job-10',
    customerId: 'cust-7',
    category: 'MATERIAL_DELIVERY',
    status: 'CANCELLED',
    date: offset(-3),
    time: '10:00',
    allDay: false,
    address: 'County Road 4021, Kaufman',
    description: 'Fill material for the low area',
    agreedAmount: 1100,
    notes: '',
    photos: [],
    createdAt: now - 8 * DAY_MS,
    cancelledAt: now - 4 * DAY_MS,
    cancelReason: 'Customer pushed it to next month',
  },
  {
    id: 'job-11',
    customerId: 'cust-2',
    category: 'DIRT_GRADING',
    status: 'COMPLETED',
    date: offset(-6),
    time: '07:30',
    allDay: false,
    address: 'Private road off FM 987',
    description: 'Cut and shape the equipment pad',
    agreedAmount: 1150,
    notes: 'Invoice 1042 is still open on this one.',
    photos: [],
    createdAt: now - 20 * DAY_MS,
    completedAt: now - 6 * DAY_MS,
  },
  {
    id: 'job-12',
    customerId: 'cust-1',
    category: 'MATERIAL_DELIVERY',
    status: 'COMPLETED',
    date: offset(-9),
    time: '07:30',
    allDay: false,
    address: 'County Road 4021, Kaufman',
    description: 'Three loads of native gravel',
    agreedAmount: 3182,
    notes: '',
    photos: [],
    createdAt: now - 18 * DAY_MS,
    completedAt: now - 9 * DAY_MS,
  },
  {
    id: 'job-13',
    customerId: 'cust-12',
    category: 'LIGHT_CLEARING',
    status: 'COMPLETED',
    date: offset(-13),
    time: undefined,
    allDay: true,
    address: 'FM 1388, Kaufman',
    description: 'Brush and small trees along the fence line',
    agreedAmount: 2900,
    notes: '',
    photos: [],
    createdAt: now - 26 * DAY_MS,
    completedAt: now - 13 * DAY_MS,
  },
  {
    id: 'job-14',
    customerId: 'cust-4',
    category: 'MATERIAL_DELIVERY',
    status: 'COMPLETED',
    date: offset(-16),
    time: '06:30',
    allDay: false,
    address: 'Highway 175 frontage, Kaufman',
    description: 'Base material for the side lot',
    agreedAmount: 1690,
    notes: '',
    photos: [],
    createdAt: now - 30 * DAY_MS,
    completedAt: now - 16 * DAY_MS,
  },

  /* ------------------------------------------------ last month, completed */
  {
    id: 'job-18',
    customerId: 'cust-4',
    category: 'MATERIAL_DELIVERY',
    status: 'COMPLETED',
    date: offset(-52),
    time: '07:00',
    allDay: false,
    address: 'Highway 175 frontage, Kaufman',
    description: 'Yard rock for the back lot',
    agreedAmount: 2140,
    notes: '',
    photos: [],
    createdAt: now - 60 * DAY_MS,
    completedAt: now - 52 * DAY_MS,
  },
  {
    id: 'job-19',
    customerId: 'cust-12',
    category: 'DIRT_GRADING',
    status: 'COMPLETED',
    date: offset(-40),
    time: undefined,
    allDay: true,
    address: 'FM 1388, Kaufman',
    description: 'Cut the drainage swale behind the pens',
    agreedAmount: 3480,
    notes: '',
    photos: [],
    createdAt: now - 48 * DAY_MS,
    completedAt: now - 40 * DAY_MS,
  },

  /* ------------------------------------- older history, carries the photos */
  {
    id: 'job-15',
    customerId: 'cust-5',
    category: 'MATERIAL_DELIVERY',
    status: 'COMPLETED',
    date: offset(-38),
    time: '09:00',
    allDay: false,
    address: 'County Road 317, Kaufman',
    description: 'Driveway apron repair',
    agreedAmount: 640,
    notes: '',
    photos: ['/photos/job-3.jpg'],
    createdAt: now - 44 * DAY_MS,
    completedAt: now - 38 * DAY_MS,
  },
  {
    id: 'job-16',
    customerId: 'cust-1',
    category: 'DIRT_GRADING',
    status: 'COMPLETED',
    date: offset(-120),
    time: '07:00',
    allDay: false,
    address: 'County Road 4021, Kaufman',
    description: 'Pad build behind the barn',
    agreedAmount: 5240,
    notes: '',
    photos: ['/photos/job-4.jpg', '/photos/job-5.jpg'],
    createdAt: now - 130 * DAY_MS,
    completedAt: now - 120 * DAY_MS,
  },
  {
    id: 'job-17',
    customerId: 'cust-5',
    category: 'DRIVEWAY',
    status: 'COMPLETED',
    date: offset(-292),
    time: '07:30',
    allDay: false,
    address: 'County Road 317, Kaufman',
    description: 'Back road base, 3 loads',
    agreedAmount: 3669.68,
    notes: '',
    photos: ['/photos/job-1.jpg', '/photos/job-2.jpg'],
    createdAt: now - 300 * DAY_MS,
    completedAt: now - 292 * DAY_MS,
  },
]
