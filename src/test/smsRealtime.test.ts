import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyCommunicationRealtimeChange,
  COMMUNICATION_MESSAGE_FALLBACK_MS,
  COMMUNICATION_REALTIME_RECONCILE_MS,
  subscribeToCommunicationChanges,
  type CommunicationRealtimeChange,
} from '@/control-center/communicationRealtime'
import type { ControlData, Customer, Lead, LeadMessage } from '@/control-center/data'

type RealtimeCallback = (change: CommunicationRealtimeChange) => void
type StatusCallback = (status: string) => void
const mocks = vi.hoisted(() => ({
  callbacks: [] as RealtimeCallback[],
  remove: vi.fn(async () => undefined),
  statusCallback: undefined as StatusCallback | undefined,
  subscribe: vi.fn((callback?: StatusCallback) => { mocks.statusCallback = callback }),
}))

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: () => {
    const channel = {
      on: (_kind: string, _filter: unknown, callback: RealtimeCallback) => {
        mocks.callbacks.push(callback)
        return channel
      },
      subscribe: mocks.subscribe,
    }
    return channel
  },
  removeChannel: mocks.remove,
} }))

const baseData = (): ControlData => ({
  customers: [], leads: [], quotes: [], quoteItems: [], jobs: [], tickets: [], ticketItems: [], ticketHistory: [],
  invoices: [], invoiceTickets: [], payments: [], workers: [], workerPayments: [], activities: [], messages: [],
  financialHistory: [], materials: [], drivers: [], appSettings: null, userRoles: [], controlSettings: null,
  automations: [], trackingLinkGroups: [], trackingLinks: [], trackingIntegration: { status: 'READY', message: null },
  snoozes: [], aiConversationStates: [], aiAuditLogs: [], aiDrafts: [], aiIntegration: { status: 'READY', message: null },
  stripeIssues: [], stripeIntegration: { status: 'READY', message: null },
})

const change = (table: string, eventType: CommunicationRealtimeChange['eventType'], row: Record<string, unknown>): CommunicationRealtimeChange => ({
  table,
  eventType,
  new: eventType === 'DELETE' ? {} : row,
  old: eventType === 'DELETE' ? row : {},
})

beforeEach(() => {
  vi.useFakeTimers()
  mocks.callbacks.length = 0
  mocks.remove.mockClear()
  mocks.subscribe.mockClear()
  mocks.statusCallback = undefined
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})
afterEach(() => vi.useRealTimers())

describe('communication realtime cache changes', () => {
  it('inserts, updates and deletes messages in chronological order', () => {
    const earlier = { id: 'm1', created_at: '2026-09-14T10:00:00Z', body: 'first' } as LeadMessage
    const later = { id: 'm2', created_at: '2026-09-14T10:01:00Z', body: 'second' } as LeadMessage
    let data = { ...baseData(), messages: [later] }

    data = applyCommunicationRealtimeChange(data, change('lead_messages', 'INSERT', earlier))
    expect(data.messages.map((message) => message.id)).toEqual(['m1', 'm2'])

    data = applyCommunicationRealtimeChange(data, change('lead_messages', 'UPDATE', { ...later, body: 'delivered', delivery_status: 'DELIVERED' }))
    expect(data.messages[1]).toMatchObject({ id: 'm2', body: 'delivered', delivery_status: 'DELIVERED' })

    data = applyCommunicationRealtimeChange(data, change('lead_messages', 'DELETE', { id: 'm1' }))
    expect(data.messages.map((message) => message.id)).toEqual(['m2'])
  })

  it('keeps lead and customer ordering current', () => {
    const olderLead = { id: 'l1', created_at: '2026-09-13T10:00:00Z' } as Lead
    const newerLead = { id: 'l2', created_at: '2026-09-14T10:00:00Z' } as Lead
    const olderCustomer = { id: 'c1', last_activity_at: '2026-09-13T10:00:00Z' } as Customer
    const activeCustomer = { id: 'c2', last_activity_at: '2026-09-14T10:00:00Z' } as Customer
    let data = { ...baseData(), leads: [olderLead], customers: [olderCustomer] }

    data = applyCommunicationRealtimeChange(data, change('leads', 'INSERT', newerLead))
    data = applyCommunicationRealtimeChange(data, change('customers', 'INSERT', activeCustomer))

    expect(data.leads.map((lead) => lead.id)).toEqual(['l2', 'l1'])
    expect(data.customers.map((customer) => customer.id)).toEqual(['c2', 'c1'])
  })
})

describe('communications realtime lifecycle', () => {
  it('applies events immediately, coalesces reconciliation and cleans up', async () => {
    const refresh = vi.fn(async () => undefined)
    const applyChange = vi.fn()
    const stop = subscribeToCommunicationChanges({ refresh, applyChange })
    const payload = change('lead_messages', 'INSERT', { id: 'm1' })
    mocks.callbacks.forEach((callback) => callback(payload))

    expect(applyChange).toHaveBeenCalledTimes(5)
    expect(refresh).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(COMMUNICATION_REALTIME_RECONCILE_MS)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(mocks.subscribe).toHaveBeenCalledTimes(1)

    mocks.callbacks[0](payload)
    stop()
    await vi.advanceTimersByTimeAsync(COMMUNICATION_REALTIME_RECONCILE_MS)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
  })

  it('avoids duplicating the initial load and reconciles after reconnecting', async () => {
    const refresh = vi.fn(async () => undefined)
    const stop = subscribeToCommunicationChanges({ refresh })

    mocks.statusCallback?.('SUBSCRIBED')
    await vi.advanceTimersByTimeAsync(COMMUNICATION_REALTIME_RECONCILE_MS)
    expect(refresh).not.toHaveBeenCalled()
    mocks.statusCallback?.('SUBSCRIBED')
    await vi.advanceTimersByTimeAsync(COMMUNICATION_REALTIME_RECONCILE_MS)

    expect(refresh).toHaveBeenCalledTimes(1)
    stop()
  })

  it('polls only recent messages as a five-second fallback without overlapping', async () => {
    let finish!: (rows: Record<string, unknown>[]) => void
    const first = new Promise<Record<string, unknown>[]>((resolve) => { finish = resolve })
    const pollMessages = vi.fn().mockReturnValueOnce(first).mockResolvedValue([])
    const applyChange = vi.fn()
    const stop = subscribeToCommunicationChanges({
      refresh: vi.fn(async () => undefined),
      applyChange,
      pollMessages,
    })

    await vi.advanceTimersByTimeAsync(COMMUNICATION_MESSAGE_FALLBACK_MS * 2)
    expect(pollMessages).toHaveBeenCalledTimes(1)
    finish([{ id: 'm-fallback', created_at: '2026-09-14T10:00:00Z' }])
    await Promise.resolve()
    expect(applyChange).toHaveBeenCalledWith(expect.objectContaining({
      table: 'lead_messages', eventType: 'UPDATE', new: expect.objectContaining({ id: 'm-fallback' }),
    }))

    await vi.advanceTimersByTimeAsync(COMMUNICATION_MESSAGE_FALLBACK_MS)
    expect(pollMessages).toHaveBeenCalledTimes(2)
    stop()
  })

  it('reconciles and catches up immediately after connectivity returns', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const refresh = vi.fn(async () => undefined)
    const pollMessages = vi.fn(async () => [])
    const stop = subscribeToCommunicationChanges({ refresh, pollMessages })

    await vi.advanceTimersByTimeAsync(COMMUNICATION_MESSAGE_FALLBACK_MS)
    expect(pollMessages).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(COMMUNICATION_REALTIME_RECONCILE_MS)

    expect(pollMessages).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    stop()
  })

  it('performs a trailing refresh for an event during an in-flight refresh', async () => {
    let finish!: () => void
    const refresh = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve })).mockResolvedValue(undefined)
    const stop = subscribeToCommunicationChanges({ refresh })
    const payload = change('lead_messages', 'INSERT', { id: 'm1' })
    mocks.callbacks[0](payload)
    await vi.advanceTimersByTimeAsync(COMMUNICATION_REALTIME_RECONCILE_MS)
    mocks.callbacks[0](payload)
    finish()
    await vi.advanceTimersByTimeAsync(COMMUNICATION_REALTIME_RECONCILE_MS)
    expect(refresh).toHaveBeenCalledTimes(2)
    stop()
  })
})
