import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {AiStaffActions} from '@/control-center/approved/components/ui/AiStaffActions'
import type {Activity} from '@/control-center/data'
const mocks=vi.hoisted(()=>({preview:vi.fn(),decide:vi.fn(),resolve:vi.fn()}))
vi.mock('@/control-center/data',()=>({previewAiChangeApproval:mocks.preview,decideAiStaffAction:mocks.decide,resolveAiStaffAction:mocks.resolve}))
const action={id:'request',entity_id:'lead',metadata:{kind:'SCHEDULE_CHANGE',request:'Friday at 10am',job_id:'job'}} as unknown as Activity
beforeEach(()=>{vi.clearAllMocks();mocks.preview.mockResolvedValue({kind:'SCHEDULE_CHANGE',date:'2026-09-19',time:'02:00 PM',job_id:'job'});mocks.decide.mockResolvedValue({message_id:'queued'})})
describe('staff approval controls',()=>{
 it('requires a saved preview and note, then approves the actual displayed values',async()=>{
   const refresh=vi.fn();render(<MemoryRouter><AiStaffActions actions={[action]} onResolved={refresh}/></MemoryRouter>)
   expect(screen.queryByRole('button',{name:'Approve saved values & notify customer'})).not.toBeInTheDocument()
   fireEvent.click(screen.getByRole('button',{name:'Review saved values to approve'}))
   expect(await screen.findByText('02:00 PM')).toBeInTheDocument()
   const approve=screen.getByRole('button',{name:'Approve saved values & notify customer'});expect(approve).toBeDisabled()
   fireEvent.change(screen.getByRole('textbox'),{target:{value:'Saturday approved'}});fireEvent.click(approve)
   await waitFor(()=>expect(mocks.decide).toHaveBeenCalledWith('request','Saturday approved','APPROVED',{kind:'SCHEDULE_CHANGE',date:'2026-09-19',time:'02:00 PM',job_id:'job'}))
   expect(refresh).toHaveBeenCalledTimes(1)
 })
 it('does not equate handled with approval',async()=>{
   render(<MemoryRouter><AiStaffActions actions={[action]} onResolved={vi.fn()}/></MemoryRouter>)
   fireEvent.change(screen.getByRole('textbox'),{target:{value:'No change needed'}})
   fireEvent.click(screen.getByRole('button',{name:'Mark handled · no text'}))
   await waitFor(()=>expect(mocks.resolve).toHaveBeenCalledWith('request','No change needed'));expect(mocks.decide).not.toHaveBeenCalled()
 })
})
