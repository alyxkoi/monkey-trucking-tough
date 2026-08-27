import { useEffect, useState } from 'react'
import { UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { CustomerPicker } from '@/control-center/approved/components/ui/CustomerPicker'
import { SelectField, TextArea, TextField } from '@/control-center/approved/components/ui/Field'
import { Sheet } from './Sheet'
import { useAppState } from '@/control-center/approved/state/AppState'

/**
 * The manual source picker stays deliberately coarse.
 *
 * Facebook covers every Facebook surface, including Marketplace. Website covers
 * anything that arrived through the site, which is what a Google search actually
 * produces. Anything finer than this belongs to Campaign, which a tracking link
 * fills in on its own, so a lead can read Source Facebook, Campaign August
 * Driveway without asking Salvador to classify it by hand.
 */
const SOURCES = ['Word of mouth', 'Facebook', 'Website', 'Walk in', 'Other']

export function NewLeadSheet() {
  const { newLeadSheetOpen, setNewLeadSheetOpen, findDuplicate, createLead, customerById } =
    useAppState()
  const navigate = useNavigate()

  const [existingId, setExistingId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState(SOURCES[0])
  const [campaign, setCampaign] = useState('')
  const [need, setNeed] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!newLeadSheetOpen) {
      setExistingId('')
      setName('')
      setPhone('')
      setEmail('')
      setSource(SOURCES[0])
      setCampaign('')
      setNeed('')
    }
  }, [newLeadSheetOpen])

  // Phone is the primary match, email is the secondary match. Names never merge.
  const duplicate = findDuplicate(phone, email)
  const valid = (name.trim().length > 0 || Boolean(duplicate)) && phone.trim().length > 0 && need.trim().length > 0

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const result = await createLead({
        name: duplicate?.name ?? name,
        phone,
        email: email || undefined,
        source,
        campaign: campaign || undefined,
        need,
      })
      setNewLeadSheetOpen(false)
      navigate(`/admin/leads/${result.leadId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lead could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={newLeadSheetOpen}
      onClose={() => setNewLeadSheetOpen(false)}
      eyebrow="Create"
      title="New lead"
      footer={
        <PrimaryButton fullWidth disabled={!valid || saving} onClick={submit}>
          {saving ? 'Saving' : duplicate ? `Add lead to ${duplicate.name}` : 'Create lead'}
        </PrimaryButton>
      }
    >
      <div className="space-y-5 p-5">
        {/*
          Another lead for someone already on the books starts here rather than by
          retyping a phone number and hoping the duplicate check catches it.
          Choosing a customer fills the fields below, so createLead still runs the
          same phone and email matching and still refuses to make a second record.
        */}
        <CustomerPicker
          label="Existing customer, if there is one"
          value={existingId}
          onChange={(id) => {
            setExistingId(id)
            const match = id ? customerById(id) : undefined
            setName(match?.name ?? '')
            setPhone(match?.phone ?? '')
            setEmail(match?.email ?? '')
          }}
          hint="Leave this alone for someone new."
        />

        <TextField
          label="Name"
          value={duplicate ? duplicate.name : name}
          onChange={setName}
          placeholder="Who is it"
        />
        <TextField
          label="Phone"
          value={phone}
          onChange={setPhone}
          inputMode="tel"
          placeholder="(469) 555 0177"
        />

        {duplicate && (
          <div className="flex gap-3.5 rounded-panel border border-ice/30 bg-ice/10 p-4">
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-ice" strokeWidth={2.2} />
            <div className="min-w-0 text-[15px] leading-snug">
              <span className="font-semibold text-ink">
                This phone already belongs to {duplicate.name}.
              </span>
              <span className="mt-1 block text-cc-muted">
                The new lead goes onto that existing customer. No duplicate record is
                created.
              </span>
            </div>
          </div>
        )}

        <TextField
          label="Email, if you have it"
          value={email}
          onChange={setEmail}
          inputMode="email"
          placeholder="Optional"
        />
        <SelectField label="Source" value={source} onChange={setSource} options={SOURCES} />
        <TextField
          label="Campaign"
          value={campaign}
          onChange={setCampaign}
          placeholder="Optional, for tracking links"
        />
        <TextArea
          label="What do they need"
          value={need}
          onChange={setNeed}
          rows={3}
          placeholder="Rock for the driveway, about 200 feet"
        />
      </div>
    </Sheet>
  )
}
