import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Activity } from '@/control-center/data'
import { resolveAiStaffAction, previewAiChangeApproval, decideAiStaffAction } from '@/control-center/data'
import { aiActionDetails } from '../../state/aiActions'
import { Panel } from './Panel'
import { PrimaryButton, SecondaryButton } from './Button'

export function AiStaffActions({actions,onResolved,onPriceRequest}:{actions:Activity[];onResolved:()=>Promise<unknown>;onPriceRequest?:()=>void|Promise<void>}) {
  const navigate=useNavigate()
  const [notes,setNotes]=useState<Record<string,string>>({})
  const [preview,setPreview]=useState<{id:string;values:Record<string,unknown>}|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  if(!actions.length)return null
  return <Panel title="Customer requests for staff"><div className="space-y-5" aria-live="polite">
    {error&&<p role="alert" className="text-warn">{error}</p>}
    {actions.map(entry=>{const a=aiActionDetails(entry);return <section key={entry.id} className={`space-y-3 rounded-xl border p-4 ${a.kind==='QUOTE_READY'?'border-warn/40 bg-warn/10':'border-line'}`}>
      <h3 className="font-bold">{a.title}</h3>
      {a.kind==='CUSTOM_WORK'?<><p className="text-sm text-cc-muted">Salvador needs to review the work and set its price. Material delivery can continue separately.</p><blockquote className="break-words border-l-2 border-line pl-3 text-sm"><span className="block text-cc-muted">Customer</span>“{a.request}”</blockquote></>:<p className="break-words text-sm text-cc-muted">{a.context}</p>}
      <PrimaryButton disabled={busy} onClick={async()=>{if(a.kind==='CUSTOM_WORK'&&onPriceRequest){setBusy(true);setError('');try{await onPriceRequest()}catch(e){setError(e instanceof Error?e.message:'Could not open pricing')}finally{setBusy(false)}}else navigate(a.to)}}>{busy?'Working…':a.label}</PrimaryButton>
      {a.kind!=='QUOTE_READY'&&<details className="space-y-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Resolve this request</summary><p className="text-sm text-cc-muted">Marking it complete or declining it closes the staff request without messaging the customer. To send a confirmation, review the updated details first.</p><label className="block text-sm">Staff note<input aria-label={`Resolution for ${a.title}`} className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-raised p-3" value={notes[entry.id]??''} onChange={e=>setNotes({...notes,[entry.id]:e.target.value})}/></label>
      <div className="flex flex-wrap gap-2"><SecondaryButton disabled={busy||(notes[entry.id]??'').trim().length<3} onClick={async()=>{setBusy(true);setError('');try{await resolveAiStaffAction(entry.id,notes[entry.id]);await onResolved()}catch(e){setError(e instanceof Error?e.message:'Could not resolve request')}finally{setBusy(false)}}}>Mark complete</SecondaryButton>
      {['SCHEDULE_CHANGE','ORDER_CHANGE','ADDRESS_CHANGE','CONTACT_REVIEW','CUSTOM_WORK'].includes(a.kind)&&<>
        <SecondaryButton disabled={busy} onClick={async()=>{setBusy(true);setError('');setPreview(null);try{setPreview({id:entry.id,values:await previewAiChangeApproval(entry.id)})}catch(e){setError(e instanceof Error?e.message:'Could not load details')}finally{setBusy(false)}}}>Review confirmation</SecondaryButton>
        <SecondaryButton disabled={busy||(notes[entry.id]??'').trim().length<3} onClick={async()=>{setBusy(true);setError('');try{await decideAiStaffAction(entry.id,notes[entry.id],'REJECTED');setPreview(null);await onResolved()}catch(e){setError(e instanceof Error?e.message:'Could not reject request')}finally{setBusy(false)}}}>Decline request</SecondaryButton>
      </>}</div>
      {preview?.id===entry.id&&<div className="space-y-3 rounded-xl border border-line bg-raised p-4">
        <p className="text-sm">Check the current job or quote details below. Make any changes in the job or quote first. Confirming sends the customer one update during business hours. AI stays paused until staff resumes it.</p>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">{Object.entries(preview.values).filter(([key])=>!['kind','items'].includes(key)&&!key.endsWith('_id')).map(([key,value])=><div key={key}><dt className="text-cc-muted">{key.replaceAll('_',' ')}</dt><dd className="break-words font-bold">{String(value??'Not set')}</dd></div>)}</dl>
        <SecondaryButton disabled={busy||(notes[entry.id]??'').trim().length<3} onClick={async()=>{setBusy(true);setError('');try{await decideAiStaffAction(entry.id,notes[entry.id],'APPROVED',preview.values);setPreview(null);await onResolved()}catch(e){setError(e instanceof Error?e.message:'Could not approve request')}finally{setBusy(false)}}}>Confirm details & notify customer</SecondaryButton>
      </div>}
      </details>}
    </section>})}
  </div></Panel>
}
