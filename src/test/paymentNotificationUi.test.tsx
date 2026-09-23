import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordPaymentSheet } from '@/control-center/approved/components/money/MoneySheets'
import { StaffSmsSettings } from '@/control-center/approved/screens/settings/StaffSmsSettings'

const mock=vi.hoisted(()=>({record:vi.fn(),rpc:vi.fn(),invoke:vi.fn()}))
const invoice={id:'invoice',number:'I1',customerId:'customer',amount:103,subtotalAmount:100,processingFeeAmount:3,status:'SENT',createdAt:Date.now()}
vi.mock('@/control-center/approved/state/AppState',()=>({useAppState:()=>({invoices:[invoice],payments:[],invoiceById:()=>invoice,customerById:()=>({name:'Fixture'}),recordPayment:mock.record})}))
vi.mock('@/control-center/demo/DemoMode',()=>({useDemoMode:()=>({enabled:false})}))
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:mock.invoke}}}))
vi.mock('@/control-center/data',()=>({controlDb:{rpc:mock.rpc,from:(table:string)=>{
 const value={data:table==='staff_sms_settings'?{name:'Salvador',phone:'+12146778466',enabled:true,new_lead:true,quote_accepted:true,salvador_needed:true,opted_out_at:null}:[],error:null}
 const chain={select:()=>chain,eq:()=>chain,order:()=>chain,single:()=>Promise.resolve(value),limit:()=>Promise.resolve(value)}
 return chain
}}}))
beforeEach(()=>{vi.clearAllMocks();mock.record.mockResolvedValue(undefined);mock.rpc.mockResolvedValue({error:null});mock.invoke.mockResolvedValue({data:{delivery_status:'DELIVERED'},error:null})})
afterEach(cleanup)

describe('manual payment and staff settings controls',()=>{
 it('defaults manual fee to zero and saves the actual edited partial payment',async()=>{
  const close=vi.fn();render(<RecordPaymentSheet open invoiceId="invoice" onClose={close}/>)
  const fee=screen.getByLabelText(/Processing fee \(\$\)/),amount=screen.getByLabelText('Amount actually received ($)')
  expect(fee).toHaveValue('0');expect(amount).toHaveValue('100')
  fireEvent.change(fee,{target:{value:'5'}});expect(amount).toHaveValue('105')
  fireEvent.change(amount,{target:{value:'40'}})
  expect(screen.getByText('Balance after this payment: $65.00')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Confirm Payment'}))
  await waitFor(()=>expect(mock.record).toHaveBeenCalledWith(expect.objectContaining({amount:40,processingFee:5,method:'ZELLE',expectedTotal:103})))
  expect(close).toHaveBeenCalledTimes(1)
 })
 it('keeps failed payment visible and retries the same request without duplicate operations',async()=>{
  mock.record.mockRejectedValueOnce(new Error('Temporarily unavailable'))
  const close=vi.fn();render(<RecordPaymentSheet open invoiceId="invoice" onClose={close}/>)
  fireEvent.click(screen.getByRole('button',{name:'Confirm Payment'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Temporarily unavailable');expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Confirm Payment'}))
  await waitFor(()=>expect(close).toHaveBeenCalledOnce())
  expect(mock.record.mock.calls[0][0].requestId).toBe(mock.record.mock.calls[1][0].requestId)
 })
 it('persists toggles and sends a test without a lead/customer identifier',async()=>{
  render(<StaffSmsSettings/>);const toggle=await screen.findByRole('switch',{name:'New Lead'})
  fireEvent.click(toggle)
  await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('save_staff_sms_preferences',{p_enabled:true,p_preferences:expect.objectContaining({NEW_LEAD:false,QUOTE_READY:true,SALVADOR_NEEDED:true})}))
  expect(screen.queryByRole('button',{name:'Refresh status'})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Send Test Alert'}))
  await waitFor(()=>expect(mock.invoke).toHaveBeenCalledWith('send-sms',{body:{action:'staff-test',requestId:expect.any(String)}}))
  expect(await screen.findByRole('status')).toHaveTextContent('delivered')
 })
})
