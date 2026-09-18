/* eslint-disable @typescript-eslint/no-explicit-any */
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {MemoryRouter,Route,Routes} from 'react-router-dom'
import {TicketBuilder} from '@/control-center/approved/screens/TicketBuilder'
import {JobDetail} from '@/control-center/approved/screens/JobDetail'
const mocks=vi.hoisted(()=>({state:{} as any,save:vi.fn()}))
vi.mock('@/control-center/approved/state/AppState',()=>({useAppState:()=>mocks.state}))
vi.mock('@/control-center/demo/DemoMode',()=>({useDemoMode:()=>({enabled:false})}))
vi.mock('@/control-center/approved/components/sales/MaterialSheet',()=>({MaterialSheet:({open,onAdd}:any)=>open?<button onClick={()=>onAdd('mat-4',{isFullLoad:false,yards:30})}>Use 30 yards</button>:null}))
const line={id:'line',materialId:'mat-4',materialName:'Flexbase First Class 1" or 3"',yards:25,isFullLoad:false,loads:null,rateUsed:38,lineTotal:950}
const job={id:'job',quoteId:'quote',customerId:'customer',address:'456 Delivery Road',description:'Material delivery',notes:'Use side gate',date:'2026-10-01',time:'13:00',allDay:false,status:'SCHEDULED',category:'MATERIAL_DELIVERY',photos:[],agreedAmount:1100}
const quote={id:'quote',number:'Q1001',customerId:'customer',status:'ACCEPTED',address:'123 Quote Road',materialLines:[line],customLines:[],delivery:{mode:'TIER_6_10'},deliveryLoads:2,taxRate:0}
function show(path='/admin/tickets/new?job=job') {return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/tickets/new" element={<TicketBuilder/>}/><Route path="/admin/tickets/:ticketId/edit" element={<TicketBuilder/>}/><Route path="/admin/jobs/:jobId" element={<JobDetail/>}/></Routes></MemoryRouter>)}
beforeEach(()=>{
 vi.clearAllMocks();mocks.save.mockResolvedValue('saved')
 mocks.state={booting:false,sync:'synced',customers:[],customerById:()=>({id:'customer',name:'Mike',phone:'2145550000'}),jobById:()=>job,quoteById:()=>quote,ticketById:()=>undefined,ticketsForJob:()=>[],invoiceForJob:()=>undefined,leadsForCustomer:()=>[],setPinnedBarActive:vi.fn(),saveTicket:mocks.save,sourceData:{materials:[{is_active:true}],appSettings:{tax_enabled:false,tax_rate:0,delivery_tier_1_fee:0,delivery_tier_2_fee:60,delivery_tier_3_fee:100,delivery_overage_base_fee:100,delivery_overage_per_mile:10}}}
})
describe('job material display and editable ticket workflow',()=>{
 it('shows all accepted material and yard details on the actual job page',()=>{
   mocks.state.quoteById=()=>({...quote,materialLines:[line,{...line,id:'sand',materialName:'Sand',yards:40,loads:2,isFullLoad:true}]})
   show('/admin/jobs/job')
   expect(screen.getByRole('heading',{name:'Material order'})).toBeInTheDocument()
   expect(screen.getByText(line.materialName)).toBeInTheDocument();expect(screen.getByText('25 yards')).toBeInTheDocument()
   expect(screen.getByText('40 yards · 2 full loads')).toBeInTheDocument()
   expect(screen.getAllByRole('button',{name:'Create Ticket'}).length).toBeGreaterThan(0)
 })
 it('prefills the accepted order, edits it, and prevents duplicate save clicks',async()=>{
   const before=structuredClone(quote);show()
   expect(screen.getByRole('textbox',{name:'Job site address'})).toHaveValue(job.address)
   expect(screen.getByText(line.materialName)).toBeInTheDocument()
   expect(screen.getByDisplayValue(job.notes)).toBeInTheDocument()
   fireEvent.change(screen.getByRole('textbox',{name:'Job site address'}),{target:{value:'789 Corrected Road'}})
   fireEvent.click(screen.getByRole('button',{name:'Remove line'}))
   fireEvent.click(screen.getByRole('button',{name:'Add material'}));fireEvent.click(screen.getByRole('button',{name:'Use 30 yards'}))
   const save=screen.getByRole('button',{name:'Save Ticket'})
   fireEvent.click(save);fireEvent.click(save)
   await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1))
   expect(mocks.save.mock.calls[0][0]).toMatchObject({customerId:'customer',jobId:'job',address:'789 Corrected Road',materialLines:[{materialId:'mat-4',yards:30}],deliveryLoads:2,notes:job.notes,requestId:expect.any(String)})
   expect(quote).toEqual(before)
 })
 it('does not replace existing ticket values from the quote when editing',()=>{
   mocks.state.ticketById=()=>({id:'ticket',customerId:'customer',jobId:'job',address:'Historical address',materialLines:[{...line,materialName:'Historical sand',yards:5}],delivery:{mode:'PICKUP'},deliveryLoads:1,notes:'Ticket note',driverId:''})
   show('/admin/tickets/ticket/edit?job=job')
   expect(screen.getByRole('textbox',{name:'Job site address'})).toHaveValue('Historical address')
   expect(screen.getByText('Historical sand')).toBeInTheDocument();expect(screen.queryByText(line.materialName)).not.toBeInTheDocument()
 })
 it('waits for loaded job/quote data before seeding an editable draft',()=>{
   mocks.state.booting=true;const view=show();expect(screen.getByRole('status')).toHaveTextContent('Loading ticket details')
   mocks.state.booting=false;view.rerender(<MemoryRouter initialEntries={['/admin/tickets/new?job=job']}><TicketBuilder/></MemoryRouter>)
   expect(screen.getByText(line.materialName)).toBeInTheDocument()
 })
})
