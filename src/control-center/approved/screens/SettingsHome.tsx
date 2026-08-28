import {
  Banknote,
  Building2,
  ChevronRight,
  Link2,
  Printer,
  Radio,
  Users,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { useAppState } from '@/control-center/approved/state/AppState'
import { deriveSettingsReadiness, readinessTone, type ReadinessKey } from '@/control-center/readiness'

type Category = {
  key: string
  label: string
  line: string
  to: string
  icon: LucideIcon
  iconClass: string
}

/** Seven categories, each opening its own dedicated full screen. */
const CATEGORIES: Category[] = [
  {
    key: 'business',
    label: 'Business',
    line: 'Company details, tax, due days, payment methods, logo',
    to: '/admin/settings/business',
    icon: Building2,
    iconClass: 'bg-[#b98a43] text-[#120d06]',
  },
  {
    key: 'materials',
    label: 'Materials & Delivery',
    line: 'The one price list quotes and tickets both read',
    to: '/admin/settings/materials',
    icon: Banknote,
    iconClass: 'bg-[#e1472f] text-white',
  },
  {
    key: 'workers',
    label: 'Workers',
    line: 'The crew, pay type and rates. No logins',
    to: '/admin/settings/workers',
    icon: Users,
    iconClass: 'bg-[#d79a24] text-[#160f05]',
  },
  {
    key: 'communication',
    label: 'Communication & AI',
    line: 'Business number, SMS, calling, AI and every automation',
    to: '/admin/settings/communication',
    icon: Radio,
    iconClass: 'bg-ice text-white',
  },
  {
    key: 'tracking',
    label: 'Tracking Links',
    line: 'Where leads come from, without an attribution platform',
    to: '/admin/settings/tracking',
    icon: Link2,
    iconClass: 'bg-[#685d7d] text-white',
  },
  {
    key: 'users',
    label: 'Users & Access',
    line: 'Salvador and the Alyxlab admin',
    to: '/admin/settings/users',
    icon: UserCog,
    iconClass: 'bg-[#8a929e] text-[#101216]',
  },
  {
    key: 'printing',
    label: 'Printing & System',
    line: 'Printer, test print, database, offline queue, last sync',
    to: '/admin/settings/printing',
    icon: Printer,
    iconClass: 'bg-[#46464f] text-white',
  },
]

export function SettingsHome() {
  const navigate = useNavigate()
  const { sourceData } = useAppState()
  const readiness = deriveSettingsReadiness(sourceData ?? null)
  const counts = Object.values(readiness.categories).reduce<Record<string, number>>((current, entry) => {
    current[entry.status] = (current[entry.status] ?? 0) + 1
    return current
  }, {})

  return (
    <div className="space-y-5">
      <Panel title="System readiness">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(['READY', 'NEEDS_INFO', 'WAITING', 'TEST_REQUIRED', 'ERROR'] as const)
            .filter((status) => counts[status])
            .map((status) => (
              <span key={status} className="font-label text-[13px] font-semibold uppercase tracking-[0.1em] text-cc-muted">
                <strong className="text-ink">{counts[status]}</strong>{' '}
                {status === 'NEEDS_INFO' ? 'need info' : status === 'TEST_REQUIRED' ? 'need testing' : status.toLowerCase()}
              </span>
            ))}
        </div>
      </Panel>

      <Panel padded={false} title="Settings">
        <div className="divide-y divide-line border-t border-line">
          {CATEGORIES.map((category) => {
            const state = readiness.categories[category.key as ReadinessKey]
            const active = state.status !== 'READY'
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => navigate(category.to)}
                className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-white/[0.07]"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-[0_12px_26px_-18px_rgba(0,0,0,0.95)] ${category.iconClass}`}>
                  <category.icon className="h-[21px] w-[21px]" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-label text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
                      {category.label}
                    </span>
                    {active && (
                      <StatusPill tone={readinessTone(state.status)} size="sm">
                        {state.label}
                      </StatusPill>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-cc-muted">{state.reason}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-idle" strokeWidth={2} />
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel padded={false} title="Remaining before final QA">
        <div className="divide-y divide-line border-t border-line">
          {readiness.blockers.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.to)}
              className="row-hover flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-white/[0.04]"
            >
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warn" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{item.label}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-cc-muted">
                  {item.detail}
                </span>
              </span>
            </button>
          ))}
          {readiness.blockers.length === 0 && (
            <div className="px-5 py-5 text-[15px] text-ok">No configuration blockers remain. Ready for final QA.</div>
          )}
        </div>
        <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-cc-muted">
          Computed from the same managed configuration shown inside each Settings section.
        </p>
      </Panel>
    </div>
  )
}
