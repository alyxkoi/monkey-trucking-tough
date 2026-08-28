import { LogOut } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/control-center/approved/lib/cn'
import { SECTIONS, sectionForPath } from './nav'
import { useAuth } from '@/hooks/useAuth'
import { useAdminAccess } from '@/hooks/admin/useAdminAccess'
import { useDemoMode } from '@/control-center/demo/DemoMode'
import { preloadMainAdminRoute, type MainAdminSectionKey } from '@/control-center/adminRouteLoaders'
import monkeyTruckingLogo from '@/assets/monkey-trucking-logo.webp'
import { ProfileAvatarControl } from './ProfileAvatar'

/**
 * Persistent desktop navigation.
 *
 * The rail stays detached and quiet. Active state lives inside the navigation
 * item itself, so the sidebar needs no decorative stripe on its outer edge.
 */
export function SideNav() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const demo = useDemoMode()
  const access = useAdminAccess(user?.id)
  const current = sectionForPath(pathname)
  const accountName = demo.enabled ? 'Salvador' : String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Account')

  return (
    <aside className="sidebar-frost hidden lg:fixed lg:bottom-4 lg:left-4 lg:top-4 lg:z-40 lg:flex lg:w-[248px] lg:flex-col lg:overflow-hidden lg:rounded-[24px] lg:border">
      <div className="border-b border-white/[0.07] px-6 py-5">
        <div className="min-w-0">
          <img
            src={monkeyTruckingLogo}
            alt="Monkey Trucking"
            width={132}
            height={66}
            decoding="async"
            className="h-auto w-[132px] max-w-full object-contain object-left"
          />
          <div className="mt-1.5 font-label text-[11px] font-semibold uppercase tracking-[0.24em] text-cc-muted">
            Control Center
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
        {SECTIONS.map((section) => {
          const isActive = current?.key === section.key
          return (
            <NavLink
              key={section.key}
              to={section.to}
              onMouseEnter={() => void preloadMainAdminRoute(section.key as MainAdminSectionKey)}
              onFocus={() => void preloadMainAdminRoute(section.key as MainAdminSectionKey)}
              className={cn(
                'group relative flex h-12 items-center gap-3 rounded-xl pl-4 pr-3 font-label text-[14px] font-semibold uppercase tracking-[0.08em] transition-[background-color,color,border-color] duration-150',
                isActive
                  ? 'border border-ice bg-ice text-white shadow-[0_12px_26px_-18px_rgba(85,0,213,0.95)]'
                  : 'border border-transparent text-cc-muted hover:bg-white/[0.05] hover:text-ink',
              )}
            >
              <section.icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  isActive ? 'text-white' : 'text-idle group-hover:text-ink',
                )}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span className="truncate">{section.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <ProfileAvatarControl />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-ink">{accountName}</div>
            <div className="font-label text-[11px] uppercase tracking-[0.16em] text-cc-muted">
              {demo.enabled || access.roles.includes('admin') ? 'Admin' : 'Staff'}
            </div>
          </div>
          {!demo.enabled && <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void signOut()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-cc-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
          >
            <LogOut className="h-4 w-4" strokeWidth={2.2} />
          </button>}
        </div>
      </div>
    </aside>
  )
}
