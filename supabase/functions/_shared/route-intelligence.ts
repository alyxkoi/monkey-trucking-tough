/* eslint-disable @typescript-eslint/no-explicit-any */

export type RouteResult = {
  status: 'NOT_READY' | 'SETUP_REQUIRED' | 'ROUTE_CALCULATED' | 'NEEDS_CLARIFICATION' | 'UNAVAILABLE' | 'OFF'
  origin?: string
  destination?: string
  distance_meters?: number
  distance_miles?: number
  duration_seconds?: number | null
  destination_place_id?: string | null
  delivery_type?: string | null
  delivery_fee_per_load?: number | null
  cached?: boolean
  reason?: string
}

function addressFromText(text: string) {
  const candidates = [...text.matchAll(/\b\d{1,6}\s+[^?\n]{3,150}/g)].map((match) => match[0].trim())
  const candidate = candidates.at(-1)
  if (!candidate || !/\b(?:road|rd|street|st|avenue|ave|lane|ln|drive|dr|highway|hwy|parkway|pkwy|boulevard|blvd|court|ct|circle|cir|trail|trl|way|fm|county road|cr)\b/i.test(candidate)) return null
  return candidate.replace(/[.,\s]+$/, '').slice(0, 180)
}

function postalCodeFromText(text: string) {
  const explicit = text.match(/\b(?:zip(?:\s+code)?|postal(?:\s+code)?)\s*(?:is|:)?\s*(\d{5}(?:-\d{4})?)\b/i)?.[1]
  return explicit ?? text.match(/(?:^|[\s,])(\d{5}(?:-\d{4})?)\s*[.!?]?\s*$/)?.[1] ?? null
}

function withPostalCode(address: string, postalCode: string | null) {
  if (!postalCode || postalCodeFromText(address)) return address
  return `${address} ${postalCode}`
}

export function resolveDeliveryAddress(messages: any[], state: any, quotes: any[]) {
  let latestPostalCode: string | null = null
  for (const message of [...messages].reverse()) {
    if (message.sender_type !== 'CUSTOMER') continue
    const body = String(message.body ?? '')
    latestPostalCode ??= postalCodeFromText(body)
    const address = addressFromText(body)
    if (address) return withPostalCode(address, latestPostalCode)
  }
  const known = Array.isArray(state?.known_facts) ? state.known_facts : []
  const stateAddress = [...known].reverse().find((fact: any) => ['delivery_address', 'address'].includes(fact?.key))?.value
  const statePostalCode = [...known].reverse().find((fact: any) => ['delivery_zip', 'postal_code', 'zip'].includes(fact?.key))?.value
  if (typeof stateAddress === 'string' && stateAddress.trim()) {
    return withPostalCode(stateAddress.trim(), typeof statePostalCode === 'string' ? statePostalCode.trim() : latestPostalCode)
  }
  const draftAddress = quotes.find((quote) => quote.status === 'DRAFT' && String(quote.address ?? '').trim())?.address
  return typeof draftAddress === 'string' ? withPostalCode(draftAddress.trim(), latestPostalCode) : null
}

export function deliveryForMiles(miles: number, settings: any) {
  if (!Number.isFinite(miles) || miles < 0 || !settings) return null
  if (miles <= Number(settings.delivery_tier_1_max_miles)) return { type: 'tier_1', fee_per_load: Number(settings.delivery_tier_1_fee) }
  if (miles <= Number(settings.delivery_tier_2_max_miles)) return { type: 'tier_2', fee_per_load: Number(settings.delivery_tier_2_fee) }
  if (miles <= Number(settings.delivery_tier_3_max_miles)) return { type: 'tier_3', fee_per_load: Number(settings.delivery_tier_3_fee) }
  return {
    type: 'over_10',
    fee_per_load: Number(settings.delivery_overage_base_fee) + (miles - Number(settings.delivery_tier_3_max_miles)) * Number(settings.delivery_overage_per_mile),
  }
}

export async function calculateDeliveryRoute(input: {
  messages: any[]
  state: any
  quotes: any[]
  settings: any
  enabled: boolean
  apiKey?: string
  fetcher?: typeof fetch
}): Promise<RouteResult> {
  if (!input.enabled) return { status: 'OFF', reason: 'Route intelligence is turned off.' }
  const origin = [input.settings?.company_address, input.settings?.company_city_state_zip].filter(Boolean).join(', ').trim()
  const destination = resolveDeliveryAddress(input.messages, input.state, input.quotes)
  if (!origin) return { status: 'UNAVAILABLE', reason: 'The business origin address is missing.' }
  if (!destination) return { status: 'NOT_READY', origin, reason: 'An exact delivery address is required.' }
  const cached = input.quotes.find((quote) => quote.status === 'DRAFT'
    && quote.delivery_distance_source === 'GOOGLE_ROUTES'
    && String(quote.address ?? '').trim().toLowerCase() === destination.toLowerCase()
    && Number.isFinite(Number(quote.delivery_miles)))
  if (cached) return {
    status: 'ROUTE_CALCULATED', origin: cached.delivery_origin || origin, destination,
    distance_miles: Number(cached.delivery_miles), destination_place_id: cached.delivery_destination_place_id ?? null,
    duration_seconds: null, delivery_type: cached.delivery_type ?? null,
    delivery_fee_per_load: Number.isFinite(Number(cached.delivery_fee_per_load)) ? Number(cached.delivery_fee_per_load) : null,
    cached: true,
  }
  if (!input.apiKey) return { status: 'SETUP_REQUIRED', origin, destination, reason: 'Google Routes is not connected.' }

  try {
    const response = await (input.fetcher ?? fetch)('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': input.apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,geocodingResults.origin.placeId,geocodingResults.origin.geocoderStatus,geocodingResults.origin.partialMatch,geocodingResults.destination.placeId,geocodingResults.destination.geocoderStatus,geocodingResults.destination.partialMatch',
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        computeAlternativeRoutes: false,
      }),
    })
    if (!response.ok) return { status: 'UNAVAILABLE', origin, destination, reason: `Google Routes returned ${response.status}.` }
    const body = await response.json()
    const geocoded = body?.geocodingResults?.destination
    if (geocoded?.partialMatch || (geocoded?.geocoderStatus && geocoded.geocoderStatus !== 'OK')) {
      return { status: 'NEEDS_CLARIFICATION', origin, destination, reason: 'The delivery address did not resolve exactly.' }
    }
    const distanceMeters = Number(body?.routes?.[0]?.distanceMeters)
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return { status: 'UNAVAILABLE', origin, destination, reason: 'No drivable route was returned.' }
    const seconds = Number(String(body?.routes?.[0]?.duration ?? '').replace(/s$/, ''))
    const distanceMiles = distanceMeters / 1609.344
    const delivery = deliveryForMiles(distanceMiles, input.settings)
    return {
      status: 'ROUTE_CALCULATED', origin, destination, distance_meters: distanceMeters,
      distance_miles: distanceMiles,
      duration_seconds: Number.isFinite(seconds) ? seconds : null,
      destination_place_id: geocoded?.placeId ?? null,
      delivery_type: delivery?.type ?? null,
      delivery_fee_per_load: delivery?.fee_per_load ?? null,
    }
  } catch {
    return { status: 'UNAVAILABLE', origin, destination, reason: 'Google Routes could not be reached.' }
  }
}
