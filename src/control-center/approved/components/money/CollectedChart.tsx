import { useEffect, useId, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/control-center/approved/lib/cn'
import { usd } from '@/control-center/approved/lib/format'
import type { CollectedPoint } from '@/control-center/approved/state/moneyData'

const W = 600
const H = 200
const TOP = 28
const BOTTOM = 12

type Pt = { x: number; y: number }

/**
 * Catmull-Rom through every day, converted to cubic beziers.
 *
 * The days themselves are still exactly where the data puts them. Only the path
 * between them is curved, so a single big day reads as a swell rather than a
 * spike. Control points are clamped inside the plot so a run of zero days either
 * side of a large one can never bow the curve below the baseline and invent money
 * that was never collected.
 */
function smoothPath(pts: Pt[], floor: number, ceiling: number, tension = 0.9): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`

  const clamp = (value: number) => Math.min(floor, Math.max(ceiling, value))
  let d = `M${pts[0].x},${pts[0].y}`

  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2

    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = clamp(p1.y + ((p2.y - p0.y) / 6) * tension)
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = clamp(p2.y - ((p3.y - p1.y) / 6) * tension)

    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }

  return d
}

/**
 * What came in, day by day.
 *
 * Daily amounts rather than a running total, so the shape shows when money
 * actually landed instead of a line that can only ever climb. The days add up to
 * the Collected figure above it.
 *
 * The curve is drawn in a stretched viewBox so it always fills the width. Every
 * round marker is drawn in HTML on top instead of inside that viewBox, because a
 * circle in a stretched viewBox comes out an ellipse. Tracking is one pointer
 * handler over the whole plot rather than a hit box per day, which is what stops
 * the readout flickering as the cursor crosses between days.
 */
export function CollectedChart({
  points,
  period,
  height = 'h-[180px] sm:h-[220px] lg:h-[260px]',
  labelInset = 'px-5 lg:px-7',
  className,
}: {
  points: CollectedPoint[]
  /** Changing this replays the draw in animation. */
  period: string
  height?: string
  /** Horizontal padding for the date labels when the plot itself is full bleed. */
  labelInset?: string
  className?: string
}) {
  const [selected, setSelected] = useState<number | null>(null)
  // Gradient ids must be unique, the chart can appear more than once on a screen.
  const uid = useId().replace(/:/g, '')

  // A new period is a new line, so any selection from the old one is dropped.
  useEffect(() => setSelected(null), [period])

  if (points.length === 0) return null

  const max = Math.max(...points.map((point) => point.dayValue), 1)
  const x = (index: number) =>
    points.length === 1 ? W / 2 : (index / (points.length - 1)) * W
  const y = (value: number) => H - BOTTOM - (value / max) * (H - TOP - BOTTOM)

  const plotted: Pt[] = points.map((point, index) => ({
    x: x(index),
    y: y(point.dayValue),
  }))
  const line = smoothPath(plotted, H - BOTTOM, TOP)
  const area = `${line} L${W},${H} L0,${H} Z`

  // Percentages, so the HTML markers land on the curve at any width.
  const leftPct = (index: number) => (x(index) / W) * 100
  const topPct = (value: number) => (y(value) / H) * 100

  // With nothing selected, mark the last day money actually came in.
  const lastWithMoney = points.reduce(
    (found, point, index) => (point.dayValue > 0 ? index : found),
    -1,
  )
  const activeIndex = selected ?? lastWithMoney
  const active = activeIndex >= 0 ? points[activeIndex] : null

  const track = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = (event.clientX - rect.left) / rect.width
    const index = Math.round(ratio * (points.length - 1))
    setSelected(Math.min(points.length - 1, Math.max(0, index)))
  }

  return (
    <div className={cn('relative', className)}>
      {/* Callout sits in HTML so it keeps the product typography. */}
      {active && (
        <div
          className="pointer-events-none absolute top-0 z-20 -translate-x-1/2"
          style={{ left: `clamp(64px, ${leftPct(activeIndex)}%, calc(100% - 64px))` }}
        >
          <div className="rounded-xl border border-white/10 bg-[#1b1b20] px-3.5 py-2 text-center shadow-lifted">
            <div className="font-label text-[11px] font-semibold uppercase tracking-[0.14em] text-cc-muted">
              {active.label}
            </div>
            {active.dayValue > 0 ? (
              <div className="num-safe font-display display-tight tnum text-[21px] text-mt-red">
                {usd(active.dayValue)}
              </div>
            ) : (
              <div className="font-label text-[13px] uppercase tracking-[0.1em] text-idle">
                Nothing in
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={cn('relative mt-[62px]', height)}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={() => setSelected(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-full w-full text-mt-red"
          role="img"
          aria-label={`Collected per day, biggest day ${usd(max)}`}
        >
          <defs>
            {/*
              No outline. The shape itself is the chart, so the fill carries the
              silhouette: dense where the curve is, dissolving into the hero
              before it reaches the bottom of the plate.
            */}
            <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.46" />
              <stop offset="34%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="72%" stopColor="currentColor" stopOpacity="0.06" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            key={`area-${period}`}
            d={area}
            fill={`url(#fill-${uid})`}
            className="chart-fade"
          />
        </svg>

        {/* Every day money actually landed gets a quiet mark on the curve. */}
        {points.map((point, index) =>
          point.dayValue > 0 && index !== activeIndex ? (
            <span
              key={point.at}
              className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mt-red/80"
              style={{ left: `${leftPct(index)}%`, top: `${topPct(point.dayValue)}%` }}
            />
          ) : null,
        )}

        {active && (
          <>
            <span
              className="pointer-events-none absolute w-px bg-mt-red/30"
              style={{
                left: `${leftPct(activeIndex)}%`,
                top: `${topPct(active.dayValue)}%`,
                bottom: `${(BOTTOM / H) * 100}%`,
              }}
            />
            <span
              className="pointer-events-none absolute h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mt-red/15"
              style={{ left: `${leftPct(activeIndex)}%`, top: `${topPct(active.dayValue)}%` }}
            />
            <span
              className="pointer-events-none absolute h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-mt-red bg-canvas"
              style={{ left: `${leftPct(activeIndex)}%`, top: `${topPct(active.dayValue)}%` }}
            />
          </>
        )}
      </div>

      <div
        className={cn(
          'mt-2.5 flex items-center justify-between font-label text-[11px] uppercase tracking-[0.14em] text-idle',
          labelInset,
        )}
      >
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}
