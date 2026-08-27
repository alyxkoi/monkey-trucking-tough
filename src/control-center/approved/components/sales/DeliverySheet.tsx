import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { TextField } from '@/control-center/approved/components/ui/Field'
import { Sheet } from '@/control-center/approved/components/shell/Sheet'
import { cn } from '@/control-center/approved/lib/cn'
import { usd, usdExact } from '@/control-center/approved/lib/format'
import {
  DELIVERY_OPTIONS,
  deliveryFeePerLoad,
  type DeliveryMode,
  type DeliverySelection,
} from '@/control-center/approved/state/pricing'

/**
 * Delivery picker.
 * Delivery is charged per load and then multiplied by the load count, exactly as
 * the Ticket system does it.
 */
export function DeliverySheet({
  open,
  onClose,
  delivery,
  deliveryLoads,
  onApply,
}: {
  open: boolean
  onClose: () => void
  delivery: DeliverySelection
  deliveryLoads: number
  onApply: (delivery: DeliverySelection) => void
}) {
  const [mode, setMode] = useState<DeliveryMode>(delivery.mode)
  const [miles, setMiles] = useState(String(delivery.miles ?? 15))
  const [customFee, setCustomFee] = useState(String(delivery.customFee ?? 0))

  useEffect(() => {
    if (open) {
      setMode(delivery.mode)
      setMiles(String(delivery.miles ?? 15))
      setCustomFee(String(delivery.customFee ?? 0))
    }
  }, [open, delivery])

  const selection: DeliverySelection = {
    mode,
    miles: Number(miles) || 0,
    customFee: Number(customFee) || 0,
  }
  const perLoad = deliveryFeePerLoad(selection)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Delivery"
      title="How is it getting there?"
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
              {usd(perLoad)} per load, {deliveryLoads} {deliveryLoads === 1 ? 'load' : 'loads'}
            </div>
            <div className="font-display display-tight tnum text-[30px]">
              {usdExact(perLoad * deliveryLoads)}
            </div>
          </div>
          <PrimaryButton
            className="shrink-0"
            disabled={mode === 'UNSET'}
            onClick={() => {
              onApply(selection)
              onClose()
            }}
          >
            Apply
          </PrimaryButton>
        </div>
      }
    >
      <div className="divide-y divide-line">
        {DELIVERY_OPTIONS.map((option) => {
          const selected = option.mode === mode
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              className={cn(
                'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors',
                selected ? 'bg-ice/10' : 'hover:bg-raised/60',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                  selected ? 'border-ice bg-ice text-canvas' : 'border-line bg-raised',
                )}
              >
                {selected && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-ink">{option.label}</span>
                <span className="mt-0.5 block text-[14px] text-cc-muted">{option.hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      {(mode === 'OVER_10' || mode === 'CUSTOM') && (
        <div className="border-t border-line p-5">
          {mode === 'OVER_10' ? (
            <TextField
              label="Total miles"
              value={miles}
              onChange={setMiles}
              inputMode="numeric"
              hint={`$100 base plus $10 a mile past 10. That is ${usd(perLoad)} per load.`}
            />
          ) : (
            <TextField
              label="Custom fee per load"
              value={customFee}
              onChange={setCustomFee}
              inputMode="decimal"
              hint="Typed in manually, same as the Ticket system."
            />
          )}
        </div>
      )}
    </Sheet>
  )
}
