import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { PrimaryButton, QuietButton } from '@/control-center/approved/components/ui/Button'
import { Stepper, TextField } from '@/control-center/approved/components/ui/Field'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { Sheet } from '@/control-center/approved/components/shell/Sheet'
import { usd, usdExact } from '@/control-center/approved/lib/format'
import { MATERIALS, buildMaterialLine, type Material } from '@/control-center/approved/state/pricing'

type Mode = 'FULL' | 'CUSTOM'

/**
 * Material picker.
 * Prices come straight from the shared pricing source, the same one the Ticket
 * builder uses. Full load is a first class choice, not a checkbox buried in a form.
 */
export function MaterialSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (materialId: string, options: { isFullLoad: boolean; loads?: number; yards?: number }) => void
}) {
  const [material, setMaterial] = useState<Material | null>(null)
  const [mode, setMode] = useState<Mode>('FULL')
  const [loads, setLoads] = useState(1)
  const [yards, setYards] = useState('10')

  useEffect(() => {
    if (!open) {
      setMaterial(null)
      setMode('FULL')
      setLoads(1)
      setYards('10')
    }
  }, [open])

  const yardsNumber = Number(yards) || 0
  const preview = material
    ? buildMaterialLine(
        'preview',
        material,
        mode === 'FULL' ? { isFullLoad: true, loads } : { isFullLoad: false, yards: yardsNumber },
      )
    : null

  const add = () => {
    if (!material) return
    onAdd(
      material.id,
      mode === 'FULL' ? { isFullLoad: true, loads } : { isFullLoad: false, yards: yardsNumber },
    )
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={material ? 'Add material' : 'Materials'}
      title={material ? material.name : 'Pick a material'}
      footer={
        material && preview ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
                Line total
              </div>
              <div className="font-display display-tight tnum text-[30px]">
                {usdExact(preview.lineTotal)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <QuietButton onClick={() => setMaterial(null)}>Back</QuietButton>
              <PrimaryButton onClick={add} disabled={preview.lineTotal <= 0}>
                Add
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-cc-muted">
            Rates come from the Ticket system settings. Quotes and Tickets read the same
            list, so there is never a second price.
          </p>
        )
      }
    >
      {!material ? (
        <div className="divide-y divide-line">
          {MATERIALS.filter((entry) => entry.isActive).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setMaterial(entry)}
              className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-raised"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-ink">{entry.name}</span>
                <span className="mt-0.5 block font-label text-[13px] uppercase tracking-[0.08em] text-cc-muted">
                  {usd(entry.pricePerYard)} per yard
                  <span className="px-1.5 text-idle">/</span>
                  {usd(entry.fullLoadPrice)} full load
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-idle" strokeWidth={2} />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusPill tone="neutral" size="sm">
              {usd(material.pricePerYard)} per yard
            </StatusPill>
            <StatusPill tone="ice" size="sm">
              {usd(material.fullLoadPrice)} full load
            </StatusPill>
            <span className="font-label text-[12px] uppercase tracking-[0.12em] text-cc-muted">
              {material.fullLoadYards} yards to a load
            </span>
          </div>

          <SegmentControl
            fullWidth
            options={[
              { value: 'FULL' as Mode, label: 'Full load' },
              { value: 'CUSTOM' as Mode, label: 'Custom yardage' },
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'FULL' ? (
            <div>
              <div className="mb-2 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
                How many loads
              </div>
              <Stepper value={loads} onChange={setLoads} min={1} max={20} />
              <p className="mt-3 text-[14px] text-cc-muted">
                {loads} {loads === 1 ? 'load' : 'loads'} is {material.fullLoadYards * loads} yards
                at the flat full load rate.
              </p>
            </div>
          ) : (
            <TextField
              label="Yards"
              value={yards}
              onChange={setYards}
              inputMode="numeric"
              hint={`Charged at ${usd(material.pricePerYard)} per yard. A full load of ${material.fullLoadYards} yards is cheaper at ${usd(material.fullLoadPrice)}.`}
            />
          )}
        </div>
      )}
    </Sheet>
  )
}
