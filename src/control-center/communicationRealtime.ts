import { supabase } from '@/integrations/supabase/client'

/** One subscription, burst coalescing and a trailing refresh for mid-fetch events. */
export function subscribeToCommunicationChanges(refresh: () => Promise<void>) {
  let disposed = false
  let dirty = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const drain = async () => {
    timer = undefined
    if (disposed || running || !dirty || !navigator.onLine || document.visibilityState !== 'visible') return
    dirty = false
    running = true
    try { await refresh() } catch { /* normal dashboard error and 3-minute retry remain */ }
    finally { running = false; if (dirty && !disposed) schedule() }
  }
  const schedule = () => {
    if (!disposed && !timer && !running) timer = setTimeout(() => void drain(), 300)
  }
  const changed = () => { dirty = true; schedule() }
  const channel = supabase.channel('control-center-communications')
  for (const table of ['lead_messages','leads','customers','communication_jobs','sms_outbox']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, changed)
  }
  channel.subscribe()
  document.addEventListener('visibilitychange', schedule)
  window.addEventListener('online', schedule)
  return () => {
    disposed = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', schedule)
    window.removeEventListener('online', schedule)
    void supabase.removeChannel(channel)
  }
}
