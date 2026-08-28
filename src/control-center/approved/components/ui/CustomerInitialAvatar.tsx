import { cn } from '@/control-center/approved/lib/cn'

export function CustomerInitialAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center bg-mt-red font-display text-[26px] font-black uppercase leading-none tracking-[-0.045em] text-canvas shadow-[0_12px_28px_-18px_rgba(255,49,49,0.9)]',
        className,
      )}
    >
      <span className="-skew-x-[7deg]">{initial}</span>
    </span>
  )
}

export const InitialAvatar = CustomerInitialAvatar
