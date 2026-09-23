import { useCallback, useEffect, useRef, useState } from 'react'
import { controlDb } from '@/control-center/data'
import { supabase } from '@/integrations/supabase/client'
import { useDemoMode } from '@/control-center/demo/DemoMode'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { Toggle } from '@/control-center/approved/components/ui/Toggle'
import { STAFF_ALERT_GROUPS, defaultStaffPreferences, type StaffAlertType } from '@/control-center/staffAlerts'

type Settings = { name: string; phone: string; enabled: boolean; new_lead: boolean; quote_accepted: boolean; salvador_needed: boolean; opted_out_at: string | null; preferences?:Partial<Record<StaffAlertType,boolean>> }
type Log = { message_id: string; event_type: string; state: string; delivery_status: string; last_error: string | null; created_at: string }
const defaults: Settings = {name:'Salvador',phone:'+12146778466',enabled:true,new_lead:true,quote_accepted:true,salvador_needed:true,opted_out_at:null}

export function StaffSmsSettings() {
  const demo=useDemoMode()
  const [settings,setSettings]=useState<Settings | null>(null)
  const [logs,setLogs]=useState<Log[]>([])
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const requestId=useRef<string | null>(null)
  const mounted=useRef(false),saving=useRef(false),loadEpoch=useRef(0)
  const load=useCallback(async () => {
    const epoch=++loadEpoch.current
    if(demo.enabled){setSettings(defaults);return}
    const [s,l]=await Promise.all([controlDb.from('staff_sms_settings').select('*').eq('id',1).single(),controlDb.from('staff_sms_outbox').select('message_id,event_type,state,delivery_status,last_error,created_at').order('created_at',{ascending:false}).limit(8)])
    if(s.error||l.error)throw new Error(s.error?.message??l.error?.message)
    if(mounted.current&&epoch===loadEpoch.current&&!saving.current){setSettings(s.data as Settings);setLogs(l.data as Log[])}
  },[demo.enabled])
  useEffect(()=>{
    let disposed=false,loading=false
    mounted.current=true
    const refresh=async()=>{if(loading||disposed||saving.current||document.hidden)return;loading=true;try{await load()}catch(e){if(!disposed)setError(e instanceof Error?e.message:'Status could not load')}finally{loading=false}}
    void refresh()
    const timer=window.setInterval(()=>void refresh(),10_000)
    const returned=()=>void refresh()
    document.addEventListener('visibilitychange',returned);window.addEventListener('online',returned)
    return ()=>{disposed=true;mounted.current=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',returned);window.removeEventListener('online',returned)}
  },[load])
  const preferences={...defaultStaffPreferences,...settings?.preferences,NEW_LEAD:settings?.new_lead??true,QUOTE_ACCEPTED:settings?.quote_accepted??true,SALVADOR_NEEDED:settings?.salvador_needed??true}
  async function toggle(key:StaffAlertType|'enabled') {
    if(!settings||busy)return
    saving.current=true;++loadEpoch.current
    setBusy(true);setError('')
    const prefs={...preferences,...(key==='enabled'?{}:{[key]:!preferences[key]})}
    const next={...settings,enabled:key==='enabled'?!settings.enabled:settings.enabled,new_lead:prefs.NEW_LEAD,quote_accepted:prefs.QUOTE_ACCEPTED,salvador_needed:prefs.SALVADOR_NEEDED,preferences:prefs}
    try {
      if(!demo.enabled){const result=await controlDb.rpc('save_staff_sms_preferences',{p_enabled:next.enabled,p_preferences:prefs});if(result.error)throw new Error(result.error.message)}
      if(mounted.current)setSettings(next)
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Settings could not be saved')}finally{saving.current=false;if(mounted.current)setBusy(false)}
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
  return <Panel title="Staff SMS Alerts">
    <div className="space-y-4">
      <p className="text-sm text-cc-muted">{settings?.name??'Salvador'} · {settings?.phone??'+12146778466'}<br/>Internal alerts only. Dashboard alerts remain visible when SMS is off.</p>
      {settings&&<>
        <Toggle label="Alerts enabled" value={settings.enabled} disabled={busy} onChange={()=>void toggle('enabled')}/>
        {STAFF_ALERT_GROUPS.map(group=><section key={group.title} className="space-y-4 border-t border-line pt-4"><h3 className="font-label text-xs uppercase tracking-widest text-cc-muted">{group.title}</h3>{group.items.map(([key,label])=><Toggle key={key} label={label} value={preferences[key]} disabled={busy} onChange={()=>void toggle(key)}/>)}</section>)}
      </>}
      {settings?.opted_out_at&&<p className="text-warn text-sm">Staff number opted out. Reply START from that phone to resume; toggles do not override STOP.</p>}
      <div className="flex flex-wrap gap-3"><SecondaryButton disabled={busy||!settings?.enabled||Boolean(settings?.opted_out_at)} onClick={()=>void test()}>Send Test Alert</SecondaryButton></div>
      {error&&<p role="alert" className="text-red-400 text-sm">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
      <details className="text-sm"><summary className="cursor-pointer py-3">Recent staff notifications</summary><p className="text-cc-muted">Delivery status updates automatically while this page is open.</p><div className="mt-3 space-y-3">{logs.length===0?'No internal notifications yet.':logs.map(log=><div key={log.message_id}><p>{log.event_type.replaceAll('_',' ')} · {log.delivery_status==='PENDING'?log.state:log.delivery_status}</p><p className="text-cc-muted">{new Date(log.created_at).toLocaleString()}{log.last_error?` · ${log.last_error}`:''}</p></div>)}</div></details>
    </div>
  </Panel>
}
