// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { dispatchSms } from '../../supabase/functions/_shared/sms-dispatch'
import { verifySignature } from '../../supabase/functions/_shared/sms-signature'
import { autonomousReply, jobReminderText } from '../../supabase/functions/_shared/communication-worker'
import { forcedEscalation, generateAiDraft, materialTool, validateDecision } from '../../supabase/functions/_shared/ai-engine'

afterEach(()=>vi.unstubAllGlobals())
const messageId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const payload={to:['+12143568256'],channel:['sms'],text:'original message'}
function senderService(overrides:Record<string,unknown>={}) {
  return {rpc:vi.fn(async(name:string)=>({data: name in overrides?overrides[name]:{
    claim_sms:{message_id:messageId,lease_token:'lease'},
    authorize_sms_dispatch:{payload},complete_sms_dispatch:{delivery_status:'DELIVERED'},fail_sms_dispatch:null,
  }[name],error:null}))}
}

describe('SMS transport behavior',()=>{
  it('keeps localized job reminders concise and removes doubled punctuation',()=>{
    const spanishReminder=jobReminderText('martes, 15, 12:02\u202fp.\u00a0m.',true)
    expect(spanishReminder).toBe('Recordatorio: su trabajo es el martes, 15, 12:02 p. m.')
    expect(spanishReminder.length).toBeLessThanOrEqual(67)
    expect(spanishReminder).not.toContain('..')
    expect(jobReminderText('Tuesday 15, 12:02 PM.',false)).toBe('Reminder: your job is Tuesday 15, 12:02 PM.')
  })
  it('submits only the reserved immutable payload with one stable provider key',async()=>{
    const service=senderService()
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({data:{recipients:[{message_id:'provider-id',status:'QUEUED'}]}}),{status:202}))
    expect(await dispatchSms(service,{apiKey:'test-key'},messageId,fetcher)).toMatchObject({accepted:true,status:'DELIVERED'})
    const request=fetcher.mock.calls[0] as unknown as [string,RequestInit]
    expect(JSON.parse(request[1].body as string)).toEqual(payload)
    expect(request[1].headers).toMatchObject({'Idempotency-Key':`sms_${messageId.replaceAll('-','_')}`})
    expect(service.rpc.mock.calls.map(([name])=>name)).toEqual(['claim_sms','authorize_sms_dispatch','complete_sms_dispatch'])
  })
  it('does not call the provider when another worker owns the lease or STOP won the preflight',async()=>{
    const fetcher=vi.fn()
    await dispatchSms(senderService({claim_sms:null}),{apiKey:'test-key'},messageId,fetcher)
    await dispatchSms(senderService({authorize_sms_dispatch:null}),{apiKey:'test-key'},messageId,fetcher)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([408,409,429,500,503])('treats HTTP %s as ambiguous, preserving the operation',async(status)=>{
    const service=senderService()
    expect(await dispatchSms(service,{apiKey:'test-key'},messageId,async()=>new Response('{}',{status}))).toMatchObject({accepted:false,retryable:true})
    expect(service.rpc).toHaveBeenCalledWith('fail_sms_dispatch',expect.objectContaining({p_retryable:true,p_message_id:messageId}))
  })
  it.each([400,401,403,422])('does not automatically retry rejected HTTP %s',async(status)=>{
    expect(await dispatchSms(senderService(),{apiKey:'test-key'},messageId,async()=>new Response('{}',{status}))).toMatchObject({retryable:false})
  })
  it('keeps timeouts and missing success IDs unconfirmed, not delivered or failed',async()=>{
    for(const fetcher of [async()=>{throw new Error('timeout')},async()=>new Response('{}',{status:202})]) {
      const service=senderService()
      expect(await dispatchSms(service,{apiKey:'test-key'},messageId,fetcher)).toMatchObject({retryable:true})
      expect(service.rpc).not.toHaveBeenCalledWith('complete_sms_dispatch',expect.anything())
    }
  })
  it('verifies exact HMAC bytes and rejects tampering and stale requests',async()=>{
    const secret=Buffer.from('test-signing-key').toString('base64')
    const timestamp=String(Math.floor(Date.now()/1000))
    const body='{"field":"message"}'
    const signature=createHmac('sha256',Buffer.from(secret,'base64')).update(`hook.${timestamp}.${body}`).digest('base64')
    const request=new Request('https://example.test',{method:'POST',headers:{'X-Webhook-ID':'hook','X-Webhook-Timestamp':timestamp,'X-Webhook-Signature':`v1,${signature}`},body})
    expect(await verifySignature(request,body,`whsec_${secret}`)).toBe(true)
    expect(await verifySignature(request,body+' ',secret)).toBe(false)
    request.headers.set('X-Webhook-Timestamp',String(Number(timestamp)-301))
    expect(await verifySignature(request,body,secret)).toBe(false)
  })
})

const decision={detected_language:'ENGLISH',customer_intent:'MATERIAL_DELIVERY',extracted_facts:[],known_facts:[],missing_facts:['address'],uncertain_facts:[],ai_may_continue:true,requires_human:false,escalation_reason:null,recommended_action:'ASK_NEXT_MISSING_FACT',draft_reply:'what is the exact delivery address.',confidence:'HIGH',deterministic_pricing_required:false,payment_claim_detected:false,automation_state:{mode:'CONVERSATION',rule_id:null,transport:'SETUP_REQUIRED',send_allowed:false}}
function aiService(failingTable?:string,takeoverOnRecheck=false,initialTakeover=false,dataOverrides:Record<string,unknown>={}) {
  let leadReads=0
  const calls:Array<{table:string;order?:string;options?:unknown;limit?:number}>=[]
  const from=vi.fn((table:string)=>{
    let insert:unknown
    const chain={select:()=>chain,eq:()=>chain,limit:(limit:number)=>{calls.push({table,limit});return chain},
      order:(order:string,options:unknown)=>{calls.push({table,order,options});return chain},maybeSingle:()=>chain,single:()=>chain,
      insert:(value:unknown)=>{insert=value;return chain},upsert:()=>chain,
      then:(resolve:(value:unknown)=>unknown)=>{
        const data=dataOverrides[table]??{
          leads:{id:'lead',customer_id:'customer',human_takeover:initialTakeover||(takeoverOnRecheck&&++leadReads>1),conversation_revision:1},
          customers:{id:'customer',sms_consent_at:'2026-09-01',sms_double_opt_in_at:'2026-09-02'},
          lead_messages:[{id:'new',sender_type:'CUSTOMER',body:'I need gravel delivered',created_at:'2026-09-13'},{id:'old',sender_type:'HUMAN',body:'How can we help?',created_at:'2026-09-12'}],
          app_settings:{tax_enabled:false},control_center_settings:{ai_english:true,ai_spanish:true},ai_conversation_state:null,
          ai_audit_logs:{id:'audit'},ai_drafts:{id:'draft',body:decision.draft_reply,decision},
        }[table]??[]
        return Promise.resolve(resolve({data,error:table===failingTable&&!insert?{message:'context unavailable'}:null}))
      }}
    return chain
  })
  return {from,calls,rpc:vi.fn(async()=>({data:{applied:true},error:null}))}
}
describe('shared production AI safety',()=>{
  it('supplies authoritative current takeover state and separates material-only pricing from unapproved delivery',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(decision)})))
    vi.stubGlobal('fetch',fetcher)
    await generateAiDraft(aiService(),{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})
    const request=fetcher.mock.calls[0] as unknown as [string,RequestInit]
    const body=JSON.parse(request[1].body as string)
    expect(JSON.parse(body.input[0].content[0].text).current_human_takeover).toBe(false)
    expect(body.instructions).toContain('Historical manual replies do not reactivate takeover after staff explicitly resume AI')
    expect(body.instructions).toContain('A material-only price does not require an approved delivery total')
    expect(body.instructions).toContain('quantity_yards')
    expect(body.instructions).toContain('exact material_name')
    fetcher.mockClear()
    const paused=await generateAiDraft(aiService(undefined,false,true),{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})
    expect(paused.paused).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('renders only verified material pricing and rejects mismatched canonical facts',()=>{
    const pricing={status:'MATERIAL_CALCULATED',material_total:1820,yards:50,material_name:'Flexbase First Class',grand_total:null,delivery_total:'REQUIRES_APPROVED_DISTANCE',tax_total:null}
    const priced={...decision,detected_language:'SPANISH',recommended_action:'PROVIDE_STANDARD_PRICE',draft_reply:'el material cuesta $1.',known_facts:[{key:'material',value:pricing.material_name},{key:'quantity_yards',value:'50'},{key:'delivery_address',value:'test address'}]}
    const reply=autonomousReply(priced,pricing)
    expect(reply).toContain('$1820.00')
    expect(reply).toContain('la entrega y los impuestos se confirman por separado')
    expect(reply).not.toContain('cuál es la dirección')
    expect(()=>autonomousReply({...priced,known_facts:[{key:'material',value:'Other Material'},{key:'quantity_yards',value:'50'}]},pricing)).toThrow('Pricing facts require confirmation')
    expect(()=>autonomousReply(priced,{...pricing,yards:15})).toThrow('Pricing facts require confirmation')
    expect(()=>autonomousReply(priced,{...pricing,status:'UNAVAILABLE'})).toThrow('Verified material pricing unavailable')
  })
  it('separates the physical ton conversion from the conservative order recommendation',()=>{
    const pricing=materialTool(
      [{id:'message',sender_type:'CUSTOMER',body:'10 tons of limestone'}],
      [{id:'limestone',name:'Limestone',full_load_yards:20,full_load_price:1700,price_per_yard:95,tons_per_cubic_yard:1.4}],
      {tax_enabled:false},
    )
    const priced={
      ...decision,
      recommended_action:'PROVIDE_STANDARD_PRICE',
      draft_reply:'the estimate is ready.',
      known_facts:[{key:'material',value:'Limestone'},{key:'quantity_yards',value:'8.5'}],
    }
    const reply=autonomousReply(priced,pricing)
    expect(reply).toContain('recommend approximately 8.5 yards')
    expect(reply).not.toMatch(/extra yard|reserve|buffer|7\.1/)
    expect(reply).toContain('material for 8.5 yards')
  })
  it('distinguishes missing intake details from conflicting facts without weakening uncertainty guards',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(decision)})))
    vi.stubGlobal('fetch',fetcher)
    await generateAiDraft(aiService(),{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})
    const request=fetcher.mock.calls[0] as unknown as [string,RequestInit]
    const prompt=JSON.parse(request[1].body as string).instructions
    expect(prompt).toContain('Ordinary unanswered intake questions belong in missing_facts')
    expect(prompt).toContain('Never assume a truckload equals a particular yard quantity')
    expect(prompt).toContain('Conflicting facts or uncertainty about a claim you would make belong in uncertain_facts')
    expect(prompt).toContain('COLLECT_RESCHEDULE_PREFERENCE')
    expect(prompt).toContain('use the earliest stated time as the preference')
    expect(autonomousReply({...decision,missing_facts:['specific gravel type','yard quantity','delivery address']},{})).toBe(decision.draft_reply)
    expect(()=>autonomousReply({...decision,uncertain_facts:['Conflicting delivery addresses.']},{})).toThrow('human review')
  })
  it('collects reschedule date and time without claiming the appointment changed',()=>{
    expect(forcedEscalation('Can I reschedule?',false)).toBeNull()
    const reschedule={...decision,customer_intent:'RESCHEDULE',recommended_action:'COLLECT_RESCHEDULE_PREFERENCE',draft_reply:'what date would work better for you.',known_facts:[],missing_facts:['reschedule_date','reschedule_time']}
    expect(autonomousReply(reschedule,{})).toBe('what date would work better for you.')
    expect(autonomousReply({...reschedule,draft_reply:'got it, I have Tuesday at 6 as your preferred new time. our team will confirm it.',known_facts:[{key:'reschedule_date',value:'Tuesday'},{key:'reschedule_time',value:'6:00 PM'}],missing_facts:[]},{})).toContain('preferred new time')
    expect(()=>autonomousReply({...reschedule,draft_reply:'your appointment is rescheduled for Tuesday at 6.'},{})).toThrow('confirmed change')
  })
  it('loads the latest 80 messages and fails closed when payment or settings context is missing',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(decision)})))
    vi.stubGlobal('fetch',fetcher)
    const service=aiService()
    await generateAiDraft(service,{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})
    expect(service.calls).toContainEqual({table:'lead_messages',order:'created_at',options:{ascending:false}})
    expect(service.calls).toContainEqual({table:'lead_messages',limit:80})
    for(const table of ['payments','control_center_settings','invoices']) {
      fetcher.mockClear()
      await expect(generateAiDraft(aiService(table),{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})).rejects.toThrow('Required conversation context')
      expect(fetcher).not.toHaveBeenCalled()
    }
  })
  it('discards a draft if a human takes over while the model is working',async()=>{
    vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(decision)})))
    await expect(generateAiDraft(aiService(undefined,true),{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})).rejects.toThrow('Conversation changed')
  })
  it('rejects incomplete model output',async()=>{
    vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({status:'incomplete',output_text:JSON.stringify(decision)})))
    await expect(generateAiDraft(aiService(),{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})).rejects.toThrow('incomplete')
  })
  it('blocks low-confidence, financial and human-escalated replies',()=>{
    expect(autonomousReply(decision,{})).toBe(decision.draft_reply)
    for(const changed of [{confidence:'LOW'},{requires_human:true,ai_may_continue:false},{payment_claim_detected:true},{draft_reply:'your invoice is paid.'},{recommended_action:'MANUAL_REPLY'}]) {
      expect(()=>autonomousReply({...decision,...changed},{})).toThrow()
    }
  })
  it('does not accept a staff-only action as an autonomous AI decision',()=>{
    expect(validateDecision({...decision,recommended_action:'MANUAL_REPLY'})).toMatch(/MANUAL_REPLY.*human required/i)
    expect(validateDecision({...decision,ai_may_continue:false,recommended_action:'MANUAL_REPLY'})).toMatch(/human required/i)
  })
  it('uses one deterministic clarification when Google cannot resolve the supplied address exactly',async()=>{
    const fetcher=vi.fn(async(url:string)=>url.includes('routes.googleapis.com')
      ? new Response(JSON.stringify({routes:[{distanceMeters:16093.44,duration:'900s'}],geocodingResults:{destination:{placeId:'place',geocoderStatus:'OK',partialMatch:true}}}))
      : new Response('{}',{status:500}))
    vi.stubGlobal('fetch',fetcher)
    const service=aiService(undefined,false,false,{
      lead_messages:[
        {id:'address',sender_type:'CUSTOMER',body:'deliver to 123 Oak Road, Texas',created_at:'2026-09-13T02:00:00Z'},
        {id:'quantity',sender_type:'CUSTOMER',body:'10 yards of limestone',created_at:'2026-09-13T01:00:00Z'},
      ],
      materials:[{id:'limestone',name:'Limestone 1"-1 1/2"',full_load_yards:20,full_load_price:1700,price_per_yard:95,tons_per_cubic_yard:1.4}],
      app_settings:{company_address:'7653 S FM 148',company_city_state_zip:'Kaufman, TX 75142',tax_enabled:false},
      control_center_settings:{ai_english:true,ai_spanish:true,route_intelligence_enabled:true,route_status:'READY'},
    })
    const result=await generateAiDraft(service,{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model',googleMapsApiKey:'maps-key'})
    expect(result.decision).toMatchObject({ai_may_continue:true,requires_human:false,recommended_action:'ASK_NEXT_MISSING_FACT',confidence:'HIGH'})
    expect(result.decision.draft_reply).toContain('check the street number and name')
    expect(result.decision.missing_facts).toContain('Verify delivery location')
    expect(autonomousReply(result.decision,result.tool_results.pricing)).toContain(result.decision.draft_reply)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['provider 5xx',()=>Promise.resolve(new Response('{}',{status:503}))],
    ['empty draft',()=>Promise.resolve(new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({...decision,draft_reply:''})})))],
    ['timeout',()=>Promise.reject(Object.assign(new Error('timed out'),{name:'TimeoutError'}))],
  ])('retries a transient AI %s once',async(_label,firstAttempt)=>{
    const fetcher=vi.fn()
      .mockImplementationOnce(firstAttempt)
      .mockResolvedValueOnce(new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(decision)})))
    vi.stubGlobal('fetch',fetcher)
    await generateAiDraft(aiService(),{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('does not retry a valid business-rule escalation',async()=>{
    const escalation={...decision,ai_may_continue:false,requires_human:true,recommended_action:'MANUAL_REPLY',draft_reply:'',escalation_reason:'customer requested a human'}
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(escalation)})))
    vi.stubGlobal('fetch',fetcher)
    const result=await generateAiDraft(aiService(),{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model'})
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(()=>autonomousReply(result.decision,result.tool_results.pricing)).toThrow('customer requested a human')
  })
  it('continues safely when a ZIP-only reply completes a verified delivery route',async()=>{
    const modelDecision={...decision,ai_may_continue:true,requires_human:false,recommended_action:'MANUAL_REPLY',draft_reply:'',uncertain_facts:['delivery ZIP code is missing']}
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('routes.googleapis.com')
      ? new Response(JSON.stringify({routes:[{distanceMeters:16093.44,duration:'900s'}],geocodingResults:{destination:{placeId:'place',geocoderStatus:'OK',partialMatch:false}}}))
      : new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(modelDecision)}))))
    const service=aiService(undefined,false,false,{
      lead_messages:[
        {id:'zip',sender_type:'CUSTOMER',body:'75204',created_at:'2026-09-13T03:00:00Z'},
        {id:'address',sender_type:'CUSTOMER',body:'My address is 4625 Virginia Ave, Dallas, TX',created_at:'2026-09-13T02:00:00Z'},
        {id:'quantity',sender_type:'CUSTOMER',body:'10 tons of limestone',created_at:'2026-09-13T01:00:00Z'},
      ],
      materials:[{id:'limestone',name:'Limestone 1"-1 1/2"',full_load_yards:20,full_load_price:1700,price_per_yard:95,tons_per_cubic_yard:1.4}],
      app_settings:{company_address:'7653 S FM 148',company_city_state_zip:'Kaufman, TX 75142',delivery_tier_1_fee:100,delivery_tier_1_max_miles:5,delivery_tier_2_fee:150,delivery_tier_2_max_miles:10,delivery_tier_3_fee:200,delivery_tier_3_max_miles:20,delivery_overage_base_fee:200,delivery_overage_per_mile:5,tax_enabled:false,tax_rate:0,tax_applies_to_delivery:false},
      control_center_settings:{ai_english:true,ai_spanish:true,route_intelligence_enabled:true,route_status:'READY'},
    })
    const result=await generateAiDraft(service,{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model',googleMapsApiKey:'maps-key'})
    expect(result.decision).toMatchObject({ai_may_continue:true,requires_human:false,recommended_action:'PROVIDE_STANDARD_PRICE',deterministic_pricing_required:true})
    expect(result.decision.known_facts).toContainEqual(expect.objectContaining({key:'delivery_address',value:'4625 Virginia Ave, Dallas, TX 75204'}))
    expect(result.decision.uncertain_facts).toEqual([])
    expect(result.tool_results).toMatchObject({quantity:{estimated_yards:7.1,recommended_yards:8.5},route:{status:'ROUTE_CALCULATED',distance_miles:10}})
    expect(service.rpc).toHaveBeenCalledTimes(2)
    expect(service.rpc).toHaveBeenCalledWith('apply_ai_material_to_quote',expect.objectContaining({p_material_id:'limestone',p_yards:8.5}))
    expect(service.rpc).toHaveBeenCalledWith('apply_ai_route_to_quote',expect.objectContaining({p_address:'4625 Virginia Ave, Dallas, TX 75204',p_distance_miles:10}))
    expect(autonomousReply(result.decision,result.tool_results.pricing)).toContain('the estimated total is')
    expect(autonomousReply(result.decision,result.tool_results.pricing)).not.toContain('with tax')
  })
  it('uses corrected quantities and never treats customer mileage as approved delivery pricing',()=>{
    const pricing=materialTool([{sender_type:'CUSTOMER',body:'10 yards of flexbase 20 miles away'},{sender_type:'CUSTOMER',body:'make that 15 yards'}],
      [{id:'material',name:'Flexbase',full_load_yards:15,full_load_price:300,price_per_yard:25}],{tax_enabled:false})
    expect(pricing).toMatchObject({yards:15,material_total:300,grand_total:null,delivery_miles:null})
  })
  it('applies corrected standard quote facts through the protected RPCs while custom work stays a subtask',async()=>{
    const modelDecision={...decision,recommended_action:'ANSWER_CUSTOMER',response_plan:{objective:'ANSWER',answers:['PRICE'],comparison_keys:[],recommendation_key:'',acknowledgement:'',next_question:'',required_tools:['MATERIAL','ROUTE'],escalation_scope:'SUBTASK',escalation_category:'CUSTOM_WORK'}}
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('routes.googleapis.com')
      ?new Response(JSON.stringify({routes:[{distanceMeters:16093.44,duration:'900s'}],geocodingResults:{destination:{placeId:'place',geocoderStatus:{}}}}))
      :new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(modelDecision)}))))
    const service=aiService(undefined,false,false,{
      lead_messages:[{id:'zip',sender_type:'CUSTOMER',body:'75204'},{id:'ask',sender_type:'AI',body:'what ZIP?'},{id:'address',sender_type:'CUSTOMER',body:'4625 Virginia Ave, Dallas, TX'},{id:'quantity',sender_type:'CUSTOMER',body:'actually make that 28'},{id:'initial',sender_type:'CUSTOMER',body:'20 yards flexbase and redo my driveway'}],
      materials:[{id:'base',catalog_key:'mat-4',name:'Flexbase',full_load_yards:20,full_load_price:720,price_per_yard:38,tons_per_cubic_yard:1.4}],
      app_settings:{company_address:'7653 S FM 148',company_city_state_zip:'Kaufman, TX 75142',delivery_tier_1_fee:100,delivery_tier_1_max_miles:10,tax_enabled:false},
      control_center_settings:{ai_english:true,ai_spanish:true,route_intelligence_enabled:true,route_status:'READY'},
    })
    const result=await generateAiDraft(service,{lead_id:'lead'},'actor',{apiKey:'fixture',baseUrl:'https://example.test',model:'existing-model',googleMapsApiKey:'maps-key'})
    expect(result.decision).toMatchObject({requires_human:false,ai_may_continue:true,recommended_action:'ANSWER_CUSTOMER'})
    expect(result.decision.subtask_escalations).toHaveLength(1)
    expect(service.rpc).toHaveBeenCalledWith('apply_ai_material_to_quote',{p_lead_id:'lead',p_expected_revision:1,p_material_id:'base',p_yards:28})
    expect(service.rpc).toHaveBeenCalledWith('apply_ai_route_to_quote',expect.objectContaining({p_expected_revision:1,p_address:'4625 Virginia Ave, Dallas, TX 75204',p_distance_miles:10}))
    expect(autonomousReply(result.decision,result.tool_results.pricing)).toContain('$1224.00')
  })
})
