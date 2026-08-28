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
        'flex shrink-0 items-center justify-center bg-mt-red font-label font-black uppercase leading-none text-canvas',
        className,
      )}
    >
      {initial}
    </span>
  )
}
