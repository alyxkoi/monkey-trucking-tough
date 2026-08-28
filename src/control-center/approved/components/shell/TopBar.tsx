import { Plus } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { SyncChip } from '@/control-center/approved/components/ui/SyncState'
import { dateParts, greeting } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { CURRENT_USER } from '@/control-center/approved/state/moneyData'
import { sectionForPath } from './nav'
import { useAuth } from '@/hooks/useAuth'
import { ProfileAvatarControl } from './ProfileAvatar'

/**
 * The page header stays in normal document flow. The desktop brand remains in
 * the sidebar; tablet and phone use the recovered width for the date and title.
 */
export function TopBar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const { sync, queued, lastSyncAt, cycleSync, setNewSheetOpen } = useAppState()
  const section = sectionForPath(pathname)
  const today = dateParts()

  // The Overview is the one place the header speaks to the person using it. Every
  // other section keeps its own name, because that is what tells you where you are.
  const isOverview = pathname === '/admin'
  const title = isOverview ? null : (section?.label ?? 'Monkey Trucking')
  const userName = String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || CURRENT_USER)
    .trim()
    .split(/\s+/)[0]

  return (
    <header className="pointer-events-none relative z-30 h-20 sm:h-[88px] lg:h-24">
      <div className="mx-auto flex h-full w-full max-w-shell items-center px-3 sm:px-5 lg:px-7 2xl:px-11">
        <div className="pointer-events-auto flex h-16 w-full items-center justify-between gap-2 rounded-2xl border border-transparent bg-transparent px-3 sm:h-[72px] sm:gap-4 sm:px-4 lg:h-20 lg:px-5">
          <div className="flex min-w-0 items-center">
            <div className="min-w-0">
              <div className="platinum-muted font-label text-[11px] font-bold uppercase leading-none tracking-[0.2em] sm:text-[12px]">
                {today.full}
              </div>
              <h1
                className={`platinum-title mt-1.5 font-display display-tight sm:text-[34px] lg:text-[40px] ${
                  isOverview
                    ? 'whitespace-normal text-[21px] min-[410px]:text-[23px]'
                    : 'truncate text-[24px] min-[410px]:text-[27px]'
                }`}
              >
                {isOverview ? (
                  <span className="animate-greeting">
                    {greeting()}, <span className="block text-mt-red sm:inline">{userName}</span>
                  </span>
                ) : (
                  title
                )}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <SyncChip
              status={sync}
              queued={queued}
              lastSyncAt={lastSyncAt}
              onClick={cycleSync}
            />
            <ProfileAvatarControl className="lg:hidden" compact />
            <PrimaryButton
              className="hidden lg:inline-flex"
              onClick={() => setNewSheetOpen(true)}
              icon={<Plus className="h-5 w-5" strokeWidth={2.6} />}
            >
              New
            </PrimaryButton>
          </div>
        </div>
      </div>
    </header>
  )
}
