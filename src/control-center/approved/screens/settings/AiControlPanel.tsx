import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Panel } from '../../components/ui/Panel'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { TextArea } from '../../components/ui/Field'

type Profile = { model: string | null; tone: string; concise: boolean; review_enabled: boolean; version: number; last_review_at: string | null }
type Entry = { id: string; created_at: string; kind: string; summary: string; before_settings: Profile | null; findings: { code: string; count: number; recommendation: string }[] }
type Message = { sender_type: 'CUSTOMER' | 'AI'; body: string }
type Status = { settings: Profile; history: Entry[]; configured_model: string; provider: string; prompt_version: string; active_instructions?:string; context_message_limit: number; maps_key_configured: boolean; immutable_rules: string[]; recent_runs: { model_id: string | null; status: string; latency_ms: number; created_at: string }[] }
type Simulation = { reply: string | null; blocked: string | null; model: string; session_id:string; decision: { known_facts: {key:string;value:string}[];missing_facts:string[];recommended_action:string;subtask_escalations?:{topic:string;reason:string}[] }; tool_results: unknown }

async function call<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-control',{body})
  if (error || data?.error) {
    const detail = error && 'context' in error && error.context instanceof Response
      ? await error.context.json().catch(()=>null) : null
    throw new Error(data?.error || detail?.error || error?.message || 'AI request failed')
  }
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
  const [scenario,setScenario]=useState('LEAD')
  const [text,setText]=useState('')
  const [messages,setMessages]=useState<Message[]>([])
  const [simulation,setSimulation]=useState<Simulation|null>(null)
  const [sessionId,setSessionId]=useState(()=>crypto.randomUUID())
  const [sandboxError,setSandboxError]=useState('')
  const requestBusy=useRef(false)
  const disabledReason=busy?'A request is running.':!status?'Load the live configuration above to test.':messages.length>=79?'This test reached the context limit. Reset to start a new session.':!text.trim()?'Enter a customer message to test.':''
  const load=async()=>{const data=await call<Status>({action:'status'});setStatus(data);setProfile(data.settings)}
  useEffect(()=>{let cancelled=false;call<Status>({action:'status'}).then(data=>{if(!cancelled){setStatus(data);setProfile(data.settings)}}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true}},[])
  const run=async(action:()=>Promise<void>)=>{if(requestBusy.current)return;requestBusy.current=true;setBusy(true);setError('');setNotice('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Request failed')}finally{requestBusy.current=false;setBusy(false)}}
  const simulate=()=>run(async()=>{
    if(!text.trim()||!status||messages.length>=79)return
    setSandboxError('')
    const next:Message[]=[...messages,{sender_type:'CUSTOMER',body:text.trim()}]
    try {
      const result=await call<Simulation>({action:'simulate',messages:next,form,session_id:sessionId,scenario})
      setMessages(result.reply?[...next,{sender_type:'AI',body:result.reply}]:next)
      setText('');setSimulation(result)
    }catch(e){setSandboxError(e instanceof Error?e.message:'Test failed');setSimulation(null)}
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
    <Panel title="Active AI instructions">
      <p className="mb-3 text-sm font-semibold">{status?.prompt_version??'Load configuration'} · Read only</p><p className="mb-3 text-sm text-cc-muted">Effective server instructions including lifecycle policy and presentation preferences. Customer context and credentials are excluded.</p><textarea aria-label="Active AI instructions" readOnly value={status?.active_instructions??'Load the live configuration to view effective instructions.'} rows={14} className="w-full resize-y rounded-xl border border-line bg-raised p-4 font-mono text-xs leading-relaxed"/><p className="mt-3 text-sm">Can update verified contact details, delivery preferences, eligible draft quotes and job notes; prepare quotes; create staff priorities; pause for a human. Cannot send quotes, accept terms, verify payments or change accepted prices and confirmed calendar bookings.</p>
    </Panel>
    <Panel title="Conversation sandbox · no SMS">
      <p className="mb-4 text-sm text-cc-muted">Uses the production AI engine, current prices and Google routing. No messages, quotes or customer records are changed. AI and Maps API usage may apply.</p>
      <p className="mb-3 text-xs text-cc-muted">Isolated session {sessionId.slice(0,8)} · Messages stay in this test until Reset. Names never select a real customer.</p>
      <fieldset disabled={busy||messages.length>0}><label className="mb-3 block text-sm">Synthetic lifecycle scenario<select aria-label="Sandbox lifecycle" value={scenario} onChange={e=>setScenario(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-raised p-3">{['LEAD','QUOTE_SENT','ACCEPTED','SCHEDULED','COMPLETED','PAID'].map(value=><option key={value}>{value}</option>)}</select></label><TextArea label="Optional form information" value={form} onChange={setForm} rows={2}/></fieldset>
      {messages.length>0&&<p className="mt-2 text-xs text-cc-muted">Reset to change the starting form or test a different customer.</p>}
      <div className="my-4 flex flex-wrap gap-2">{['I need 10 tons of flexbase','839 S Good Latimer Expy\nDallas, TX 75226\nUnited States','Yes','How much to build a pond?'].map(example=><SecondaryButton key={example} size="sm" disabled={busy} onClick={()=>setText(example)}>{example.startsWith('839')?'Full address':example}</SecondaryButton>)}</div>
      <div aria-live="polite" className="max-h-80 space-y-3 overflow-y-auto">{messages.map((m,i)=><div key={i} className={`rounded-xl border border-line p-3 text-sm ${m.sender_type==='AI'?'bg-ice/10':'bg-raised'}`}><span className="font-semibold">{m.sender_type==='AI'?'AI':'Test customer'}: </span>{m.body}</div>)}</div>
      <fieldset disabled={busy} className="mt-4"><TextArea label="Test message" value={text} onChange={setText} rows={2}/></fieldset>
      {sandboxError&&<p role="alert" className="mt-3 text-sm text-warn">Test failed: {sandboxError}. Your unsent message is preserved; correct it or retry.</p>}
      <div className="mt-3 flex gap-2"><PrimaryButton disabled={Boolean(disabledReason)} onClick={()=>void simulate()}>{busy?'Testing…':'Test response'}</PrimaryButton><SecondaryButton disabled={busy} onClick={()=>{setMessages([]);setSimulation(null);setForm('');setText('');setSandboxError('');setSessionId(crypto.randomUUID())}}>Reset test</SecondaryButton></div>
      {disabledReason&&<p role="status" className="mt-2 text-xs text-cc-muted">{disabledReason}</p>}
      {simulation?.blocked&&<p role="status" className="mt-3 text-sm text-warn">Entire conversation blocked: {simulation.blocked}. You can enter another test message or reset; nothing is sent.</p>}
      {!!simulation?.decision.subtask_escalations?.length&&!simulation.blocked&&<p role="status" className="mt-3 text-sm text-ice">Subtask review only: custom work pricing needs Salvador. Standard material and delivery conversation remains active.</p>}
      {simulation&&<div className="mt-4 space-y-3 text-sm"><p className={simulation.blocked?'text-warn':'text-ice'}>{simulation.blocked?`Human review: ${simulation.blocked}`:`Action: ${simulation.decision.recommended_action}`}</p><dl>{simulation.decision.known_facts.map((f,i)=><div key={i} className="flex flex-wrap gap-2"><dt className="text-cc-muted">{f.key.replaceAll('_',' ')}:</dt><dd>{f.value}</dd></div>)}</dl><p>Still needed: {simulation.decision.missing_facts.join(', ')||'None'}</p><details><summary className="cursor-pointer py-2">Deterministic tool results</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-raised p-3 text-xs">{JSON.stringify(simulation.tool_results,null,2)}</pre></details></div>}
    </Panel>
    <Panel title="Review & change history">
      <p className="mb-3 text-sm text-cc-muted">Latest 20 entries. Full history is retained. Last review: {profile?.last_review_at?new Date(profile.last_review_at).toLocaleString():'Not run yet'}.</p>
      <SecondaryButton disabled={busy||!status} onClick={()=>void run(async()=>{const result=await call<{skipped?:boolean}>({action:'review'});await load();setNotice(result.skipped?'The three day review is not due yet.':'Conversation review completed. No rules were changed.')})}>Run due review</SecondaryButton>
      <div className="mt-4 divide-y divide-line">{status?.history.map(entry=><div key={entry.id} className="space-y-2 py-4 text-sm"><p className="font-semibold">{entry.kind} · {new Date(entry.created_at).toLocaleString()}</p><p>{entry.summary}</p>{entry.findings.map(f=><p key={f.code} className="text-cc-muted">{f.count} {f.code.toLowerCase().replaceAll('_',' ')}: {f.recommendation}</p>)}{entry.before_settings&&<SecondaryButton size="sm" disabled={busy} onClick={()=>void run(async()=>{await call({action:'rollback',history_id:entry.id,expected_version:profile?.version});await load();setNotice('Earlier presentation settings restored as a new audited version.')})}>Restore previous settings</SecondaryButton>}</div>)}</div>
    </Panel>
  </>
}
