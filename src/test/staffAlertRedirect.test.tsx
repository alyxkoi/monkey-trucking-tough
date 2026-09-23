import {afterEach,describe,expect,it,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {MemoryRouter,Route,Routes} from 'react-router-dom'
import {StaffAlertEntry,StaffAlertRedirect} from '@/control-center/StaffAlertRedirect'
const rpc=vi.hoisted(()=>vi.fn())
vi.mock('@/control-center/data',()=>({controlDb:{rpc}}))
afterEach(()=>{cleanup();vi.clearAllMocks()})
describe('staff-only short link routing',()=>{
 it('public entry redirects to the normal protected route without reading a record',async()=>{
  render(<MemoryRouter initialEntries={['/a/012345ABCD']}><Routes><Route path="/a/:code" element={<StaffAlertEntry/>}/><Route path="/admin/alerts/:code" element={<p>Staff authentication gate</p>}/></Routes></MemoryRouter>)
  expect(await screen.findByText('Staff authentication gate')).toBeInTheDocument();expect(rpc).not.toHaveBeenCalled()
 })
 it('authenticated resolver redirects to its verified internal destination',async()=>{
  rpc.mockResolvedValue({data:'/admin/leads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',error:null})
  render(<MemoryRouter initialEntries={['/admin/alerts/012345ABCD']}><Routes><Route path="/admin/alerts/:code" element={<StaffAlertRedirect/>}/><Route path="/admin/leads/:id" element={<p>Correct lead</p>}/></Routes></MemoryRouter>)
  expect(await screen.findByText('Correct lead')).toBeInTheDocument();expect(rpc).toHaveBeenCalledWith('resolve_staff_alert_link',{p_code:'012345ABCD'})
 })
 it('rejects an external destination instead of creating an open redirect',async()=>{
  rpc.mockResolvedValue({data:'https://example.test/customer',error:null})
  render(<MemoryRouter initialEntries={['/admin/alerts/012345ABCD']}><Routes><Route path="/admin/alerts/:code" element={<StaffAlertRedirect/>}/></Routes></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
 })
})
