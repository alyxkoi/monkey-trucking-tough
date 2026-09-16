import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiControlPanel } from '../control-center/approved/screens/settings/AiControlPanel'

const invoke=vi.hoisted(()=>vi.fn())
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke}}}))
const status={settings:{model:null,tone:'WARM',concise:true,review_enabled:true,version:1,last_review_at:null},history:[],configured_model:'test-model',provider:'fixture',prompt_version:'v9',context_message_limit:80,maps_key_configured:true,immutable_rules:[],recent_runs:[]}
const result={reply:'what material?',blocked:null,model:'test-model',decision:{known_facts:[],missing_facts:['material'],recommended_action:'ANSWER_CUSTOMER'},tool_results:{}}
beforeEach(()=>{invoke.mockReset();invoke.mockImplementation(async(_name,{body})=>({data:body.action==='status'?status:result,error:null}))})
describe('sandbox debugging and isolation',()=>{
  it('explains disabled tests and creates a new session on reset',async()=>{
    render(<AiControlPanel/>)
    await screen.findByText('Enter a customer message to test.')
    expect(screen.getByRole('button',{name:'Test response'})).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Test message'),{target:{value:'my name is Mike'}})
    fireEvent.click(screen.getByRole('button',{name:'Test response'}))
    await screen.findByText('what material?')
    const first=invoke.mock.calls.find(([,args])=>args.body.action==='simulate')?.[1].body
    expect(screen.getByLabelText('Optional form information')).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Reset test'}))
    expect(screen.queryByText('what material?')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Test message'),{target:{value:'my name is Mike'}})
    fireEvent.click(screen.getByRole('button',{name:'Test response'}))
    await waitFor(()=>expect(invoke.mock.calls.filter(([,args])=>args.body.action==='simulate')).toHaveLength(2))
    const second=invoke.mock.calls.filter(([,args])=>args.body.action==='simulate')[1][1].body
    expect(second.session_id).not.toBe(first.session_id)
    expect(second.messages).toHaveLength(1)
  })
  it('shows the exact technical error by the test controls and preserves input for retry',async()=>{
    invoke.mockImplementation(async(_name,{body})=>body.action==='status'?{data:status,error:null}:{data:{error:'MODEL_TIMEOUT: upstream timed out'},error:null})
    render(<AiControlPanel/>)
    await screen.findByText('Enter a customer message to test.')
    fireEvent.change(screen.getByLabelText('Test message'),{target:{value:'18 yards commercial'}})
    fireEvent.click(screen.getByRole('button',{name:'Test response'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('MODEL_TIMEOUT: upstream timed out')
    expect(screen.getByLabelText('Test message')).toHaveValue('18 yards commercial')
    expect(screen.getByRole('button',{name:'Test response'})).toBeEnabled()
  })
  it('distinguishes subtask review without disabling the next message',async()=>{
    invoke.mockImplementation(async(_name,{body})=>({data:body.action==='status'?status:{...result,decision:{...result.decision,subtask_escalations:[{topic:'CUSTOM_WORK',reason:'Pricing'}]}},error:null}))
    render(<AiControlPanel/>)
    await screen.findByText('Enter a customer message to test.')
    fireEvent.change(screen.getByLabelText('Test message'),{target:{value:'redo my driveway'}})
    fireEvent.click(screen.getByRole('button',{name:'Test response'}))
    expect(await screen.findByText(/Subtask review only:/)).toHaveTextContent('remains active')
    fireEvent.change(screen.getByLabelText('Test message'),{target:{value:'25 yards'}})
    expect(screen.getByRole('button',{name:'Test response'})).toBeEnabled()
  })
  it('shows staff-only structured timings, tools, route state and exact errors in collapsible diagnostics',async()=>{
    const diagnosticResult={...result,tool_results:{diagnostics:{
      lifecycle_stage:'LEAD',known_facts:[{key:'delivery_address',value:'4625 Virginia Ave, Dallas, TX 75204'}],missing_facts:[],
      tool_calls:[{name:'google.routes',status:'UNAVAILABLE',duration_ms:12001,http_status:503,error:'Google Routes HTTP 503.'}],
      route:{status:'UNAVAILABLE',address:'4625 Virginia Ave, Dallas, TX 75204',address_source:'MESSAGE',provider_called:true,http_status:503,cache_source:null,error:'Google Routes HTTP 503.'},
      timings:{openai_ms:0,total_ms:12006},escalation:{requires_human:false,ai_may_continue:true,action:'PROVIDE_STANDARD_PRICE',scope:'NONE',category:null,reason:null},
      exact_tool_errors:['Google Routes HTTP 503.'],
    }}}
    invoke.mockImplementation(async(_name,{body})=>({data:body.action==='status'?status:diagnosticResult,error:null}))
    render(<AiControlPanel/>);await screen.findByText('Enter a customer message to test.')
    fireEvent.change(screen.getByLabelText('Test message'),{target:{value:'75204'}});fireEvent.click(screen.getByRole('button',{name:'Test response'}))
    const summary=await screen.findByText(/Staff diagnostics/);fireEvent.click(summary)
    expect(screen.getAllByText('LEAD').length).toBeGreaterThan(1)
    expect(screen.getAllByText('UNAVAILABLE').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12.01 s').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Google Routes HTTP 503.').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/4625 Virginia Ave/).length).toBeGreaterThan(1)
  })

  it('keeps history read-only and requires selection, diff review and confirmation before restore',async()=>{
    const previous={model:null,tone:'DIRECT',concise:false,review_enabled:true,version:2,last_review_at:null}
    const historyStatus={...status,settings:{...status.settings,version:3},history:[{id:'history-2',created_at:'2026-09-16T15:00:00Z',kind:'SETTINGS',summary:'AI presentation settings updated.',before_settings:{...previous,version:1},after_settings:previous,findings:[]}]}
    invoke.mockImplementation(async(_name,{body})=>({data:body.action==='status'?historyStatus:{settings:historyStatus.settings},error:null}))
    render(<AiControlPanel/>);await screen.findByText('Version 3')
    expect(screen.queryByRole('button',{name:'Restore previous settings'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Restore previous version'}))
    expect(screen.getByRole('button',{name:'Restore to this version'})).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Version 2/))
    expect(screen.getByRole('region',{name:'Settings changes'})).toHaveTextContent('Current Tone')
    expect(screen.getByRole('region',{name:'Settings changes'})).toHaveTextContent('Selected Tone')
    fireEvent.click(screen.getByRole('button',{name:'Restore to this version'}))
    expect(screen.getByText('Are you sure you want to restore AI settings to this version?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}))
    expect(invoke.mock.calls.some(([,args])=>args.body.action==='rollback')).toBe(false)
  })

  it('restores only after explicit confirmation and requests a new audited rollback version',async()=>{
    const previous={model:null,tone:'DIRECT',concise:false,review_enabled:true,version:2,last_review_at:null}
    const historyStatus={...status,settings:{...status.settings,version:3},history:[{id:'history-2',created_at:'2026-09-16T15:00:00Z',kind:'SETTINGS',summary:'AI presentation settings updated.',before_settings:{...previous,version:1},after_settings:previous,findings:[]}]}
    invoke.mockImplementation(async(_name,{body})=>({data:body.action==='status'?historyStatus:{settings:historyStatus.settings},error:null}))
    render(<AiControlPanel/>);await screen.findByText('Version 3')
    fireEvent.click(screen.getByRole('button',{name:'Restore previous version'}))
    fireEvent.click(screen.getByLabelText(/Version 2/))
    fireEvent.click(screen.getByRole('button',{name:'Restore to this version'}))
    fireEvent.click(screen.getByRole('button',{name:'Confirm restore'}))
    await waitFor(()=>expect(invoke.mock.calls.some(([,args])=>args.body.action==='rollback'&&args.body.history_id==='history-2'&&args.body.settings_side==='after'&&args.body.expected_version===3)).toBe(true))
    expect(await screen.findByText('Version 2 settings restored as a new audited version.')).toBeInTheDocument()
  })
})
