import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppState } from '@/control-center/approved/state/AppState'
import { ScheduleJobSheet } from '@/control-center/approved/components/jobs/ScheduleJobSheet'
import { MobileTabBar } from './MobileTabBar'
import { NewActionSheet } from './NewActionSheet'
import { NewLeadSheet } from './NewLeadSheet'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'

export function AppShell() {
  const { pathname } = useLocation()
  const { newJobSheetOpen, setNewJobSheetOpen } = useAppState()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    // The background lives on the body so the gradient and the dotted texture stay
    // fixed while content scrolls. The shell itself stays transparent.
    <div className="flex min-h-screen">
      <SideNav />

      <div className="flex min-w-0 flex-1 flex-col">
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
            {/* Keyed on the route so the entrance plays once per navigation. */}
            <div key={pathname} className="animate-fade">
              <Outlet />
            </div>
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
