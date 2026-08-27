import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/control-center/approved/components/shell/Sheet'
import { SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { FieldLabel } from '@/control-center/approved/components/ui/Field'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { cn } from '@/control-center/approved/lib/cn'
import { DRIVERS, driverName } from '@/control-center/approved/state/ticketsData'

export function DriverPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const activeDrivers = DRIVERS.filter((driver) => driver.isActive)
  const matches = activeDrivers.filter((driver) =>
    driver.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )

  const choose = (driverId: string) => {
    onChange(driverId)
    setOpen(false)
    setQuery('')
  }

  return (
    <div>
      <FieldLabel>Driver</FieldLabel>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-between rounded-xl border border-line bg-raised px-4 text-left text-[16px] text-ink transition-colors hover:border-ice/45 focus:border-ice/60 focus:outline-none"
      >
        <span className={value ? 'text-ink' : 'text-cc-muted'}>
          {value ? driverName(value) : activeDrivers.length ? 'Unassigned' : 'No drivers configured'}
        </span>
        <Search className="h-4 w-4 shrink-0 text-cc-muted" strokeWidth={2.2} />
      </button>
      {!activeDrivers.length && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-warn">
          <span>Add a real driver in Settings, or leave this ticket unassigned.</span>
          <button
            type="button"
            className="min-h-11 font-label font-semibold uppercase tracking-[0.08em] text-ice"
            onClick={() => navigate('/admin/settings/workers')}
          >
            Manage drivers
          </button>
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Ticket"
        title="Choose a driver"
      >
        <div className="border-b border-line p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-muted" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search driver"
              className="h-12 w-full rounded-xl border border-line bg-raised pl-11 pr-4 text-[16px] text-ink placeholder:text-cc-muted focus:border-ice/60 focus:outline-none"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => choose('')}
          className="flex min-h-14 w-full items-center gap-4 border-b border-line px-5 py-3 text-left hover:bg-white/[0.04]"
        >
          <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink">Unassigned</span>
          {!value && <Check className="h-5 w-5 text-ice" strokeWidth={2.5} />}
        </button>

        {matches.map((driver) => (
          <button
            key={driver.id}
            type="button"
            onClick={() => choose(driver.id)}
            className={cn(
              'flex min-h-14 w-full items-center gap-4 border-b border-line px-5 py-3 text-left hover:bg-white/[0.04]',
              value === driver.id && 'bg-ice/10',
            )}
          >
            <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink">{driver.name}</span>
            {value === driver.id && <Check className="h-5 w-5 text-ice" strokeWidth={2.5} />}
          </button>
        ))}

        {activeDrivers.length === 0 ? (
          <EmptyState
            title="No drivers configured"
            line="Add the real driver roster in Settings. Drivers do not need user accounts."
            action={
              <SecondaryButton onClick={() => navigate('/admin/settings/workers')}>
                Manage drivers
              </SecondaryButton>
            }
          />
        ) : matches.length === 0 ? (
          <EmptyState title="No driver found" line="Try another name." />
        ) : null}
      </Sheet>
    </div>
  )
}
