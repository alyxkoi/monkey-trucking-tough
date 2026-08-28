import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'

type Size = 'sm' | 'md' | 'lg'

/**
 * `default` sits on the dark canvas or a neutral panel.
 * `onSolid` sits on top of a bold solid color field (red, acid green, amber).
 */
type Tone = 'default' | 'onSolid'

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: Size
  tone?: Tone
  fullWidth?: boolean
  icon?: ReactNode
  children: ReactNode
}

/**
 * Touch targets stay 48px on phone and tablet, where the system is used outdoors
 * with gloves and sunlight. They tighten only at the desktop breakpoint, which is
 * the same place the product switches to a sidebar and a mouse.
 */
const SIZES: Record<Size, string> = {
  sm: 'h-12 px-4 text-[14px] lg:h-10 lg:text-[13px]',
  md: 'h-12 px-5 text-[15px]',
  lg: 'h-14 px-6 text-[16px]',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-label font-semibold uppercase tracking-[0.08em] transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-40 disabled:pointer-events-none'

/**
 * Primary action. Brand red by default, then snow white under the cursor.
 *
 * Urgency is carried by the priority chip beside the action, not by giving some
 * buttons a different color from others. Every primary action in the product now
 * looks the same, so a red button always means the same thing.
 *
 * Both fields carry near-black text and clear WCAG contrast. The pressed state
 * stays darker than the hover without changing the button's geometry.
 */
export function PrimaryButton({
  size = 'md',
  tone = 'default',
  fullWidth,
  icon,
  className,
  children,
  ...props
}: BaseProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        BASE,
        SIZES[size],
        fullWidth && 'w-full',
        tone === 'default'
          ? 'border border-mt-red bg-mt-red text-canvas shadow-[0_10px_24px_-14px_rgba(0,0,0,0.9)] motion-safe:hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-canvas hover:shadow-[0_18px_34px_-18px_rgba(0,0,0,0.95)] active:border-[#dfe1e5] active:bg-[#dfe1e5] active:text-canvas'
          : 'bg-canvas text-ink hover:bg-[#1C1C20] active:bg-[#242429] focus-visible:ring-canvas/60 focus-visible:ring-offset-0',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/** Secondary action. Subdued glass, never competes with the primary action. */
export function SecondaryButton({
  size = 'md',
  tone = 'default',
  fullWidth,
  icon,
  className,
  children,
  ...props
}: BaseProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        BASE,
        SIZES[size],
        fullWidth && 'w-full',
        tone === 'default'
          ? 'border border-white/10 bg-white/[0.06] text-ink hover:border-white/20 hover:bg-white/[0.11]'
          : 'border border-canvas/30 bg-canvas/10 text-canvas hover:bg-canvas/20 focus-visible:ring-canvas/60 focus-visible:ring-offset-0',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/** Existing primary geometry with the approved Monkey red field. */
export function BrandButton({
  size = 'md',
  fullWidth,
  icon,
  className,
  children,
  ...props
}: Omit<BaseProps, 'tone'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        BASE,
        SIZES[size],
        fullWidth && 'w-full',
        'border border-mt-red bg-mt-red text-canvas shadow-[0_10px_24px_-14px_rgba(0,0,0,0.9)] motion-safe:hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-canvas hover:shadow-[0_18px_34px_-18px_rgba(0,0,0,0.95)] active:border-[#dfe1e5] active:bg-[#dfe1e5] active:text-canvas',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/** Secondary action rendered as a real link, for tel: and sms: actions. */
export function ActionLink({
  href,
  size = 'md',
  tone = 'default',
  icon,
  className,
  children,
}: {
  href: string
  size?: Size
  tone?: Tone
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={cn(
        BASE,
        SIZES[size],
        tone === 'default'
          ? 'border border-white/10 bg-white/[0.06] text-ink hover:border-white/20 hover:bg-white/[0.11]'
          : 'border border-canvas/30 bg-canvas/10 text-canvas hover:bg-canvas/20 focus-visible:ring-canvas/60 focus-visible:ring-offset-0',
        className,
      )}
    >
      {icon}
      {children}
    </a>
  )
}

/** Quiet action. Text only, for things that must exist without shouting. */
export function QuietButton({
  size = 'md',
  tone = 'default',
  fullWidth,
  icon,
  className,
  children,
  ...props
}: BaseProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        BASE,
        SIZES[size],
        'px-3',
        fullWidth && 'w-full',
        tone === 'default'
          ? 'text-cc-muted hover:bg-white/[0.05] hover:text-ink'
          : 'text-canvas/70 hover:bg-canvas/10 hover:text-canvas focus-visible:ring-canvas/60 focus-visible:ring-offset-0',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}
