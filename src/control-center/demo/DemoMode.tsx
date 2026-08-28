/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Database, RotateCcw, X } from 'lucide-react'
import type { ControlData } from '@/control-center/data'

const STORAGE_KEY = 'mt_phase06_demo_enabled'

export const DEMO_CAPABLE = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'

type DemoModeValue = {
  capable: boolean
  enabled: boolean
  data: ControlData | null
  enable: () => void
  reset: () => void
  disable: () => void
  updateData: (updater: (current: ControlData) => ControlData) => void
}

const DemoModeContext = createContext<DemoModeValue | null>(null)

function readEnabled() {
  if (!DEMO_CAPABLE || typeof window === 'undefined') return false
  return window.sessionStorage.getItem(STORAGE_KEY) === 'true'
}

function DemoControls({ value }: { value: DemoModeValue }) {
  const [open, setOpen] = useState(false)
  if (!value.capable) return null

  if (!value.enabled) {
    return (
      <button
        type="button"
        onClick={value.enable}
        className="fixed bottom-4 right-4 z-[100] flex min-h-11 items-center gap-2 rounded-full border border-ice/30 bg-[#111116]/90 px-4 font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-ice shadow-lifted backdrop-blur-xl transition-colors hover:border-ice/60 hover:bg-[#181820]"
      >
        <Database className="h-4 w-4" strokeWidth={2.2} />
        Enable demo data
      </button>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open QA fixture controls"
        title="QA fixture controls"
        className="qa-fixture-control fixed bottom-24 left-0 z-[100] flex h-11 w-5 items-center justify-center rounded-r-xl border border-ice/30 bg-[#111116]/90 text-ice opacity-60 shadow-lifted backdrop-blur-xl transition-[border-color,opacity] hover:border-ice/60 hover:opacity-100 lg:bottom-4 lg:left-[280px] lg:w-11 lg:rounded-full"
      >
        <Database className="h-4 w-4" strokeWidth={2.3} />
      </button>
    )
  }

  return (
    <aside className="qa-fixture-control fixed bottom-24 left-3 z-[100] w-[min(310px,calc(100vw-24px))] rounded-2xl border border-ice/30 bg-[#111116]/94 p-3 shadow-lifted backdrop-blur-xl lg:bottom-4 lg:left-[280px]">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ice text-canvas">
          <Database className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-label text-[12px] font-semibold uppercase tracking-[0.14em] text-ice">
            QA fixture data
          </div>
          <div className="mt-0.5 text-[12px] text-cc-muted">In memory only. Supabase writes are off.</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse QA fixture controls"
          title="Collapse QA fixture controls"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-cc-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={value.reset}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-raised px-3 font-label text-[12px] font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:border-ice/35 hover:text-ice"
        >
          <RotateCcw className="h-4 w-4" />
          Reset demo
        </button>
        <button
          type="button"
          onClick={value.disable}
          className="min-h-11 rounded-xl border border-line bg-raised px-3 font-label text-[12px] font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:border-mt-red/40 hover:text-mt-red"
        >
          Use real data
        </button>
      </div>
    </aside>
  )
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(readEnabled)
  const [data, setData] = useState<ControlData | null>(null)
  const fixtureReference = useRef(new Date())

  const loadFixture = useCallback(async () => {
    if (!DEMO_CAPABLE) return
    const { createQaFixtureData } = await import('./qaFixtures')
    setData(createQaFixtureData(fixtureReference.current))
  }, [])

  useEffect(() => {
    if (DEMO_CAPABLE && enabled && !data) void loadFixture()
  }, [data, enabled, loadFixture])

  const enable = useCallback(() => {
    if (!DEMO_CAPABLE) return
    window.sessionStorage.setItem(STORAGE_KEY, 'true')
    setEnabled(true)
    void loadFixture().then(() => {
      if (!window.location.pathname.startsWith('/admin')) window.location.assign('/admin')
    })
  }, [loadFixture])

  const reset = useCallback(() => { void loadFixture() }, [loadFixture])

  const disable = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY)
    setEnabled(false)
    setData(null)
  }, [])

  const updateData = useCallback((updater: (current: ControlData) => ControlData) => {
    if (!DEMO_CAPABLE) return
    setData((current) => current ? updater(current) : current)
  }, [])

  const value = useMemo<DemoModeValue>(() => ({
    capable: DEMO_CAPABLE,
    enabled: DEMO_CAPABLE && enabled,
    data,
    enable,
    reset,
    disable,
    updateData,
  }), [data, disable, enable, enabled, reset, updateData])

  return (
    <DemoModeContext.Provider value={value}>
      {children}
      <DemoControls value={value} />
    </DemoModeContext.Provider>
  )
}

export function useDemoMode() {
  const value = useContext(DemoModeContext)
  if (!value) throw new Error('useDemoMode must be used inside DemoModeProvider')
  return value
}
