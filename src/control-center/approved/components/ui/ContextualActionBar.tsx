import type { ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'

/**
 * Contextual action area. The product shows the next right action for the current
 * record state, not every possible action at once.
 *
 * On mobile the primary action stacks first and goes full width so it stays inside
 * easy thumb reach.
 */
export function ContextualActionBar({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'end' | 'between'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 sm:flex-row sm:items-center',
        align === 'end' && 'sm:justify-end',
        align === 'start' && 'sm:justify-start',
        align === 'between' && 'sm:justify-between',
        className,
      )}
    >
      {children}
    </div>
  )
}
