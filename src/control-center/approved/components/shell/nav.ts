import {
  Banknote,
  CalendarDays,
  Gauge,
  MessagesSquare,
  Settings2,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type Section = {
  key: string
  label: string
  /** Shorter label used by the mobile tab bar. */
  tabLabel: string
  to: string
  icon: LucideIcon
  /** True when the section owns one of the five mobile tabs. */
  mobileTab: boolean
  /** One line description used by placeholder destinations. */
  purpose: string
}

/** The seven main sections. This list is locked by the Master Context. */
export const SECTIONS: Section[] = [
  {
    key: 'overview',
    label: 'Overview',
    tabLabel: 'Overview',
    to: '/admin',
    icon: Gauge,
    mobileTab: true,
    purpose: 'What happened, what needs attention, what to do next.',
  },
  {
    key: 'leads',
    label: 'Leads & Quotes',
    tabLabel: 'Leads',
    to: '/admin/leads',
    icon: MessagesSquare,
    mobileTab: true,
    purpose: 'Every opportunity and every price that went out the door.',
  },
  {
    key: 'jobs',
    label: 'Jobs',
    tabLabel: 'Jobs',
    to: '/admin/jobs',
    icon: CalendarDays,
    mobileTab: true,
    purpose: 'The live work calendar and every scheduled job.',
  },
  {
    key: 'tickets',
    label: 'Tickets',
    tabLabel: 'Tickets',
    to: '/admin/tickets',
    icon: Ticket,
    mobileTab: false,
    purpose: 'Proof of the material and delivery that was provided.',
  },
  {
    key: 'customers',
    label: 'Customers',
    tabLabel: 'Customers',
    to: '/admin/customers',
    icon: Users,
    mobileTab: false,
    purpose: 'The permanent identity and the whole history behind it.',
  },
  {
    key: 'money',
    label: 'Money',
    tabLabel: 'Money',
    to: '/admin/money',
    icon: Banknote,
    mobileTab: true,
    purpose: 'Who owes us, what came in, what the workers were paid.',
  },
  {
    key: 'settings',
    label: 'Settings',
    tabLabel: 'Settings',
    to: '/admin/settings',
    icon: Settings2,
    mobileTab: false,
    purpose: 'Business, materials, workers, communication, and system controls.',
  },
]

export function sectionForPath(pathname: string): Section | undefined {
  if (pathname === '/admin') return SECTIONS[0]
  // Needs Attention is an Overview drill down.
  if (pathname.startsWith('/admin/attention')) return SECTIONS[0]
  // A quote lives under Leads & Quotes even though it has its own route.
  if (pathname.startsWith('/admin/quotes')) return SECTIONS[1]
  return SECTIONS.find(
    (section) => section.to !== '/admin' && pathname.startsWith(section.to),
  )
}
