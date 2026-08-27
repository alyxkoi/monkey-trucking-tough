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
import { PRELAUNCH_BLOCKERS } from '@/control-center/approved/state/settingsData'

type Category = {
  key: string
  label: string
  line: string
  to: string
  icon: LucideIcon
  needsSetup?: boolean
}

/** Seven categories, each opening its own dedicated full screen. */
const CATEGORIES: Category[] = [
  {
    key: 'business',
    label: 'Business',
    line: 'Company details, tax, due days, payment methods, logo',
    to: '/admin/settings/business',
    icon: Building2,
    needsSetup: true,
  },
  {
    key: 'materials',
    label: 'Materials & Delivery',
    line: 'The one price list quotes and tickets both read',
    to: '/admin/settings/materials',
    icon: Banknote,
  },
  {
    key: 'workers',
    label: 'Workers',
    line: 'The crew, pay type and rates. No logins',
    to: '/admin/settings/workers',
    icon: Users,
    needsSetup: true,
  },
  {
    key: 'communication',
    label: 'Communication & AI',
    line: 'Business number, SMS, calling, AI and every automation',
    to: '/admin/settings/communication',
    icon: Radio,
    needsSetup: true,
  },
  {
    key: 'tracking',
    label: 'Tracking Links',
    line: 'Where leads come from, without an attribution platform',
    to: '/admin/settings/tracking',
    icon: Link2,
  },
  {
    key: 'users',
    label: 'Users & Access',
    line: 'Salvador and the Alyxlab admin',
    to: '/admin/settings/users',
    icon: UserCog,
  },
  {
    key: 'printing',
    label: 'Printing & System',
    line: 'Printer, test print, database, offline queue, last sync',
    to: '/admin/settings/printing',
    icon: Printer,
    needsSetup: true,
  },
]

export function SettingsHome() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      <Panel padded={false} title="Settings">
        <div className="divide-y divide-line border-t border-line">
          {CATEGORIES.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => navigate(category.to)}
              className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-white/[0.07]"
            >
              {/*
                Settings stays a control panel rather than a dashboard, so the
                only colour in this list is the one that means something: amber
                on a category that is not finished yet.
              */}
              <span
                className={
                  category.needsSetup
                    ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-warn/30 bg-warn/[0.12] text-warn'
                    : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-idle'
                }
              >
                <category.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-label text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
                    {category.label}
                  </span>
                  {category.needsSetup && (
                    <StatusPill tone="warn" size="sm">
                      Setup required
                    </StatusPill>
                  )}
                </span>
                <span className="mt-0.5 block text-[14px] text-cc-muted">{category.line}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-idle" strokeWidth={2} />
            </button>
          ))}
        </div>
      </Panel>

      <Panel padded={false} title="Before launch">
        <div className="divide-y divide-line border-t border-line">
          {PRELAUNCH_BLOCKERS.map((item) => (
            <button
              key={item.id}
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
              <span className="shrink-0 font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                {item.where}
              </span>
            </button>
          ))}
        </div>
        <p className="border-t border-line px-5 py-3 text-[13px] leading-snug text-cc-muted">
          Internal only. None of this ever appears on a customer facing quote, invoice or
          message.
        </p>
      </Panel>
    </div>
  )
}
