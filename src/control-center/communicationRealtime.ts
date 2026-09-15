import { supabase } from '@/integrations/supabase/client'
import type { ControlData, Customer, Lead, LeadMessage } from './data'

export const COMMUNICATION_REALTIME_RECONCILE_MS = 75
export const COMMUNICATION_MESSAGE_FALLBACK_MS = 5_000
const COMMUNICATION_MESSAGE_LOOKBACK_MS = 60_000
const COMMUNICATION_MESSAGE_OVERLAP_MS = 1_000

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
  pollMessages?: (updatedSince: string) => Promise<RealtimeRow[]>
}

async function loadRecentlyUpdatedMessages(updatedSince: string): Promise<RealtimeRow[]> {
  const result = await supabase
    .from('lead_messages')
    .select('*')
    .gte('updated_at', updatedSince)
    .order('updated_at', { ascending: true })
  if (result.error) throw result.error
  return (result.data ?? []) as unknown as RealtimeRow[]
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

/** Realtime is primary; a small message-only poll closes missed-event and connection gaps. */
export function subscribeToCommunicationChanges({
  refresh,
  applyChange,
  pollMessages = loadRecentlyUpdatedMessages,
}: CommunicationRealtimeOptions) {
  let disposed = false
  let dirty = false
  let running = false
  let polling = false
  let subscribedOnce = false
  let pollCursor = Date.now() - COMMUNICATION_MESSAGE_LOOKBACK_MS
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
  const poll = async () => {
    if (disposed || polling || !navigator.onLine || document.visibilityState !== 'visible') return
    polling = true
    const startedAt = Date.now()
    try {
      const messages = await pollMessages(new Date(pollCursor).toISOString())
      if (disposed) return
      for (const message of messages) {
        applyChange?.({ table: 'lead_messages', eventType: 'UPDATE', new: message, old: {} })
      }
      // Keep a small overlap so writes committed on the cursor boundary cannot be skipped.
      pollCursor = Math.max(pollCursor, startedAt - COMMUNICATION_MESSAGE_OVERLAP_MS)
    } catch {
      // Realtime and the normal dashboard refresh remain active; retry on the next tick.
    } finally {
      polling = false
    }
  }
  const channel = supabase.channel('control-center-communications')
  for (const table of ['lead_messages', 'leads', 'customers', 'communication_jobs', 'sms_outbox', 'activity_history', 'quotes', 'jobs', 'invoices', 'payments']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, changed)
  }
  channel.subscribe((status) => {
    if (disposed) return
    if (status !== 'SUBSCRIBED') {
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) void poll()
      return
    }
    if (!subscribedOnce) {
      subscribedOnce = true
      // The initial query is already loading; the five-second poll closes this one connection race.
      return
    }
    // Reconcile every reconnect in case a non-message row changed while disconnected.
    dirty = true
    schedule()
  })
  const resume = () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    dirty = true
    schedule()
    void poll()
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', resume)
  const pollTimer = setInterval(() => void poll(), COMMUNICATION_MESSAGE_FALLBACK_MS)
  return () => {
    disposed = true
    clearTimeout(timer)
    clearInterval(pollTimer)
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('online', resume)
    void supabase.removeChannel(channel)
  }
}
