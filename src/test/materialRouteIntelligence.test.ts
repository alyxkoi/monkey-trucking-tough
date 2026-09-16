// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { isSimpleAcceptance, resolveConversationQuantity } from '../../supabase/functions/_shared/material-intelligence'
import { calculateDeliveryRoute, deliveryForMiles, resolveDeliveryAddress, routeEvidenceFingerprint } from '../../supabase/functions/_shared/route-intelligence'

const material = {
  id: 'flexbase', name: 'Flexbase First Class 1" or 3"', full_load_yards: 20,
  full_load_price: 720, price_per_yard: 38, tons_per_cubic_yard: 1.4,
  tons_conversion_basis: 'OPERATIONAL_ESTIMATE', tons_conversion_verified: false,
}

const settings = {
  company_address: '7653 S FM 148', company_city_state_zip: 'Kaufman, TX 75142',
  delivery_tier_1_max_miles: 2, delivery_tier_1_fee: 0,
  delivery_tier_2_max_miles: 5, delivery_tier_2_fee: 60,
  delivery_tier_3_max_miles: 10, delivery_tier_3_fee: 100,
  delivery_overage_base_fee: 100, delivery_overage_per_mile: 10,
}

describe('material and route intelligence', () => {
  it('uses a corrected ZIP instead of retaining the ZIP on the earlier address', () => {
    expect(resolveDeliveryAddress([
      {sender_type:'CUSTOMER',body:'839 S Good Latimer Expy, Dallas, TX 75204'},
      {sender_type:'AI',body:'could you check the ZIP?'},
      {sender_type:'CUSTOMER',body:'ZIP is 75226'},
    ],null,[])).toBe('839 S Good Latimer Expy, Dallas, TX 75226')
  })
  it('asks only for locality before routing a street-only address', async () => {
    const fetcher=vi.fn()
    const result=await calculateDeliveryRoute({messages:[{sender_type:'CUSTOMER',body:'839 S Good Latimer Expy'}],state:null,quotes:[],settings,enabled:true,apiKey:'fixture',fetcher})
    expect(result).toMatchObject({status:'NEEDS_CLARIFICATION',reason:'A city or ZIP is needed to distinguish the street.'})
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('preserves a multiline Expy address with country and accepts the real Google RPC status', async () => {
    const messages = [{sender_type:'CUSTOMER',body:'839 S Good Latimer Expy\nDallas, TX 75226\nUnited States'}]
    expect(resolveDeliveryAddress(messages,null,[])).toBe('839 S Good Latimer Expy, Dallas, TX 75226, United States')
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({routes:[{distanceMeters:60000,duration:'3500s'}],geocodingResults:{destination:{geocoderStatus:{},placeId:'actual-shape'}}})))
    const result=await calculateDeliveryRoute({messages,state:null,quotes:[],settings,enabled:true,apiKey:'fixture',fetcher:fetcher as typeof fetch})
    expect(result.status).toBe('ROUTE_CALCULATED')
    expect(result.distance_miles).toBeCloseTo(60000/1609.344)
  })

  it('retains aliases after renaming the stable asphalt catalog record', () => {
    expect(resolveConversationQuantity([{sender_type:'CUSTOMER',body:'10 tons of millings'}],[{...material,catalog_key:'mat-6',name:'Millings Asphalt 1/2"'}])).toMatchObject({status:'RESOLVED',yards:9})
  })

  it('combines a city answer with the preceding street rather than losing it', () => {
    expect(resolveDeliveryAddress([
      {sender_type:'CUSTOMER',body:'123 Oak Road'},
      {sender_type:'AI',body:'what city is that in?'},
      {sender_type:'CUSTOMER',body:'Dallas, TX'},
    ],null,[])).toBe('123 Oak Road, Dallas, TX')
  })
  it('converts the latest customer ton amount and ignores an older quantity', () => {
    const result = resolveConversationQuantity([
      { id: '1', sender_type: 'CUSTOMER', body: 'I need about 45 yards of flexbase' },
      { id: '2', sender_type: 'CUSTOMER', body: 'actually it is 10 tons, not sure how many yards' },
    ], [material])
    expect(result).toMatchObject({
      status: 'RESOLVED', input_unit: 'TONS', input_value: 10,
      raw_yards: 10 / 1.4, estimated_yards: 7.1,
      coverage_buffer_yards: 1, recommended_yards: 9, yards: 9,
      tons_per_cubic_yard: 1.4,
    })
  })

  it('accepts the immediately preceding human yard proposal instead of resurrecting old tons', () => {
    const result = resolveConversationQuantity([
      { id: '1', sender_type: 'CUSTOMER', body: '10 tons of flexbase' },
      { id: '2', sender_type: 'HUMAN', body: 'that is about 20 yards' },
      { id: '3', sender_type: 'CUSTOMER', body: "okay let's do that" },
    ], [material])
    expect(result).toMatchObject({ status: 'RESOLVED', input_unit:'YARDS', yards:20, coverage_buffer_yards:0, source_message_id:'3' })
    expect(isSimpleAcceptance("okay let's do that")).toBe(true)
  })

  it('does not add a reserve when the customer already gives a yard quantity', () => {
    const result = resolveConversationQuantity([
      { id: '1', sender_type: 'CUSTOMER', body: 'I need 10 yards of flexbase' },
    ], [material])
    expect(result).toMatchObject({
      status: 'RESOLVED', input_unit: 'YARDS', input_value: 10,
      estimated_yards: 10, recommended_yards: 10, coverage_buffer_yards: 0, yards: 10,
    })
  })

  it('joins a ZIP-only follow-up to the latest customer street address', () => {
    expect(resolveDeliveryAddress([
      { sender_type: 'CUSTOMER', body: 'My address is 4625 Virginia Ave, Dallas, TX' },
      { sender_type: 'AI', body: 'What is the ZIP code?' },
      { sender_type: 'CUSTOMER', body: '75204' },
    ], null, [])).toBe('4625 Virginia Ave, Dallas, TX 75204')
  })

  it('does not mistake a five-digit street number for a ZIP code', () => {
    expect(resolveDeliveryAddress([
      { sender_type: 'CUSTOMER', body: 'My address is 12345 Main St, Dallas, TX' },
      { sender_type: 'CUSTOMER', body: 'ZIP is 75204' },
    ], null, [])).toBe('12345 Main St, Dallas, TX 75204')
  })

  it('fails closed when a material has no configured density', () => {
    expect(resolveConversationQuantity([
      { sender_type: 'CUSTOMER', body: '10 tons of flexbase' },
    ], [{ ...material, tons_per_cubic_yard: null }])).toMatchObject({ status: 'UNAVAILABLE' })
  })

  it('uses the official delivery tiers including overage per mile', () => {
    expect(deliveryForMiles(2, settings)).toEqual({ type: 'tier_1', fee_per_load: 0 })
    expect(deliveryForMiles(5, settings)).toEqual({ type: 'tier_2', fee_per_load: 60 })
    expect(deliveryForMiles(10, settings)).toEqual({ type: 'tier_3', fee_per_load: 100 })
    expect(deliveryForMiles(15, settings)).toEqual({ type: 'over_10', fee_per_load: 150 })
  })

  it('requests a traffic-unaware Google route and returns provider mileage', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body))
      expect(request.origin.address).toBe('7653 S FM 148, Kaufman, TX 75142')
      expect(request.destination.address).toContain('123 Oak Road')
      expect(request.routingPreference).toBe('TRAFFIC_UNAWARE')
      return new Response(JSON.stringify({
        routes: [{ distanceMeters: 24_140, duration: '1200s' }],
        geocodingResults: { destination: { geocoderStatus: 'OK', partialMatch: false, placeId: 'place-1' } },
      }))
    })
    const result = await calculateDeliveryRoute({
      messages: [{ sender_type: 'CUSTOMER', body: 'deliver to 123 Oak Road, Terrell, TX 75160' }],
      state: null, quotes: [], settings, enabled: true, apiKey: 'fixture', fetcher: fetcher as typeof fetch,
    })
    expect(result).toMatchObject({ status: 'ROUTE_CALCULATED', destination_place_id: 'place-1' })
    expect(result.distance_miles).toBeCloseTo(15, 3)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('reports the exact provider failure and stage timings without losing the resolved address', async () => {
    const result=await calculateDeliveryRoute({
      messages:[{sender_type:'CUSTOMER',body:'deliver to 123 Oak Road, Terrell, TX 75160'}],
      state:null,quotes:[],settings,enabled:true,apiKey:'fixture',
      fetcher:vi.fn(async()=>new Response('{}',{status:503})) as typeof fetch,
    })
    expect(result).toMatchObject({status:'UNAVAILABLE',destination:'123 Oak Road, Terrell, TX 75160'})
    expect(result.diagnostics).toMatchObject({address_source:'MESSAGE',provider_called:true,provider_http_status:503,error:'Google Routes HTTP 503.'})
    expect(result.diagnostics?.total_ms).toBeGreaterThanOrEqual(0)
    expect(result.diagnostics?.provider_ms).toBeGreaterThanOrEqual(0)
  })

  it('does not estimate mileage without an exact address or a provider key', async () => {
    expect(await calculateDeliveryRoute({ messages: [], state: null, quotes: [], settings, enabled: true })).toMatchObject({ status: 'NOT_READY' })
    expect(await calculateDeliveryRoute({
      messages: [{ sender_type: 'CUSTOMER', body: '123 Oak Road, Terrell, TX 75160' }],
      state: null, quotes: [], settings, enabled: true,
    })).toMatchObject({ status: 'SETUP_REQUIRED' })
  })

  it('reuses the route already stored on the same draft quote', async () => {
    const result = await calculateDeliveryRoute({
      messages: [{ sender_type: 'CUSTOMER', body: '123 Oak Road, Terrell, TX 75160' }],
      state: null,
      quotes: [{ status: 'DRAFT', address: '123 Oak Road, Terrell, TX 75160', delivery_distance_source: 'GOOGLE_ROUTES', delivery_distance_calculated_at:new Date().toISOString(), delivery_miles: 15, delivery_origin: '7653 S FM 148, Kaufman, TX 75142', delivery_destination_place_id: 'place-1' }],
      settings, enabled: true,
    })
    expect(result).toMatchObject({ status: 'ROUTE_CALCULATED', distance_miles: 15, cached: true })
  })
  it('reuses persistent lead evidence only while the address, origin and delivery settings match', async()=>{
    const origin='7653 S FM 148, Kaufman, TX 75142',destination='123 Oak Road, Terrell, TX 75160'
    const lead={route_evidence_fingerprint:routeEvidenceFingerprint(origin,destination,settings),route_evidence_miles:15,
      route_evidence_place_id:'place-lead',route_evidence_calculated_at:new Date().toISOString()}
    const reused=await calculateDeliveryRoute({messages:[{sender_type:'CUSTOMER',body:destination}],state:null,lead,quotes:[],settings,enabled:true,apiKey:'fixture'})
    expect(reused).toMatchObject({status:'ROUTE_CALCULATED',distance_miles:15,cached:true,destination_place_id:'place-lead',diagnostics:{cache_source:'LEAD',provider_called:false}})
    const changed=await calculateDeliveryRoute({messages:[{sender_type:'CUSTOMER',body:destination}],state:null,lead,quotes:[],settings:{...settings,delivery_tier_2_fee:999},enabled:true})
    expect(changed).toMatchObject({status:'SETUP_REQUIRED'})
  })
})
