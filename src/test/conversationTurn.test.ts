import { describe, expect, it } from 'vitest'
import { latestCustomerTurn } from '../../supabase/functions/_shared/conversation-turn'
import { conversationCustomerName, customerName, lifecycleProposal } from '../../supabase/functions/_shared/lifecycle'
import { addressFromText } from '../../supabase/functions/_shared/route-intelligence'

const burst=(a:string,b:string)=>[
  {id:'a',sender_type:'CUSTOMER',body:a,created_at:'2026-09-23T15:00:00Z'},
  {id:'b',sender_type:'CUSTOMER',body:b,created_at:'2026-09-23T15:00:02Z'},
]
describe('current customer burst and contextual identity',()=>{
 it('keeps the request with the polite second text and newest trigger',()=>{
  const turn=latestCustomerTurn(burst('I need 20 yards of flexbase','please and thank you'))
  expect(turn).toMatchObject({id:'b',body:'I need 20 yards of flexbase\nplease and thank you'})
 })
 it('keeps ordered address evidence so the latest correction wins',()=>{
  const messages=burst('123 Main St','actually 1234 Main St sorry')
  const addresses=messages.map(m=>addressFromText(m.body)).filter(Boolean)
  expect(addresses.at(-1)).toContain('1234 Main St')
 })
 it('uses the latest explicit email correction without guessing between alternatives',()=>{
  const messages=burst('my email is john@gmail.com','wait use john2@gmail.com instead')
  const input={lead:{},customer:{},messages,lifecycle:{protected:false},decision:{uncertain_facts:[]},pricing:{},requestMessage:latestCustomerTurn(messages)}
  expect(lifecycleProposal(input)).toMatchObject({email:'john2@gmail.com',confirmed_email:'john2@gmail.com'})
  expect(lifecycleProposal({...input,requestMessage:{body:'john@gmail.com or john2@gmail.com'}}).email).toBeNull()
 })
 it.each(["it's okay",'it’s okay','okay','please and thank you','that is fine'])('never stores acknowledgment as name: %s',text=>expect(customerName(text,true)).toBeNull())
 it('recognizes the actual name question in the production failure',()=>{
  expect(conversationCustomerName([{sender_type:'AI',body:'What is your name?'},{sender_type:'CUSTOMER',body:"it's okay"},{sender_type:'AI',body:'What name should we put this under?'},{sender_type:'CUSTOMER',body:'Tyrone'}])).toBe('Tyrone')
  expect(customerName('My name is Tyrone')).toBe('Tyrone')
  expect(customerName('This is Tyrone')).toBe('Tyrone')
 })
 it('does not combine a completed turn, compliance or old unanswered messages',()=>{
  const messages=burst('20 yards','thank you')
  expect(latestCustomerTurn([messages[0],{sender_type:'AI',body:'Reply'},messages[1]])?.body).toBe('thank you')
  expect(latestCustomerTurn([messages[0],{...messages[1],created_at:'2026-09-23T15:01:00Z'}])?.body).toBe('thank you')
 })
})
