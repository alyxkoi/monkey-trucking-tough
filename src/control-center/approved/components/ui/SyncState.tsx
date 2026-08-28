import { CloudOff, RefreshCw, Check } from 'lucide-react'
import { cn } from '@/control-center/approved/lib/cn'
import { shortAgo } from '@/control-center/approved/lib/format'
import type { SyncStatus } from '@/control-center/approved/state/AppState'

/**
 * Offline and sync feedback.
 *
 * Connected and syncing states use the acid operational accent.
 * Offline uses amber because it is a waiting state, not a failure and not an
 * emergency. Nothing here is ever hidden from the user: a ticket waiting to sync
 * has to be visibly safe.
 */
export function SyncChip({
  status,
  queued,
  lastSyncAt,
  onClick,
}: {
  status: SyncStatus
  queued: number
  lastSyncAt: number
  onClick?: () => void
}) {
  const label =
    status === 'synced'
      ? `Synced ${shortAgo(lastSyncAt)} ago`
      : status === 'syncing'
        ? 'Syncing'
        : queued > 0
          ? `Offline, ${queued} waiting`
          : 'Offline'

  return (
    <button
      type="button"
      onClick={onClick}
      title="Refresh sync state"
      className={cn(
        'flex h-11 items-center gap-2 rounded-xl border px-3.5 font-label text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors',
        status === 'offline'
          ? 'border-warn/40 bg-warn/10 text-warn'
          : status === 'syncing'
            ? 'border-ice/30 bg-ice/[0.08] text-ice hover:border-ice/55'
            : 'border-white/10 bg-white/[0.05] text-cc-muted hover:border-ice/30 hover:text-ink',
      )}
    >
      {status === 'offline' ? (
        <CloudOff className="h-4 w-4" strokeWidth={2.2} />
      ) : status === 'syncing' ? (
        <RefreshCw className="h-4 w-4 animate-pulse-soft" strokeWidth={2.2} />
      ) : (
        <Check className="h-4 w-4" strokeWidth={2.6} />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/** Full width version for narrow screens, shown only when there is something to say. */
export function SyncBanner({
  status,
  queued,
  className,
}: {
  status: SyncStatus
  queued: number
  className?: string
}) {
  if (status === 'synced') return null

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border px-4 py-3 font-label text-[13px] font-semibold uppercase tracking-[0.1em]',
        status === 'offline'
          ? 'border-warn/40 bg-warn/10 text-warn'
          : 'border-mt-red/40 bg-mt-red/10 text-mt-red',
        className,
      )}
    >
      {status === 'offline' ? (
        <CloudOff className="h-4 w-4 shrink-0" strokeWidth={2.2} />
      ) : (
        <RefreshCw className="h-4 w-4 shrink-0 animate-pulse-soft" strokeWidth={2.2} />
      )}
      <span>
        {status === 'offline'
          ? queued > 0
            ? `Offline. ${queued} saved here and waiting to sync.`
            : 'Offline. Anything you save is held here until the signal comes back.'
          : 'Syncing what was saved offline.'}
      </span>
    </div>
  )
}
