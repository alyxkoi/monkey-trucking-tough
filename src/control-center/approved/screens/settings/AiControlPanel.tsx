import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Panel } from '../../components/ui/Panel'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { TextArea } from '../../components/ui/Field'

type Profile = { model: string | null; tone: string; concise: boolean; review_enabled: boolean; version: number; last_review_at: string | null }
type Entry = { id: string; created_at: string; kind: string; summary: string; before_settings: Profile | null; findings: { code: string; count: number; recommendation: string }[] }
type Message = { sender_type: 'CUSTOMER' | 'AI'; body: string }
type Status = { settings: Profile; history: Entry[]; configured_model: string; provider: string; prompt_version: string; context_message_limit: number; maps_key_configured: boolean; immutable_rules: string[]; recent_runs: { model_id: string | null; status: string; latency_ms: number; created_at: string }[] }
type Simulation = { reply: string | null; blocked: string | null; model: string; decision: { known_facts: {key:string;value:string}[];missing_facts:string[];recommended_action:string }; tool_results: unknown }

async function call<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-control',{body})
  if (error || data?.error) throw new Error(data?.error || error?.message || 'AI request failed')
  return data as T
}

export function AiControlPanel() {
  const [status,setStatus]=useState<Status|null>(null)
  const [profile,setProfile]=useState<Profile|null>(null)
  const [models,setModels]=useState<string[]>([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [form,setForm]=useState('')
  const [text,setText]=useState('')
  const [messages,setMessages]=useState<Message[]>([])
  const [simulation,setSimulation]=useState<Simulation|null>(null)
  const load=async()=>{const data=await call<Status>({action:'status'});setStatus(data);setProfile(data.settings)}
  useEffect(()=>{let cancelled=false;call<Status>({action:'status'}).then(data=>{if(!cancelled){setStatus(data);setProfile(data.settings)}}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true}},[])
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Request failed')}finally{setBusy(false)}}
  const simulate=()=>run(async()=>{
    const next:Message[]=[...messages,{sender_type:'CUSTOMER',body:text.trim()}]
    const result=await call<Simulation>({action:'simulate',messages:next,form})
    setMessages(result.reply?[...next,{sender_type:'AI',body:result.reply}]:next)
    setText('');setSimulation(result)
  })
  return <>
    <Panel title="AI control center">
      {error&&<p role="alert" className="mb-3 text-warn">{error}</p>}
      {notice&&<p role="status" className="mb-3 text-ice">{notice}</p>}
      {!status||!profile?<SecondaryButton disabled={busy} onClick={()=>void run(load)}>Load live configuration</SecondaryButton>:<div className="space-y-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-cc-muted">Configured model</dt><dd className="break-all font-semibold">{status.configured_model}</dd></div>
          <div><dt className="text-cc-muted">Last observed model</dt><dd>{status.recent_runs.find(r=>r.model_id)?.model_id??'No model call recorded'}</dd></div>
          <div><dt className="text-cc-muted">Provider / prompt</dt><dd>{status.provider} / {status.prompt_version}</dd></div>
          <div><dt className="text-cc-muted">Context</dt><dd>Latest {status.context_message_limit} messages + saved facts, form, quotes, jobs and verified payments</dd></div>
        </dl>
        <details><summary className="cursor-pointer py-2 font-semibold">Protected rules and tools</summary><ul className="mt-2 space-y-2 text-sm text-cc-muted">{status.immutable_rules.map(rule=><li key={rule}>{rule}</li>)}</ul><p className="mt-3 text-sm">Maps credential: {status.maps_key_configured?'Configured':'Missing'}. Availability is confirmed by a successful route, not just a key.</p></details>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Tone<select aria-label="AI tone" className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-raised p-3" value={profile.tone} onChange={e=>setProfile({...profile,tone:e.target.value})}>{['WARM','DIRECT','PROFESSIONAL'].map(v=><option key={v}>{v}</option>)}</select></label>
          <label className="text-sm">Model<select aria-label="AI model" className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-raised p-3" value={profile.model??''} onChange={e=>setProfile({...profile,model:e.target.value||null})}><option value="">Server default ({status.configured_model})</option>{[...new Set([...(profile.model?[profile.model]:[]),...models])].map(v=><option key={v}>{v}</option>)}</select></label>
        </div>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={profile.concise} onChange={e=>setProfile({...profile,concise:e.target.checked})}/>Prefer concise responses</label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={profile.review_enabled} onChange={e=>setProfile({...profile,review_enabled:e.target.checked})}/>Review conversations every three days</label>
        <p className="text-sm text-cc-muted">Reviews produce recommendations only. An administrator must approve settings changes. Model changes are tested for structured-response compatibility before saving.</p>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton disabled={busy} onClick={()=>void run(async()=>{const result=await call<{models:string[]}>({action:'models'});setModels(result.models);setNotice('Model list verified against the connected provider.')})}>Check available models</SecondaryButton>
          <PrimaryButton disabled={busy} onClick={()=>void run(async()=>{await call({action:'save',expected_version:profile.version,settings:profile});await load();setNotice('Saved. Protected business rules were not changed.')})}>{busy?'Working…':'Save AI settings'}</PrimaryButton>
        </div>
      </div>}
    </Panel>
    <Panel title="Conversation sandbox · no SMS">
      <p className="mb-4 text-sm text-cc-muted">Uses the production AI engine, current prices and Google routing. No messages, quotes or customer records are changed. AI and Maps API usage may apply.</p>
      <TextArea label="Optional form information" value={form} onChange={setForm} rows={2}/>
      <div className="my-4 flex flex-wrap gap-2">{['I need 10 tons of flexbase','839 S Good Latimer Expy\nDallas, TX 75226\nUnited States','Yes','How much to build a pond?'].map(example=><SecondaryButton key={example} size="sm" disabled={busy} onClick={()=>setText(example)}>{example.startsWith('839')?'Full address':example}</SecondaryButton>)}</div>
      <div aria-live="polite" className="max-h-80 space-y-3 overflow-y-auto">{messages.map((m,i)=><div key={i} className={`rounded-xl border border-line p-3 text-sm ${m.sender_type==='AI'?'bg-ice/10':'bg-raised'}`}><span className="font-semibold">{m.sender_type==='AI'?'AI':'Test customer'}: </span>{m.body}</div>)}</div>
      <div className="mt-4"><TextArea label="Test message" value={text} onChange={setText} rows={2}/></div>
      <div className="mt-3 flex gap-2"><PrimaryButton disabled={busy||!text.trim()||!status||messages.length>=79} onClick={()=>void simulate()}>{busy?'Testing…':'Test response'}</PrimaryButton><SecondaryButton disabled={busy} onClick={()=>{setMessages([]);setSimulation(null);setForm('');setText('')}}>Reset test</SecondaryButton></div>
      {simulation&&<div className="mt-4 space-y-3 text-sm"><p className={simulation.blocked?'text-warn':'text-ice'}>{simulation.blocked?`Human review: ${simulation.blocked}`:`Action: ${simulation.decision.recommended_action}`}</p><dl>{simulation.decision.known_facts.map((f,i)=><div key={i} className="flex flex-wrap gap-2"><dt className="text-cc-muted">{f.key.replaceAll('_',' ')}:</dt><dd>{f.value}</dd></div>)}</dl><p>Still needed: {simulation.decision.missing_facts.join(', ')||'None'}</p><details><summary className="cursor-pointer py-2">Deterministic tool results</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-raised p-3 text-xs">{JSON.stringify(simulation.tool_results,null,2)}</pre></details></div>}
    </Panel>
    <Panel title="Review & change history">
      <p className="mb-3 text-sm text-cc-muted">Latest 20 entries. Full history is retained. Last review: {profile?.last_review_at?new Date(profile.last_review_at).toLocaleString():'Not run yet'}.</p>
      <SecondaryButton disabled={busy||!status} onClick={()=>void run(async()=>{const result=await call<{skipped?:boolean}>({action:'review'});await load();setNotice(result.skipped?'The three day review is not due yet.':'Conversation review completed. No rules were changed.')})}>Run due review</SecondaryButton>
      <div className="mt-4 divide-y divide-line">{status?.history.map(entry=><div key={entry.id} className="space-y-2 py-4 text-sm"><p className="font-semibold">{entry.kind} · {new Date(entry.created_at).toLocaleString()}</p><p>{entry.summary}</p>{entry.findings.map(f=><p key={f.code} className="text-cc-muted">{f.count} {f.code.toLowerCase().replaceAll('_',' ')}: {f.recommendation}</p>)}{entry.before_settings&&<SecondaryButton size="sm" disabled={busy} onClick={()=>void run(async()=>{await call({action:'rollback',history_id:entry.id,expected_version:profile?.version});await load();setNotice('Earlier presentation settings restored as a new audited version.')})}>Restore previous settings</SecondaryButton>}</div>)}</div>
    </Panel>
  </>
}
