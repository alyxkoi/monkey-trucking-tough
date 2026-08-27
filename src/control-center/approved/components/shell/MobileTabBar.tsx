import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/control-center/approved/lib/cn'
import { useAppState } from '@/control-center/approved/state/AppState'
import { SECTIONS, sectionForPath } from './nav'
import { preloadMainAdminRoute, type MainAdminSectionKey } from '@/control-center/adminRouteLoaders'

/** 64px of bar. The pinned total bar and the New action are offset against this. */
const TAB_CLASS =
  'relative flex h-16 shrink-0 flex-col items-center justify-center gap-1 font-label font-semibold uppercase transition-colors'

/** How wide the fade at each end can grow, in pixels. */
const FADE = 34

/**
 * Responsive navigation.
 *
 * All seven sections are reachable in one tap at every width. There is no More
 * menu, because Tickets, Customers and Settings are real destinations and a
 * narrow screen is not a reason to bury them.
 *
 * Tablet lays all seven out evenly across the width. Phone puts the same seven on
 * a horizontally scrollable rail at a comfortable size rather than shrinking them
 * until the labels stop being readable. The rail's ends are masked rather than
 * cut, and the mask width tracks the scroll position, so the fade grows in as you
 * move off an end and is gone by the time you reach the other one.
 */
export function MobileTabBar() {
  const { pathname } = useLocation()
  const { setNewSheetOpen, pinnedBarActive } = useAppState()
  const current = sectionForPath(pathname)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)
  const [fade, setFade] = useState({ left: 0, right: 0 })

  const measure = useCallback(() => {
    const box = scrollerRef.current
    if (!box) return
    const max = box.scrollWidth - box.clientWidth
    if (max <= 1) {
      setFade({ left: 0, right: 0 })
      return
    }
    setFade({
      left: Math.max(0, Math.min(FADE, box.scrollLeft)),
      right: Math.max(0, Math.min(FADE, max - box.scrollLeft)),
    })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // Bring the current section into view whenever navigation changes. The scroll
  // is set on the rail itself, never through scrollIntoView, so the page behind
  // it is never moved vertically as a side effect.
  useLayoutEffect(() => {
    const box = scrollerRef.current
    const item = activeRef.current
    if (!box || !item) return
    const target = item.offsetLeft - (box.clientWidth - item.offsetWidth) / 2
    box.scrollTo({
      left: Math.max(0, Math.min(target, box.scrollWidth - box.clientWidth)),
      behavior: 'smooth',
    })
    const id = window.setTimeout(measure, 320)
    return () => window.clearTimeout(id)
  }, [measure, pathname])

  const maskImage =
    fade.left === 0 && fade.right === 0
      ? undefined
      : `linear-gradient(90deg, transparent 0px, #000 ${fade.left}px, #000 calc(100% - ${fade.right}px), transparent 100%)`

  return (
    <>
      {!pinnedBarActive && (
        <button
          type="button"
          onClick={() => setNewSheetOpen(true)}
          aria-label="New"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
          className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-mt-red text-canvas shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-colors active:bg-mt-deep lg:hidden"
        >
          <Plus className="h-7 w-7" strokeWidth={2.6} />
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#121216]/95 pb-safe backdrop-blur-xl lg:hidden">
        {/* Tablet, 768px and up: all seven share the width evenly. */}
        <div className="hidden md:grid md:grid-cols-7">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.key}
              to={section.to}
              onMouseEnter={() => void preloadMainAdminRoute(section.key as MainAdminSectionKey)}
              onFocus={() => void preloadMainAdminRoute(section.key as MainAdminSectionKey)}
              className={cn(
                TAB_CLASS,
                'px-1 text-[11px] tracking-[0.06em]',
                current?.key === section.key ? 'text-ice' : 'text-cc-muted',
              )}
            >
              {current?.key === section.key && (
                <span className="absolute top-0 h-[3px] w-9 rounded-b bg-ice" />
              )}
              <section.icon className="h-[21px] w-[21px]" strokeWidth={2} />
              <span className="max-w-full truncate">{section.tabLabel}</span>
            </NavLink>
          ))}
        </div>

        {/* Phone: the same seven on a swipeable rail. */}
        <div
          ref={scrollerRef}
          onScroll={measure}
          style={{ WebkitMaskImage: maskImage, maskImage }}
          className="no-scrollbar flex overflow-x-auto overscroll-x-contain md:hidden"
        >
          {SECTIONS.map((section) => {
            const isActive = current?.key === section.key
            return (
              <NavLink
                key={section.key}
                to={section.to}
                ref={isActive ? activeRef : undefined}
                onMouseEnter={() => void preloadMainAdminRoute(section.key as MainAdminSectionKey)}
                onFocus={() => void preloadMainAdminRoute(section.key as MainAdminSectionKey)}
                className={cn(
                  TAB_CLASS,
                  'min-w-[84px] flex-1 px-2 text-[11px] tracking-[0.07em]',
                  isActive ? 'text-ice' : 'text-cc-muted',
                )}
              >
                {isActive && (
                  <span className="absolute top-0 h-[3px] w-9 rounded-b bg-ice" />
                )}
                <section.icon className="h-[22px] w-[22px]" strokeWidth={2} />
                <span className="whitespace-nowrap">{section.tabLabel}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}
