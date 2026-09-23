import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { controlDb } from './data'

export function StaffAlertEntry() {
  const {code=''}=useParams()
  return <Navigate replace to={`/admin/alerts/${encodeURIComponent(code)}`}/>
}

/** Mounted only beneath the normal staff-authenticated dashboard layout. */
export function StaffAlertRedirect() {
  const {code=''}=useParams()
  const [target,setTarget]=useState<string|null>(null),[error,setError]=useState(false)
  useEffect(()=>{
    let disposed=false
    setTarget(null);setError(false)
    const resolve=async()=>{
      if(!/^[A-Z0-9]{10}$/i.test(code)){setError(true);return}
      const result=await controlDb.rpc('resolve_staff_alert_link',{p_code:code})
      if(disposed)return
      if(result.error||!result.data||!/^\/admin\/(?:leads|quotes|jobs|money\/invoices)\/[0-9a-f-]{36}$/.test(result.data))setError(true)
      else setTarget(result.data)
    }
    void resolve().catch(()=>{if(!disposed)setError(true)})
    return ()=>{disposed=true}
  },[code])
  if(target)return <Navigate replace to={target}/>
  return <p role={error?'alert':'status'}>{error?'This staff alert link is unavailable. Open the dashboard to review current work.':'Opening staff alert…'}</p>
}
