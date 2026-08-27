import { useEffect, useState } from 'react'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { TextArea, TextField } from '@/control-center/approved/components/ui/Field'
import { Sheet } from '@/control-center/approved/components/shell/Sheet'

/**
 * Custom work belongs to Quotes only.
 * A Ticket is material and delivery proof, so service work never becomes a
 * material line. Pricing here is Salvador's judgement, not an AI calculation.
 */
export function CustomWorkSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (label: string, amount: number) => void
}) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    if (!open) {
      setLabel('')
      setAmount('')
    }
  }, [open])

  const value = Number(amount) || 0
  const valid = label.trim().length > 0 && value > 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Add to quote"
      title="Custom work"
      footer={
        <PrimaryButton
          fullWidth
          disabled={!valid}
          onClick={() => {
            onAdd(label, value)
            onClose()
          }}
        >
          Add custom work
        </PrimaryButton>
      }
    >
      <div className="space-y-5 p-5">
        <TextArea
          label="What is the work"
          value={label}
          onChange={setLabel}
          rows={2}
          placeholder="Grade and shape the driveway before base"
        />
        <TextField
          label="Price"
          value={amount}
          onChange={setAmount}
          inputMode="decimal"
          placeholder="900"
          hint="Driveways, ponds, grading and clearing are priced by Salvador, never calculated automatically."
        />
      </div>
    </Sheet>
  )
}
