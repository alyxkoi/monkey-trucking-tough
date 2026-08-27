import { useEffect, useState } from 'react'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { TextArea } from '@/control-center/approved/components/ui/Field'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { Sheet } from '@/control-center/approved/components/shell/Sheet'
import type { FinancialChange } from '@/control-center/approved/state/moneyData'

/**
 * Financial records follow the same rule as tickets.
 * Nothing is ever hard deleted. Voiding or correcting an invoice, a payment or a
 * worker payment takes a reason, and the change is written into history with who
 * did it and when.
 */
export function VoidReasonSheet({
  open,
  onClose,
  onConfirm,
  title,
  line,
  placeholder,
  confirmLabel,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  title: string
  line: string
  placeholder: string
  confirmLabel: string
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) setReason('')
  }, [open])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Kept, not deleted"
      title={title}
      footer={
        <PrimaryButton
          fullWidth
          disabled={reason.trim().length === 0}
          onClick={() => {
            onConfirm(reason.trim())
            onClose()
          }}
        >
          {confirmLabel}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-[15px] leading-snug text-cc-muted">{line}</p>
        <TextArea
          label="Reason"
          value={reason}
          onChange={setReason}
          rows={3}
          placeholder={placeholder}
        />
      </div>
    </Sheet>
  )
}

/** Who changed a financial record, what they did, and when. */
export function ChangeHistory({ history }: { history: FinancialChange[] }) {
  if (history.length === 0) return null
  return (
    <Panel title="Change history" padded={false}>
      <div className="divide-y divide-line border-t border-line">
        {history.map((entry) => (
          <div key={`${entry.at}-${entry.note}`} className="px-5 py-3.5">
            <div className="text-[15px] text-ink">{entry.note}</div>
            <div className="mt-0.5 font-label text-[12px] uppercase tracking-[0.1em] text-idle">
              {entry.actor}
              <span className="px-1.5">/</span>
              {new Date(entry.at).toLocaleString('en-US')}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
