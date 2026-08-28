import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/control-center/approved/lib/cn'
import type { Priority, RecommendedAction } from '@/control-center/approved/state/attention'

/**
 * What travels with the click when Needs Attention opens a record.
 *
 * Carried in router state rather than stored anywhere, because it describes one
 * navigation, not a fact about the record. Opening the same job from the calendar
 * tomorrow has no reason to explain itself.
 */
export type AttentionEntry = {
  id: string
  priority: Priority
  title: string
  context: string
  recommend: RecommendedAction
}

/**
 * Reads the guided entry off the current navigation.
 *
 * `recommend` goes quiet as soon as Salvador touches the action, which is what
 * stops the pulse. It does not resolve the attention item: that only happens when
 * the underlying record actually changes and the derived queue stops producing
 * it. Calling a customer about a missing gate code does not mean the gate code
 * has been found.
 */
export function useAttentionEntry() {
  const location = useLocation()
  const entry = (location.state as { attention?: AttentionEntry } | null)?.attention ?? null
  const [acted, setActed] = useState(false)

  useEffect(() => setActed(false), [entry?.id])

  return {
    entry,
    /** The action to emphasise, or null once it has been used. */
    recommend: acted ? null : (entry?.recommend ?? null),
    markActed: () => setActed(true),
  }
}

const BANNER: Record<Priority, { field: string; label: string }> = {
  NOW: { field: 'field-red', label: 'Needs attention now' },
  TODAY: { field: 'field-warn', label: 'Needs attention today' },
  FOLLOW_UP: { field: 'field-ice', label: 'Follow up' },
}

/**
 * Why this screen is open.
 *
 * Two lines and nothing else. It answers the question the drill down used to
 * leave hanging, then gets out of the way of the record itself.
 */
export function AttentionBanner({ entry }: { entry: AttentionEntry }) {
  const tone = BANNER[entry.priority]
  return (
    <section
      className={cn(
        'animate-rise overflow-hidden rounded-block',
        entry.priority === 'FOLLOW_UP' ? 'text-white' : 'text-canvas',
        tone.field,
      )}
    >
      <div className="p-5 sm:p-6">
        <div className="font-label text-[12px] font-semibold uppercase tracking-[0.18em] text-canvas/85">
          {tone.label}
        </div>
        <h2 className="mt-2 max-w-[34ch] font-control-body text-[19px] font-bold leading-[1.2] sm:text-[21px]">
          {entry.title}
        </h2>
        <p className="mt-1.5 max-w-[52ch] text-[15px] leading-snug text-canvas/90">
          {entry.context}
        </p>
      </div>
    </section>
  )
}

const PULSE_TONE: Record<Priority, string> = {
  NOW: '255, 49, 49',
  TODAY: '255, 159, 10',
  FOLLOW_UP: '85, 0, 213',
}

/**
 * Wraps the action Salvador was sent here to take.
 *
 * It does not add a button. The correct control already exists on every one of
 * these screens, so this only draws the eye to it: three pulses on arrival, then
 * a quiet ring that holds until the control is used. Anything louder than this
 * would be competing with the record.
 */
export function AttentionTarget({
  active,
  priority = 'NOW',
  onInteract,
  className,
  children,
}: {
  active: boolean
  priority?: Priority
  /** Called on the first interaction, which is what stops the emphasis. */
  onInteract: () => void
  className?: string
  children: ReactNode
}) {
  if (!active) return <>{children}</>
  return (
    <div
      onPointerDownCapture={onInteract}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onInteract()
      }}
      style={{ ['--pulse' as string]: PULSE_TONE[priority] }}
      className={cn('attention-pulse inline-flex rounded-xl', className)}
    >
      {children}
    </div>
  )
}

/**
 * The normal next step in the workflow.
 *
 * Icy blue, because this is the system telling Salvador where the work goes next,
 * not an exception asking for rescue. When an attention banner is on screen it
 * sits above this one and the two are never confused: red or amber means
 * something is wrong, icy blue means carry on.
 */
export function NextStep({
  line,
  action,
  className,
}: {
  /** One short practical sentence. Never a paragraph. */
  line: string
  action?: ReactNode
  className?: string
}) {
  return (
    <section className={cn('field-ice overflow-hidden rounded-block text-white', className)}>
      <div className="p-5 sm:p-6">
        <div className="font-label text-[12px] font-semibold uppercase tracking-[0.2em] text-canvas/85">
          Next
        </div>
        <p className="mt-2 max-w-[40ch] text-[17px] font-semibold leading-snug sm:text-[18px]">
          {line}
        </p>
        {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
      </div>
    </section>
  )
}
