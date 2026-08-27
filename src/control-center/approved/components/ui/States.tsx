import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { cn } from '@/control-center/approved/lib/cn'
import { SecondaryButton } from './Button'

/** Skeleton primitive. Slow soft pulse, never a shimmering sweep. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse-soft rounded-lg bg-raised', className)} />
}

/** Skeleton shaped like an oversized number module. */
export function SkeletonNumber({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const heights = {
    sm: 'h-7 w-20',
    md: 'h-9 w-28',
    lg: 'h-12 w-40',
    xl: 'h-16 w-52',
  }
  return (
    <div className={cn('space-y-2.5', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className={heights[size]} />
    </div>
  )
}

/** Skeleton shaped like a record row. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 px-5 py-4', className)}>
      <Skeleton className="h-7 w-14 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-10 w-24 shrink-0" />
    </div>
  )
}

/**
 * Empty state. Says what belongs here and offers the action that fills it,
 * instead of an apology and a shrug.
 */
export function EmptyState({
  icon,
  title,
  line,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  line?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-raised text-cc-muted">
          {icon}
        </div>
      )}
      <div className="font-label text-[15px] font-semibold uppercase tracking-[0.14em] text-ink">
        {title}
      </div>
      {line && <p className="mt-2 max-w-[42ch] text-[15px] text-cc-muted">{line}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * Error state. Plain language, a way to try again, and never a dead end.
 * Entered data is never cleared by a failure.
 */
export function ErrorState({
  title = 'That did not go through',
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-panel border border-mt-red/40 bg-mt-tint p-5',
        className,
      )}
    >
      <div className="flex gap-3.5">
        <AlertTriangle className="h-5 w-5 shrink-0 text-mt-red" strokeWidth={2.2} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold text-ink">{title}</div>
          <p className="mt-1 text-[15px] leading-snug text-ink/75">{message}</p>
          {onRetry && (
            <SecondaryButton
              size="sm"
              className="mt-4"
              onClick={onRetry}
              icon={<RotateCw className="h-4 w-4" strokeWidth={2.2} />}
            >
              {retryLabel}
            </SecondaryButton>
          )}
        </div>
      </div>
    </div>
  )
}
