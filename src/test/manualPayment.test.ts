import {describe,it,expect} from 'vitest'
import {manualPaymentMath} from '@/control-center/manualPayment'
describe('manual payment preview',()=>{
 const invoice={amount:103,subtotalAmount:100,processingFeeAmount:3}
 it('defaults offline fees to zero and distinguishes a partial amount from full payment',()=>{
  expect(manualPaymentMath(invoice,0,0,100)).toMatchObject({total:100,remaining:0,valid:true})
  expect(manualPaymentMath(invoice,0,0,40)).toMatchObject({total:100,remaining:60,valid:true})
 })
 it('updates the fee, previous paid amount and balance together',()=>{
  expect(manualPaymentMath(invoice,40,5,65)).toEqual({subtotal:100,total:105,outstanding:65,remaining:0,valid:true})
 })
 it('rejects invalid or excessive amounts and fractional cents',()=>{
  for(const [fee,amount] of [[-1,100],[0,101],[0,0],[NaN,100],[0,0.001],[1.234,100]])expect(manualPaymentMath(invoice,0,fee,amount).valid).toBe(false)
 })
})
