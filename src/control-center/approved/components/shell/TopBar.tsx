import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { SyncChip } from '@/control-center/approved/components/ui/SyncState'
import { cn } from '@/control-center/approved/lib/cn'
import { dateParts, greeting } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { CURRENT_USER } from '@/control-center/approved/state/moneyData'
import { sectionForPath } from './nav'
import { useAuth } from '@/hooks/useAuth'
import monkeyTruckingLogo from '@/assets/monkey-trucking-logo.webp'

/**
 * Hysteresis. Two thresholds, never one.
 *
 * A single threshold means the pixel that turns the surface on is the same pixel
 * that turns it off, so a trackpad tremor, a momentum overshoot or a scroll
 * anchoring correction flips the state over and over. Entering costs 28px of
 * real scrolling; leaving needs the page back within 8px of the top. Nothing in
 * between changes anything.
 */
const ENTER = 28
const EXIT = 8

/**
 * The header materialises rather than sitting there.
 *
 * At the top of a page there is no bar at all: the date, the title, the sync
 * state and New float straight on the page atmosphere. Once the page has clearly
 * moved, the same block gains a frosted plate inset from the page edges.
 *
 * The geometry is fixed. The header reserves the same height, the plate keeps the
 * same size and the type keeps the same size in both states, so crossing the
 * threshold cannot change document height, cannot move the content underneath and
 * therefore cannot feed a scroll correction back across the threshold. Only paint
 * changes: background, border, shadow and blur.
 */
export function TopBar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const { sync, queued, lastSyncAt, cycleSync, setNewSheetOpen } = useAppState()
  const section = sectionForPath(pathname)
  const today = dateParts()
  const [floating, setFloating] = useState(false)

  // Mirrors the state so the scroll handler can read it without re-subscribing,
  // and so React only re-renders when the boolean actually flips.
  const floatingRef = useRef(false)

  useEffect(() => {
    let frame = 0

    const read = () => {
      frame = 0
      const y = window.scrollY
      if (!floatingRef.current && y > ENTER) {
        floatingRef.current = true
        setFloating(true)
      } else if (floatingRef.current && y < EXIT) {
        floatingRef.current = false
        setFloating(false)
      }
    }

    // One read per animation frame, no matter how many scroll events arrive.
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read)
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  // The Overview is the one place the header speaks to the person using it. Every
  // other section keeps its own name, because that is what tells you where you are.
  const isOverview = pathname === '/admin'
  const title = isOverview ? null : (section?.label ?? 'Monkey Trucking')
  const userName = String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || CURRENT_USER)
    .trim()
    .split(/\s+/)[0]

  return (
    <header
      // The reserved height never changes, and scroll anchoring is switched off
      // here so nothing in this subtree can ever nudge the scroll position.
      style={{ overflowAnchor: 'none' }}
      className="pointer-events-none sticky top-0 z-30 h-20 sm:h-[88px] lg:h-24"
    >
      <div className="mx-auto flex h-full w-full max-w-shell items-center px-3 sm:px-5 lg:px-7 2xl:px-11">
        <div
          // Reflects the committed state rather than the in flight transition,
          // which is what makes the threshold behaviour testable.
          data-floating={floating}
          className={cn(
            'pointer-events-auto flex h-16 w-full items-center justify-between gap-2 rounded-2xl border px-3 transition-[background-color,border-color,box-shadow] duration-300 ease-out sm:h-[72px] sm:gap-4 sm:px-4 lg:h-20 lg:px-5',
            floating
              ? 'border-white/10 bg-[#101014]/80 shadow-lifted backdrop-blur-xl'
              : 'border-transparent bg-transparent',
          )}
        >
          {/*
            A thin red rule ties the date to the title so they read as one block
            rather than two stacked lines, and gives the header its start point.
          */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img
              src={monkeyTruckingLogo}
              alt="Monkey Trucking"
              width={132}
              height={66}
              decoding="async"
              className="h-auto w-[52px] shrink-0 object-contain sm:w-[68px] lg:hidden"
            />
            <div className="flex min-w-0 items-stretch gap-2 sm:gap-3">
              <span className="w-[3px] shrink-0 rounded-full bg-mt-red" />
              <div className="min-w-0">
                <div className="font-label text-[11px] font-semibold uppercase leading-none tracking-[0.26em] text-cc-muted sm:text-[12px]">
                  {today.full}
                </div>
                <h1 className="display-racing -ml-1 mt-1 truncate pl-1 font-display display-tight text-[19px] min-[410px]:text-[22px] sm:text-[28px] lg:text-[32px]">
                  {isOverview ? (
                    <span className="animate-greeting">
                      {greeting()}, <span className="text-mt-red">{userName}</span>
                    </span>
                  ) : (
                    title
                  )}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <SyncChip
              status={sync}
              queued={queued}
              lastSyncAt={lastSyncAt}
              onClick={cycleSync}
            />
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
