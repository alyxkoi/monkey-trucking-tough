import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Activity } from '@/control-center/data'
import { resolveAiStaffAction } from '@/control-center/data'
import { aiActionDetails } from '../../state/aiActions'
import { Panel } from './Panel'
import { SecondaryButton } from './Button'

export function AiStaffActions({actions,onResolved}:{actions:Activity[];onResolved:()=>Promise<unknown>}) {
  const navigate=useNavigate()
  const [notes,setNotes]=useState<Record<string,string>>({})
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  if(!actions.length)return null
  return <Panel title="Customer requests for staff"><div className="space-y-5" aria-live="polite">
    {error&&<p role="alert" className="text-warn">{error}</p>}
    {actions.map(entry=>{const a=aiActionDetails(entry);return <section key={entry.id} className="space-y-3 rounded-xl border border-line p-4">
      <h3 className="font-bold">{a.title}</h3><p className="break-words text-sm text-cc-muted">{a.context}</p>
      <SecondaryButton onClick={()=>navigate(a.to)}>{a.label}</SecondaryButton>
      {a.kind!=='QUOTE_READY'&&<><label className="block text-sm">Resolution note<input aria-label={`Resolution for ${a.title}`} className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-raised p-3" value={notes[entry.id]??''} onChange={e=>setNotes({...notes,[entry.id]:e.target.value})}/></label>
      <SecondaryButton disabled={busy||(notes[entry.id]??'').trim().length<3} onClick={async()=>{setBusy(true);setError('');try{await resolveAiStaffAction(entry.id,notes[entry.id]);await onResolved()}catch(e){setError(e instanceof Error?e.message:'Could not resolve request')}finally{setBusy(false)}}}>Mark handled</SecondaryButton></>}
    </section>})}
  </div></Panel>
}
