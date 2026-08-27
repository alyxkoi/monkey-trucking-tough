import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { CustomerPicker } from '@/control-center/approved/components/ui/CustomerPicker'
import { SelectField, TextArea, TextField } from '@/control-center/approved/components/ui/Field'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { Sheet } from '@/control-center/approved/components/shell/Sheet'
import { usd } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import {
  JOB_CATEGORIES,
  JOB_CATEGORY_LABEL,
  dateKey,
  type Job,
  type JobCategory,
} from '@/control-center/approved/state/jobsData'
import { quoteTotals, type Quote } from '@/control-center/approved/state/salesData'

type Mode = 'TIMED' | 'ALL_DAY'

/**
 * Schedule Job, and Reschedule when a job is passed in.
 *
 * From an accepted quote the customer, description and agreed amount carry over
 * untouched. The sheet only asks for what scheduling actually needs: a date, a
 * time or all day, and the address.
 */
export function ScheduleJobSheet({
  open,
  onClose,
  quote,
  job,
  defaultDate,
}: {
  open: boolean
  onClose: () => void
  /** Scheduling an accepted quote. */
  quote?: Quote
  /** Rescheduling an existing job. */
  job?: Job
  defaultDate?: string
}) {
  const { customerById, scheduleJob, rescheduleJob } = useAppState()

  const [customerId, setCustomerId] = useState('')
  const [category, setCategory] = useState<JobCategory>('MATERIAL_DELIVERY')
  const [date, setDate] = useState('')
  const [mode, setMode] = useState<Mode>('TIMED')
  const [time, setTime] = useState('08:00')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (job) {
      setCustomerId(job.customerId)
      setCategory(job.category)
      setDate(job.date)
      setMode(job.allDay ? 'ALL_DAY' : 'TIMED')
      setTime(job.time ?? '08:00')
      setAddress(job.address)
      setDescription(job.description)
      setNotes(job.notes)
      return
    }
    // Nothing is preselected for a direct job. Salvador searches for whoever
    // actually called, rather than starting on an unrelated customer.
    setCustomerId(quote?.customerId ?? '')
    setCategory(quote && quote.customLines.length > 0 ? 'OTHER' : 'MATERIAL_DELIVERY')
    setDate(defaultDate ?? dateKey(new Date()))
    setMode('TIMED')
    setTime('08:00')
    setAddress(quote?.address ?? '')
    setDescription(quote?.description ?? '')
    setNotes('')
    // Deliberately not watching `customers`. Adding a customer from inside this
    // sheet changes that array, and having the reset run on it wiped the form
    // the moment a new person was created.
  }, [defaultDate, job, open, quote])

  const customer = customerById(customerId)
  const agreedAmount = quote ? quoteTotals(quote).total : (job?.agreedAmount ?? 0)
  const valid = Boolean(date) && Boolean(customerId) && description.trim().length > 0 && (Boolean(job) || address.trim().length > 0)

  const submit = async () => {
    if (!valid) return
    if (job) {
      rescheduleJob(job.id, {
        date,
        time: mode === 'TIMED' ? time : undefined,
        allDay: mode === 'ALL_DAY',
      })
      onClose()
      return
    }
    setSaving(true)
    try {
      await scheduleJob({
        customerId,
        quoteId: quote?.id,
        category,
        date,
        time: mode === 'TIMED' ? time : undefined,
        allDay: mode === 'ALL_DAY',
        address,
        description,
        agreedAmount,
        notes,
      })
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Job could not be scheduled.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={job ? 'Move the work' : 'Put it on the calendar'}
      title={job ? 'Reschedule job' : 'Schedule job'}
      footer={
        <PrimaryButton fullWidth disabled={!valid || saving} onClick={submit}>
          {saving ? 'Saving' : job ? 'Move Job' : 'Schedule Job'}
        </PrimaryButton>
      }
    >
      <div className="space-y-5 p-5">
        {quote && (
          <div className="rounded-panel border border-ice/30 bg-ice/10 p-4">
            <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-ice">
              Carried over from {quote.number}
            </div>
            <div className="mt-2 space-y-1 text-[15px] leading-snug">
              <div className="font-semibold text-ink">{customer?.name}</div>
              <div className="text-cc-muted">{quote.description}</div>
              <div className="text-ink">
                Agreed amount{' '}
                <span className="font-display display-tight tnum text-[18px]">
                  {usd(agreedAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {!quote && !job && (
          <CustomerPicker
            value={customerId}
            onChange={setCustomerId}
            allowCreate
            createLabel="Add them as a new customer"
            hint="Search by name, phone or email. Someone new can be added right here."
          />
        )}

        {!job && (
          <SelectField
            label="Job type"
            value={category}
            onChange={(value) => setCategory(value as JobCategory)}
            options={JOB_CATEGORIES}
            renderOption={(value) => JOB_CATEGORY_LABEL[value as JobCategory]}
          />
        )}

        <TextField label="Date" type="date" value={date} onChange={setDate} />

        <div>
          <span className="mb-2 block font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
            Time
          </span>
          <SegmentControl
            fullWidth
            options={[
              { value: 'TIMED' as Mode, label: 'Set a time' },
              { value: 'ALL_DAY' as Mode, label: 'All day' },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'TIMED' && (
            <TextField className="mt-3" type="time" value={time} onChange={setTime} />
          )}
        </div>

        {!job && (
          <>
            <TextField
              label="Job site address"
              value={address}
              onChange={setAddress}
              placeholder="Where the work happens"
            />
            <TextArea
              label="Work description"
              value={description}
              onChange={setDescription}
              rows={2}
            />
            <TextArea
              label="Notes"
              value={notes}
              onChange={setNotes}
              rows={2}
              placeholder="Gate codes, where to drop, who to ask for"
            />
          </>
        )}

        {job && (
          <p className="text-[14px] leading-snug text-cc-muted">
            Moving the job cancels the old reminder and sets a new one for 24 hours
            before the new date.
          </p>
        )}
      </div>
    </Sheet>
  )
}
