import { supabase } from '@/integrations/supabase/client'
import type { ControlData, Customer, Lead, LeadMessage } from './data'

export const COMMUNICATION_REALTIME_RECONCILE_MS = 75

type RealtimeRow = Record<string, unknown>

export type CommunicationRealtimeChange = {
  table: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: RealtimeRow
  old: RealtimeRow
}

type CommunicationRealtimeOptions = {
  refresh: () => Promise<void>
  applyChange?: (change: CommunicationRealtimeChange) => void
}

function compareDate(left: string | undefined, right: string | undefined, ascending: boolean) {
  const difference = new Date(left ?? 0).getTime() - new Date(right ?? 0).getTime()
  return ascending ? difference : -difference
}

function mergeRow<Row extends { id: string }>(
  rows: Row[],
  change: CommunicationRealtimeChange,
  sort: (left: Row, right: Row) => number,
) {
  const incoming = (change.eventType === 'DELETE' ? change.old : change.new) as Partial<Row>
  if (typeof incoming.id !== 'string') return rows

  if (change.eventType === 'DELETE') return rows.filter((row) => row.id !== incoming.id)

  const existingIndex = rows.findIndex((row) => row.id === incoming.id)
  const next = [...rows]
  if (existingIndex === -1) next.push(incoming as Row)
  else next[existingIndex] = { ...next[existingIndex], ...incoming }
  return next.sort(sort)
}

/** Apply committed database rows immediately so the conversation UI does not wait for a dashboard-wide refetch. */
export function applyCommunicationRealtimeChange(data: ControlData, change: CommunicationRealtimeChange): ControlData {
  if (change.table === 'lead_messages') {
    return {
      ...data,
      messages: mergeRow<LeadMessage>(data.messages, change, (left, right) =>
        compareDate(left.created_at, right.created_at, true)),
    }
  }
  if (change.table === 'leads') {
    return {
      ...data,
      leads: mergeRow<Lead>(data.leads, change, (left, right) =>
        compareDate(left.created_at, right.created_at, false)),
    }
  }
  if (change.table === 'customers') {
    return {
      ...data,
      customers: mergeRow<Customer>(data.customers, change, (left, right) =>
        compareDate(left.last_activity_at, right.last_activity_at, false)),
    }
  }
  return data
}

/** One subscription, instant row delivery, burst coalescing and a trailing reconciliation refresh. */
export function subscribeToCommunicationChanges({ refresh, applyChange }: CommunicationRealtimeOptions) {
  let disposed = false
  let dirty = false
  let running = false
  let subscribedOnce = false
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
    if (!disposed && !timer && !running) timer = setTimeout(() => void drain(), COMMUNICATION_REALTIME_RECONCILE_MS)
  }
  const changed = (change: CommunicationRealtimeChange) => {
    if (disposed) return
    applyChange?.(change)
    dirty = true
    schedule()
  }
  const channel = supabase.channel('control-center-communications')
  for (const table of ['lead_messages', 'leads', 'customers', 'communication_jobs', 'sms_outbox']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, changed)
  }
  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED' || disposed) return
    // The initial query is already loading when the first subscription connects.
    if (!subscribedOnce) {
      subscribedOnce = true
      return
    }
    // Reconcile every reconnect in case an event occurred while offline.
    dirty = true
    schedule()
  })
  const resume = () => {
    if (dirty) schedule()
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', resume)
  return () => {
    disposed = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('online', resume)
    void supabase.removeChannel(channel)
  }
}
