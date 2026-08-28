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
        'flex shrink-0 items-center justify-center bg-mt-red font-display text-[22px] font-black uppercase leading-none tracking-[-0.04em] text-canvas',
        className,
      )}
    >
      <span className="-skew-x-[7deg]">{initial}</span>
    </span>
  )
}

export const InitialAvatar = CustomerInitialAvatar
