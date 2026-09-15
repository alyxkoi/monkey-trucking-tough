/* eslint-disable @typescript-eslint/no-explicit-any */
// The model chooses the conversational objective, order, acknowledgement and
// next question. Business assertions are composed only from these server facts.
export const responsePlanSchema = {
  type:'object',additionalProperties:false,
  required:['objective','answers','comparison_keys','acknowledgement','next_question','required_tools','escalation_scope','escalation_category'],
  properties:{
    objective:{type:'string',enum:['ANSWER','EXPLAIN','COMPARE','SUMMARY','COLLECT']},
    answers:{type:'array',items:{type:'string',enum:['SERVICE_SCOPE','INSTALLATION_SCOPE','PRODUCT_OPTIONS','RECOMMENDATION','PRICE','DELIVERY','QUANTITY','SUMMARY']}},
    comparison_keys:{type:'array',items:{type:'string'}},
    acknowledgement:{type:'string'},next_question:{type:'string'},
    required_tools:{type:'array',items:{type:'string',enum:['MATERIAL','ROUTE']}},
    escalation_scope:{type:'string',enum:['NONE','SUBTASK','CONVERSATION']},
    escalation_category:{type:'string',enum:['NONE','CUSTOM_WORK','HUMAN_REQUEST','COMPLAINT','FINANCIAL','SAFETY','TOOL_REFRESH','OTHER']},
  },
}

const money=(n:number)=>`$${n.toFixed(2)}`
const clean=(value:unknown)=>String(value??'').replace(/[—–-]/g,' ').replace(/\s+/g,' ').trim()
const amount=(n:number)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1})
const productLabel=(m:any)=>({'mat-1':'commercial clean','mat-3':'3x4 crushed concrete','mat-4':'flexbase'}[m.catalog_key]??clean(m.name))

export function validateResponsePlan(plan:any, references:string[]=[]) {
  if(!plan||!['ANSWER','EXPLAIN','COMPARE','SUMMARY','COLLECT'].includes(plan.objective)
    ||!Array.isArray(plan.answers)||plan.answers.length>6
    ||plan.answers.some((a:any)=>!['SERVICE_SCOPE','INSTALLATION_SCOPE','PRODUCT_OPTIONS','RECOMMENDATION','PRICE','DELIVERY','QUANTITY','SUMMARY'].includes(a))
    ||!Array.isArray(plan.comparison_keys)||plan.comparison_keys.length>3
    ||!Array.isArray(plan.required_tools)||plan.required_tools.some((a:any)=>!['MATERIAL','ROUTE'].includes(a))
    ||!['NONE','SUBTASK','CONVERSATION'].includes(plan.escalation_scope)
    ||!['NONE','CUSTOM_WORK','HUMAN_REQUEST','COMPLAINT','FINANCIAL','SAFETY','TOOL_REFRESH','OTHER'].includes(plan.escalation_category))return 'Invalid conversational response plan.'
  // Free-form wording is limited to a brief acknowledgement and a question.
  // Never permit it to bypass the existing financial/commitment restrictions.
  for(const key of ['acknowledgement','next_question']) {
    const raw=plan[key]
    if(typeof raw!=='string'||raw.length>(key==='acknowledgement'?65:150))return 'Response wording exceeds its permitted scope.'
    const text=references.filter(Boolean).sort((a,b)=>b.length-a.length).reduce((value,ref)=>value.replaceAll(ref,'catalog reference'),raw)
    if(/[\d$€£{}]|\b(price|cost|total|mile|miles|yard|yards|ton|tons|free|included|include|guarantee|available|paid|refunded|booked|scheduled|confirmed|discount|precio|cuesta|total|millas|yardas|toneladas|gratis|incluye|incluido|garantizado|disponible|pagado|agendado|confirmado|descuento)\b/i.test(text)) {
      // Questions about a missing quantity are legitimate, but must not state
      // any numeric answer or commitment. All answers use server blocks below.
      if(key!=='next_question'||!/[?？]$/.test(text.trim())||/[\d$€£{}]|\b(free|guarantee|paid|refunded|booked|confirmed|gratis|pagado|confirmado)\b/i.test(text))return 'Unverified business assertion in response wording.'
    }
    if(key==='next_question'&&text.trim()&&!/[?？]$/.test(text.trim()))return 'The next question must be a question, not a business assertion.'
  }
  return null
}

export function composeConversationResponse(decision:any,pricing:any) {
  const plan=decision.response_plan
  const c=pricing?.conversation
  if(!c)throw new Error('Current conversation facts are unavailable.')
  const invalid=validateResponsePlan(plan,c.question_references??[])
  if(invalid)throw new Error(invalid)
  const es=decision.detected_language==='SPANISH'
  const ready=pricing.status==='MATERIAL_CALCULATED'
  const routed=ready&&Number.isFinite(pricing.delivery_total)&&Number.isFinite(pricing.grand_total)
  const name=clean(pricing.material_name||c.material_name)
  const yards=Number(pricing.yards??c.quantity_yards)
  const pieces:string[]=[]
  const answerSet=new Set(plan.answers)
  // No model amounts, product descriptions, policy or arithmetic is rendered.
  for(const answer of answerSet) {
    if(answer==='SERVICE_SCOPE')pieces.push(es?'sí, hacemos entradas, caminos privados, estanques y trabajo de tierra.':'yes, we do driveways, private roads, ponds and dirt work.')
    if(answer==='INSTALLATION_SCOPE')pieces.push(es?'este cálculo cubre material y entrega, no el trabajo de instalación. Salvador cotiza ese trabajo por separado.':'this estimate covers material and delivery, not installation work. Salvador prices that work separately.')
    if(answer==='PRODUCT_OPTIONS'||answer==='RECOMMENDATION') {
      const options=c.options??[]
      if(options.length)pieces.push(options.map((m:any)=>`${productLabel(m)}${m[es?'use_es':'use_en']?`: ${m[es?'use_es':'use_en']}`:''}`).join('; ')+'.')
      else pieces.push(es?'para recomendar el material correcto, necesito saber cómo lo va a usar.':'to recommend the right material, I need to know how you will use it.')
    }
    if(answer==='QUANTITY'&&Number.isFinite(yards)&&yards>0)pieces.push(es?`queda ${c.approximate?'aproximadamente ':''}${amount(yards)} yardas${name?` de ${name}`:''}.`:`got it, ${c.approximate?'approximately ':''}${amount(yards)} yards${name?` of ${name}`:''}.`)
    if(answer==='PRICE'&&plan.objective!=='COMPARE') {
      if(ready) {
        if(plan.objective==='EXPLAIN') {
          const detail=[pricing.full_loads>0?`${pricing.full_loads} ${es?'cargas completas a':'full loads at'} ${money(c.full_load_price)}`:'',pricing.remainder_yards>0?`${amount(pricing.remainder_yards)} ${es?'yardas a':'yards at'} ${money(c.price_per_yard)} ${es?'por yarda':'per yard'}`:''].filter(Boolean).join(es?' más ':' plus ')
          if(!detail||!Number.isFinite(c.full_load_price)||!Number.isFinite(c.price_per_yard))throw new Error('Current material rate details are unavailable.')
          pieces.push(`${detail}: ${money(pricing.material_total)} ${es?'de material':'for material'}.`)
        }else if(routed)pieces.push(es?`${money(pricing.material_total)} de material y ${money(pricing.delivery_total)} de entrega${pricing.tax_total>0?`, más ${money(pricing.tax_total)} de impuestos`:''}. total estimado: ${money(pricing.grand_total)}.`:`${money(pricing.material_total)} for material and ${money(pricing.delivery_total)} for delivery${pricing.tax_total>0?`, plus ${money(pricing.tax_total)} tax`:''}. estimated total: ${money(pricing.grand_total)}.`)
        else pieces.push(es?`${amount(yards)} yardas de ${name} salen en ${money(pricing.material_total)} de material. la entrega y los impuestos se calculan por separado.`:`${amount(yards)} yards of ${name} comes to ${money(pricing.material_total)} for material. delivery and tax are calculated separately.`)
      }else pieces.push(es?'puedo calcularlo al confirmar el material y la cantidad.':'I can calculate that once the material and quantity are confirmed.')
    }
    if(answer==='DELIVERY') {
      if(routed&&Number.isFinite(pricing.delivery_miles))pieces.push(es?`la entrega cuesta ${money(pricing.delivery_total)} porque son aproximadamente ${amount(pricing.delivery_miles)} millas desde nuestro patio y ${pricing.delivery_loads} ${pricing.delivery_loads===1?'carga':'cargas'}.`:`delivery is ${money(pricing.delivery_total)} because it is about ${amount(pricing.delivery_miles)} miles from our yard and ${pricing.delivery_loads} ${pricing.delivery_loads===1?'load':'loads'}.`)
      else pieces.push(es?'necesito verificar la ruta y las cargas antes de explicar el costo de entrega.':'I need the verified route and load count before I can explain the delivery cost.')
    }
    if(answer==='SUMMARY') {
      const values=[c.customer_name,Number.isFinite(yards)&&yards>0?`${amount(yards)} ${es?'yardas':'yards'}${name?` ${es?'de':'of'} ${name}`:''}`:name,c.address,...(c.service_requests??[])].filter(Boolean).map(clean)
      pieces.push(es?`hasta ahora tengo: ${values.join('; ')||'todavía no hay detalles confirmados'}.`:`so far I have: ${values.join('; ')||'no confirmed details yet'}.`)
    }
  }
  if(plan.objective==='COMPARE') {
    const comparisons=c.comparisons??[]
    if(comparisons.length>=2) {
      pieces.push(comparisons.map((m:any)=>`${productLabel(m)}: ${money(m.material_total)} ${es?'de material':'for material'}`).join('; ')+'.')
      const difference=Math.round(Math.abs(comparisons[0].material_total-comparisons[1].material_total)*100)/100
      pieces.push(es?`la diferencia para ${amount(c.comparison_yards)} yardas es ${money(difference)}.`:`the difference for ${amount(c.comparison_yards)} yards is ${money(difference)}.`)
    }else if((c.options??[]).length>=2)pieces.push(c.options.map((m:any)=>`${productLabel(m)}: ${money(m.price_per_yard)} ${es?'por yarda':'per yard'}`).join('; ')+'.')
    else pieces.push(es?'cuáles dos materiales quiere comparar?':'which two materials would you like to compare?')
  }
  if((decision.subtask_escalations??[]).length&&!answerSet.has('INSTALLATION_SCOPE')) {
    // Mention the handoff when first requested or when the customer asks about
    // it again. Keeping a pending subtask is not a license to repeat boilerplate.
    if(c.mention_custom_handoff)pieces.push(es?'Salvador cotiza el trabajo de la entrada por separado. podemos seguir con el material y la entrega.':'Salvador handles the custom work pricing separately. we can keep going with material and delivery.')
  }
  const acknowledgement=clean(plan.acknowledgement)
  if(acknowledgement&&!answerSet.has('QUANTITY'))pieces.unshift(acknowledgement)
  const question=clean(plan.next_question)
  if(question)pieces.push(question)
  if(!pieces.length)throw new Error('Response plan contains no useful answer or next question.')
  const reply=pieces.join(' ').replace(/\s+/g,' ').trim()
  if(reply.length>(decision.first_conversational_reply?392:420))throw new Error('Composed reply exceeds the approved SMS length; shorten the response plan.')
  return reply.charAt(0).toLowerCase()+reply.slice(1)
}
