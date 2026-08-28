import { Outlet, useLocation } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { useAppState } from '@/control-center/approved/state/AppState'
import { preloadMainAdminRoutes } from '@/control-center/adminRouteLoaders'
import { ScheduleJobSheet } from '@/control-center/approved/components/jobs/ScheduleJobSheet'
import { MobileTabBar } from './MobileTabBar'
import { NewActionSheet } from './NewActionSheet'
import { NewLeadSheet } from './NewLeadSheet'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

function AdminRouteFallback() {
  return (
    <div className="admin-route-skeleton" role="status" aria-label="Loading section">
      <div className="h-7 w-40 rounded-lg bg-white/[0.08]" />
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-44 rounded-panel border border-white/[0.08] bg-white/[0.045]" />
        <div className="h-44 rounded-panel border border-white/[0.08] bg-white/[0.045]" />
      </div>
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const { newJobSheetOpen, setNewJobSheetOpen } = useAppState()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    const idleWindow = window as IdleWindow
    const preload = () => { void preloadMainAdminRoutes() }
    const idleHandle = idleWindow.requestIdleCallback?.(preload, { timeout: 1400 })
    const timeoutHandle = idleHandle === undefined ? window.setTimeout(preload, 250) : undefined

    return () => {
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle)
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle)
    }
  }, [])

  return (
    // The authenticated root owns one fixed image/overlay layer. The shell stays
    // transparent so that atmosphere remains stable while content scrolls.
    <div className="flex min-h-screen">
      <SideNav />

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[280px]">
        <TopBar />
        {/*
          Clears the 64px navigation, the safe area, and the floating New action,
          which sits 80px up and is 56px tall. Anything less and the last control
          on a screen ends up under the button.
        */}
        <main className="flex-1 pb-36 lg:pb-14">
          {/*
            Wide monitors get used. The shell runs to 1760px and the gutters open
            up past that, instead of leaving important cards in a narrow column.
          */}
          <div className="mx-auto w-full max-w-shell px-4 py-5 sm:px-6 lg:px-8 lg:py-8 2xl:px-12">
            <Suspense fallback={<AdminRouteFallback />}>
              {/* Keyed on the route so the entrance plays once per navigation. */}
              <div key={pathname} className="animate-fade">
                <Outlet />
              </div>
            </Suspense>
          </div>
        </main>
      </div>

      <MobileTabBar />
      <NewActionSheet />
      <NewLeadSheet />
      {/* Direct job creation, reachable from + New anywhere in the product. */}
      <ScheduleJobSheet open={newJobSheetOpen} onClose={() => setNewJobSheetOpen(false)} />
    </div>
  )
}
