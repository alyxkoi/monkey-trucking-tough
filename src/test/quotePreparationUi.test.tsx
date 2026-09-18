import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QuoteScreen } from '@/control-center/approved/screens/QuoteScreen'
import { LeadsQuotes } from '@/control-center/approved/screens/LeadsQuotes'
import { sortSales } from '@/control-center/approved/state/salesSort'
import type { AttentionItem } from '@/control-center/approved/state/attention'

// Partial provider fixture; unrelated dashboard actions are intentionally absent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocks = vi.hoisted(() => ({ state: {} as any, confirm: vi.fn(), send: vi.fn() }))
vi.mock('@/control-center/approved/state/AppState', () => ({ useAppState: () => mocks.state }))
vi.mock('@/control-center/approved/components/sales/MaterialSheet', () => ({ MaterialSheet: () => null }))
vi.mock('@/control-center/approved/components/sales/CustomWorkSheet', () => ({ CustomWorkSheet: () => null }))
vi.mock('@/control-center/approved/components/sales/DeliverySheet', () => ({ DeliverySheet: () => null }))
vi.mock('@/control-center/approved/components/jobs/ScheduleJobSheet', () => ({ ScheduleJobSheet: () => null }))

function quoteView() { return <MemoryRouter initialEntries={['/admin/quotes/q']}><Routes><Route path="/admin/quotes/:quoteId" element={<QuoteScreen />} /></Routes></MemoryRouter> }
beforeEach(() => {
  mocks.confirm.mockReset(); mocks.send.mockReset()
  mocks.state = {
    quoteById: () => ({id:'q',number:'Q1',customerId:'c',leadId:'l',status:'DRAFT',description:'Delivery',address:'123 Oak',materialLines:[],customLines:[{id:'work',label:'Grading',amount:100}],delivery:{mode:'FREE'},deliveryLoads:1,taxRate:0,taxOnDelivery:false,customWorkTax:'EXEMPT'}),
    customerById: () => ({id:'c',name:'Mike',email:'profile@example.com'}),
    sourceData:{quotes:[{id:'q',confirmed_email:null}]}, confirmQuoteRecipient:mocks.confirm,sendQuote:mocks.send,
    leads:[],quotes:[],attention:[],setPinnedBarActive:vi.fn(),
  }
})
afterEach(cleanup)

describe('quote recipient confirmation UI', () => {
  it('does not present profile email as confirmed; staff can confirm and send', async () => {
    const view=render(quoteView())
    expect(screen.getByRole('button',{name:'Send Quote'})).toBeDisabled()
    expect(screen.getByRole('textbox',{name:/Recipient email/})).toHaveValue('profile@example.com')
    mocks.confirm.mockImplementation(async (_id,email)=> {mocks.state.sourceData.quotes[0].confirmed_email=email})
    fireEvent.click(screen.getByRole('button',{name:'Confirm recipient'}))
    await waitFor(()=>expect(mocks.confirm).toHaveBeenCalledWith('q','profile@example.com'))
    view.rerender(quoteView())
    await waitFor(()=>expect(screen.getByRole('button',{name:'Send Quote'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Send Quote'}))
    expect(mocks.send).toHaveBeenCalledWith('q')
  })
  it('requires confirmation again for a staff-edited alternate recipient', async () => {
    mocks.state.sourceData.quotes[0].confirmed_email='profile@example.com'
    render(quoteView())
    fireEvent.change(screen.getByRole('textbox',{name:/Recipient email/}),{target:{value:'alternate@example.com'}})
    expect(screen.getByRole('button',{name:'Send Quote'})).toBeDisabled()
    mocks.confirm.mockRejectedValueOnce(new Error('Could not save recipient'))
    fireEvent.click(screen.getByRole('button',{name:'Confirm recipient'}))
    await screen.findByRole('alert')
    expect(screen.getByRole('button',{name:'Send Quote'})).toBeDisabled()
    expect(mocks.state.customerById().email).toBe('profile@example.com')
  })
  it('opens an AI-prepared confirmed quote ready for staff to review/send', () => {
    mocks.state.sourceData.quotes[0].confirmed_email='alternate@example.com'
    render(quoteView())
    expect(screen.queryByRole('button',{name:'Confirm recipient'})).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Send Quote'})).toBeEnabled()
  })
})

describe('Leads and Quotes sorting', () => {
  it('defaults to newest activity and offers the existing urgency ordering', () => {
    render(<MemoryRouter><LeadsQuotes /></MemoryRouter>)
    const select=screen.getByRole('combobox',{name:'Sort leads and quotes'})
    expect(select).toHaveValue('NEWEST')
    fireEvent.change(select,{target:{value:'URGENT'}})
    expect(select).toHaveValue('URGENT')
  })
  it('sorts by meaningful activity or the existing attention queue without mutating records', () => {
    const rows=[{id:'old',at:1},{id:'new',at:3},{id:'middle',at:2}]
    const describe=(row:typeof rows[number])=>({at:row.at,paths:[`/admin/leads/${row.id}`]})
    const attention:AttentionItem[]=[{id:'urgent',kind:'customer_waiting',priority:'NOW',title:'Waiting',context:'',since:1,action:{label:'Reply',to:'/admin/leads/old?focus=reply'},recommend:'reply'}]
    expect(sortSales(rows,'NEWEST',attention,describe).map(r=>r.id)).toEqual(['new','middle','old'])
    expect(sortSales(rows,'URGENT',attention,describe).map(r=>r.id)).toEqual(['old','new','middle'])
    expect(rows.map(r=>r.id)).toEqual(['old','new','middle'])
  })
})
