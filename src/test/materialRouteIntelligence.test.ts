// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { isSimpleAcceptance, resolveConversationQuantity } from '../../supabase/functions/_shared/material-intelligence'
import { calculateDeliveryRoute, deliveryForMiles } from '../../supabase/functions/_shared/route-intelligence'

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
  it('converts the latest customer ton amount and ignores an older quantity', () => {
    const result = resolveConversationQuantity([
      { id: '1', sender_type: 'CUSTOMER', body: 'I need about 45 yards of flexbase' },
      { id: '2', sender_type: 'CUSTOMER', body: 'actually it is 10 tons, not sure how many yards' },
    ], [material])
    expect(result).toMatchObject({ status: 'RESOLVED', input_unit: 'TONS', input_value: 10, yards: 7, tons_per_cubic_yard: 1.4 })
  })

  it('keeps the deterministic conversion when the customer accepts after a conflicting human estimate', () => {
    const result = resolveConversationQuantity([
      { id: '1', sender_type: 'CUSTOMER', body: '10 tons of flexbase' },
      { id: '2', sender_type: 'HUMAN', body: 'that is about 20 yards' },
      { id: '3', sender_type: 'CUSTOMER', body: "okay let's do that" },
    ], [material])
    expect(result).toMatchObject({ status: 'RESOLVED', yards: 7, source_message_id: '1' })
    expect(isSimpleAcceptance("okay let's do that")).toBe(true)
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
      quotes: [{ status: 'DRAFT', address: '123 Oak Road, Terrell, TX 75160', delivery_distance_source: 'GOOGLE_ROUTES', delivery_miles: 15, delivery_origin: '7653 S FM 148, Kaufman, TX 75142', delivery_destination_place_id: 'place-1' }],
      settings, enabled: true,
    })
    expect(result).toMatchObject({ status: 'ROUTE_CALCULATED', distance_miles: 15, cached: true })
  })
})
