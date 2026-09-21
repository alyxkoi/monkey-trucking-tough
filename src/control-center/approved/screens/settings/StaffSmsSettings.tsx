import { useEffect, useRef, useState } from 'react'
import { controlDb } from '@/control-center/data'
import { supabase } from '@/integrations/supabase/client'
import { useDemoMode } from '@/control-center/demo/DemoMode'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SecondaryButton } from '@/control-center/approved/components/ui/Button'

type Settings = { name: string; phone: string; enabled: boolean; new_lead: boolean; quote_accepted: boolean; salvador_needed: boolean; opted_out_at: string | null }
type Log = { message_id: string; event_type: string; state: string; delivery_status: string; last_error: string | null; created_at: string }
const defaults: Settings = {name:'Salvador',phone:'+12146778466',enabled:true,new_lead:true,quote_accepted:true,salvador_needed:true,opted_out_at:null}
const switches = [['enabled','Staff SMS Notifications'],['new_lead','New Lead'],['quote_accepted','Quote Accepted'],['salvador_needed','Salvador Needed']] as const

export function StaffSmsSettings() {
  const demo=useDemoMode()
  const [settings,setSettings]=useState<Settings | null>(null)
  const [logs,setLogs]=useState<Log[]>([])
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const requestId=useRef<string | null>(null)
  async function load() {
    if(demo.enabled){setSettings(defaults);return}
    const [s,l]=await Promise.all([controlDb.from('staff_sms_settings').select('*').eq('id',1).single(),controlDb.from('staff_sms_outbox').select('message_id,event_type,state,delivery_status,last_error,created_at').order('created_at',{ascending:false}).limit(8)])
    if(s.error||l.error)throw new Error(s.error?.message??l.error?.message)
    setSettings(s.data as Settings);setLogs(l.data as Log[])
  }
  useEffect(()=>{void load().catch(e=>setError(e.message))},[demo.enabled]) // eslint-disable-line react-hooks/exhaustive-deps
  async function toggle(key:typeof switches[number][0]) {
    if(!settings||busy)return
    setBusy(true);setError('')
    const next={...settings,[key]:!settings[key]}
    try {
      if(!demo.enabled){const result=await controlDb.rpc('save_staff_sms_settings',{p_enabled:next.enabled,p_new_lead:next.new_lead,p_quote_accepted:next.quote_accepted,p_salvador_needed:next.salvador_needed});if(result.error)throw new Error(result.error.message)}
      setSettings(next)
    }catch(e){setError(e instanceof Error?e.message:'Settings could not be saved')}finally{setBusy(false)}
  }
  async function test() {
    if(busy)return
    setBusy(true);setError('');setNotice('')
    try {
      if(demo.enabled){setNotice('Demo only. No SMS sent.');return}
      requestId.current??=crypto.randomUUID()
      const result=await supabase.functions.invoke('send-sms',{body:{action:'staff-test',requestId:requestId.current}})
      if(result.error)throw new Error(result.error.message)
      if(result.data?.last_error)throw new Error(result.data.last_error)
      setNotice(`Test ${String(result.data?.delivery_status??result.data?.state??'queued').toLowerCase()}. Delivery status is shown below.`)
      requestId.current=null
      await load()
    }catch(e){setError(e instanceof Error?e.message:'Test failed; retry checks the same request')}finally{setBusy(false)}
  }
  return <Panel title="Staff SMS Notifications">
    <div className="space-y-4">
      <p className="text-sm text-cc-muted">{settings?.name??'Salvador'} · {settings?.phone??'+12146778466'}<br/>Internal alerts only. Dashboard alerts remain visible when SMS is off.</p>
      {settings&&switches.map(([key,label])=><label key={key} className="flex justify-between items-center gap-4 py-2 text-sm"><span>{label}</span><input type="checkbox" role="switch" aria-label={label} checked={settings[key]} disabled={busy} onChange={()=>void toggle(key)} className="h-5 w-5 accent-lime-400"/></label>)}
      {settings?.opted_out_at&&<p className="text-warn text-sm">Staff number opted out. Reply START from that phone to resume; toggles do not override STOP.</p>}
      <div className="flex flex-wrap gap-3"><SecondaryButton disabled={busy||!settings?.enabled||Boolean(settings?.opted_out_at)} onClick={()=>void test()}>Send Test Notification</SecondaryButton><SecondaryButton disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>Refresh status</SecondaryButton></div>
      {error&&<p role="alert" className="text-red-400 text-sm">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
      <details className="text-sm"><summary>Recent internal notifications</summary><div className="mt-3 space-y-3">{logs.length===0?'No internal notifications yet.':logs.map(log=><div key={log.message_id}><p>{log.event_type.replaceAll('_',' ')} · {log.delivery_status==='PENDING'?log.state:log.delivery_status}</p><p className="text-cc-muted">{new Date(log.created_at).toLocaleString()}{log.last_error?` · ${log.last_error}`:''}</p></div>)}</div></details>
    </div>
  </Panel>
}
