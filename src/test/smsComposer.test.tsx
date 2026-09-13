import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReplyComposer, ConversationMessage } from '@/control-center/approved/components/ui/Conversation'

afterEach(cleanup)
describe('dashboard SMS composer',()=>{
  it('keeps text after a failed send and prevents repeated submissions while pending',async()=>{
    let reject!:(error:Error)=>void
    const send=vi.fn(()=>new Promise<void>((_,fail)=>{reject=fail}))
    render(<ReplyComposer onSend={send} paused={false}/>)
    fireEvent.change(screen.getByLabelText('Reply message'),{target:{value:'hello'}})
    fireEvent.click(screen.getByRole('button',{name:'Send'}))
    fireEvent.keyDown(screen.getByLabelText('Reply message'),{key:'Enter',ctrlKey:true})
    expect(send).toHaveBeenCalledTimes(1)
    await act(async()=>reject(new Error('Provider unavailable')))
    expect(screen.getByLabelText('Reply message')).toHaveValue('hello')
    expect(screen.getByRole('alert')).toHaveTextContent('Provider unavailable')
  })
  it('clears the text only after success',async()=>{
    render(<ReplyComposer onSend={async()=>undefined} paused={true}/>)
    fireEvent.change(screen.getByLabelText('Reply message'),{target:{value:'hello'}})
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Send'})))
    expect(screen.getByLabelText('Reply message')).toHaveValue('')
  })
  it('shows the actual provider status and delivery failure',()=>{
    render(<ConversationMessage message={{id:'msg',actor:'salvador',at:Date.now(),text:'hello',deliveryStatus:'FAILED',providerStatus:'FAILED',sendError:'Provider reported FAILED'}}/>)
    expect(screen.getByRole('status')).toHaveTextContent('failed · Provider reported FAILED')
  })
})
