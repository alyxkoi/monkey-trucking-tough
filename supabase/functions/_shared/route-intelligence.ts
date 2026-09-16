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
  resolved_at?: number
  diagnostics?: RouteDiagnostics
}

export type RouteDiagnostics = {
  address_source: 'MESSAGE' | 'STATE' | 'QUOTE' | 'NONE'
  address_parse_ms: number
  cache_lookup_ms: number
  provider_called: boolean
  provider_http_status: number | null
  provider_ms: number
  response_parse_ms: number
  total_ms: number
  cache_source: 'MEMORY' | 'QUOTE' | null
  error: string | null
}

// Server-owned, short-lived cache only. Never accept route evidence from the
// sandbox browser. Recompute fees from current settings on every use.
const routeCache=new Map<string,RouteResult>()
const ROUTE_TTL_MS=5*60_000

export function addressFromText(text: string) {
  // Keep pasted street / city / ZIP lines together. A street suffix, not an
  // arbitrary number, distinguishes an address from a material quantity.
  const compact = text.replace(/\r?\n+/g, ', ').replace(/\s+/g, ' ').trim()
  const street = /\b\d{1,6}\s+(?:[a-z.'’]+\s+){0,7}(?:road|rd|street|st|avenue|ave|lane|ln|drive|dr|highway|hwy|expressway|expy|parkway|pkwy|boulevard|blvd|court|ct|circle|cir|trail|trl|way|fm|county road|cr)\b/i.exec(compact)
  if (!street) return null
  return compact.slice(street.index).split(/[?!]|\.\s+(?=[A-Z])|\s+(?:i['’]?m|i am|i need|i want|looking to|looking for)\b/i)[0].replace(/[.,\s]+$/, '').slice(0, 240)
}

function postalCodeFromText(text: string) {
  const explicit = text.match(/\b(?:zip(?:\s+code)?|postal(?:\s+code)?)\s*(?:is|:)?\s*(\d{5}(?:-\d{4})?)\b/i)?.[1]
  return explicit ?? text.match(/(?:^|[\s,])(\d{5}(?:-\d{4})?)(?=\s*(?:[,\s]+(?:United States|USA|US))?\s*[.!?]?\s*$)/i)?.[1] ?? null
}

function withPostalCode(address: string, postalCode: string | null) {
  if (!postalCode) return address
  const existing = postalCodeFromText(address)
  if (existing) return address.replace(new RegExp(`\\b${existing}\\b`), postalCode)
  return `${address} ${postalCode}`
}

function resolveDeliveryAddressWithSource(messages: any[], state: any, quotes: any[]) {
  let latestPostalCode: string | null = null
  let latestCity: string | null = null
  for (const message of [...messages].reverse()) {
    if (message.sender_type !== 'CUSTOMER') continue
    const body = String(message.body ?? '')
    latestPostalCode ??= postalCodeFromText(body)
    const address = addressFromText(body)
    if (address) return {address:withPostalCode(latestCity ? `${address}, ${latestCity}` : address, latestPostalCode),source:'MESSAGE' as const}
    const previous = messages[messages.indexOf(message)-1]
    if (!latestCity && previous?.sender_type === 'AI' && /\b(city|ciudad)\b/i.test(previous.body ?? '')
      && /^[a-z][a-z .,'’]{1,60}(?:\s+\d{5})?[.!]?$/i.test(body.trim())
      && !/^(yes|no|ok|okay|si|sí|sure)[.!]?$/i.test(body.trim())) latestCity = body.trim().replace(/[.!]$/, '')
  }
  const known = Array.isArray(state?.known_facts) ? state.known_facts : []
  const stateAddress = [...known].reverse().find((fact: any) => ['delivery_address', 'address'].includes(fact?.key))?.value
  const statePostalCode = [...known].reverse().find((fact: any) => ['delivery_zip', 'postal_code', 'zip'].includes(fact?.key))?.value
  if (typeof stateAddress === 'string' && stateAddress.trim()) {
    return {address:withPostalCode(latestCity ? `${stateAddress.trim()}, ${latestCity}` : stateAddress.trim(), latestPostalCode ?? (typeof statePostalCode === 'string' ? statePostalCode.trim() : null)),source:'STATE' as const}
  }
  const draftAddress = quotes.find((quote) => ['DRAFT','SENT','ACCEPTED'].includes(quote.status) && String(quote.address ?? '').trim())?.address
  return typeof draftAddress === 'string'
    ? {address:withPostalCode(draftAddress.trim(), latestPostalCode),source:'QUOTE' as const}
    : {address:null,source:'NONE' as const}
}

export function resolveDeliveryAddress(messages: any[], state: any, quotes: any[]) {
  return resolveDeliveryAddressWithSource(messages,state,quotes).address
}

export function addressClarification(destination: string | undefined, language: string) {
  const es = language === 'SPANISH'
  if (!destination) return es ? 'cuál es la dirección de entrega.' : 'what is the delivery address?'
  const hasZip = Boolean(postalCodeFromText(destination))
  const hasLocality = /,\s*[a-z]/i.test(destination) || /\b(?:TX|Texas)\b/i.test(destination)
  if (!hasZip && !hasLocality) return es ? `en qué ciudad o código postal está ${destination}?` : `what city or ZIP code is ${destination} in?`
  return es
    ? `no pude verificar ${destination}. puede revisar el número y nombre de la calle?`
    : `i couldn't verify ${destination}. could you check the street number and name?`
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
  const started=Date.now()
  const diagnostics:RouteDiagnostics={address_source:'NONE',address_parse_ms:0,cache_lookup_ms:0,provider_called:false,provider_http_status:null,provider_ms:0,response_parse_ms:0,total_ms:0,cache_source:null,error:null}
  const finish=(result:Omit<RouteResult,'diagnostics'>):RouteResult=>({...result,diagnostics:{...diagnostics,total_ms:Date.now()-started}})
  if (!input.enabled) return finish({ status: 'OFF', reason: 'Route intelligence is turned off.' })
  const origin = [input.settings?.company_address, input.settings?.company_city_state_zip].filter(Boolean).join(', ').trim()
  const addressStarted=Date.now()
  const resolved=resolveDeliveryAddressWithSource(input.messages,input.state,input.quotes)
  const destination=resolved.address
  diagnostics.address_source=resolved.source
  diagnostics.address_parse_ms=Date.now()-addressStarted
  if (!origin) { diagnostics.error='Business origin address is missing.'; return finish({ status: 'UNAVAILABLE', reason: diagnostics.error }) }
  if (!destination) return finish({ status: 'NOT_READY', origin, reason: 'An exact delivery address is required.' })
  // A street alone can geocode to a different city without partialMatch.
  // Obtain one locality hint before allowing Google to select a destination.
  if (/\b(?:road|rd|street|st|avenue|ave|lane|ln|drive|dr|highway|hwy|expressway|expy|parkway|pkwy|boulevard|blvd|court|ct|circle|cir|trail|trl|way|fm|cr)\.?\s*(?:\d{1,4})?$/i.test(destination)) {
    return finish({ status: 'NEEDS_CLARIFICATION', origin, destination, reason: 'A city or ZIP is needed to distinguish the street.' })
  }
  const cacheStarted=Date.now()
  const cacheKey=JSON.stringify([origin.toLowerCase(),destination.toLowerCase()])
  const recent=routeCache.get(cacheKey)
  if(!input.fetcher&&recent&&Date.now()-(recent.resolved_at??0)<ROUTE_TTL_MS) {
    const fee=deliveryForMiles(recent.distance_miles!,input.settings)
    diagnostics.cache_lookup_ms=Date.now()-cacheStarted;diagnostics.cache_source='MEMORY'
    const {diagnostics:_oldDiagnostics,...cachedRoute}=recent
    return finish({...cachedRoute,origin,destination,delivery_type:fee?.type,delivery_fee_per_load:fee?.fee_per_load,cached:true})
  }
  const cached = input.quotes.find((quote) => quote.status === 'DRAFT'
    && quote.delivery_distance_source === 'GOOGLE_ROUTES'
    && Date.now()-Date.parse(quote.delivery_distance_calculated_at)<24*60*60_000
    && String(quote.address ?? '').trim().toLowerCase() === destination.toLowerCase()
    && quote.delivery_origin === origin
    && quote.delivery_miles!=null&&Number.isFinite(Number(quote.delivery_miles)))
  diagnostics.cache_lookup_ms=Date.now()-cacheStarted
  if (cached) { diagnostics.cache_source='QUOTE'; return finish({
    status: 'ROUTE_CALCULATED', origin: cached.delivery_origin || origin, destination,
    distance_miles: Number(cached.delivery_miles), destination_place_id: cached.delivery_destination_place_id ?? null,
    duration_seconds: null, delivery_type: cached.delivery_type ?? null,
    delivery_fee_per_load: deliveryForMiles(Number(cached.delivery_miles), input.settings)?.fee_per_load ?? null,
    cached: true,
  }) }
  if (!input.apiKey) { diagnostics.error='Google Routes is not connected.'; return finish({ status: 'SETUP_REQUIRED', origin, destination, reason: diagnostics.error }) }

  let providerStarted=0
  try {
    diagnostics.provider_called=true
    providerStarted=Date.now()
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
    diagnostics.provider_ms=Date.now()-providerStarted
    diagnostics.provider_http_status=response.status
    if (!response.ok) { diagnostics.error=`Google Routes HTTP ${response.status}.`; return finish({ status: 'UNAVAILABLE', origin, destination, reason: diagnostics.error }) }
    const parseStarted=Date.now()
    const body = await response.json()
    diagnostics.response_parse_ms=Date.now()-parseStarted
    const geocoded = body?.geocodingResults?.destination
    // Google represents geocoderStatus as google.rpc.Status ({} means OK),
    // not just a string. Treating {} !== 'OK' caused endless clarification.
    const status = geocoded?.geocoderStatus
    const failedStatus = typeof status === 'string' ? status !== 'OK' : Number(status?.code ?? 0) !== 0
    if (geocoded?.partialMatch || failedStatus) {
      return finish({ status: 'NEEDS_CLARIFICATION', origin, destination, reason: 'The delivery address did not resolve exactly.' })
    }
    const distanceMeters = Number(body?.routes?.[0]?.distanceMeters)
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) { diagnostics.error='Google Routes returned no drivable route.'; return finish({ status: 'UNAVAILABLE', origin, destination, reason: 'No drivable route was returned.' }) }
    const seconds = Number(String(body?.routes?.[0]?.duration ?? '').replace(/s$/, ''))
    const distanceMiles = distanceMeters / 1609.344
    const delivery = deliveryForMiles(distanceMiles, input.settings)
    const result:RouteResult = {
      status: 'ROUTE_CALCULATED', origin, destination, distance_meters: distanceMeters,
      distance_miles: distanceMiles,
      duration_seconds: Number.isFinite(seconds) ? seconds : null,
      destination_place_id: geocoded?.placeId ?? null,
      delivery_type: delivery?.type ?? null,
      delivery_fee_per_load: delivery?.fee_per_load ?? null,
      resolved_at:Date.now(),
    }
    if(!input.fetcher){if(routeCache.size>=200)routeCache.delete(routeCache.keys().next().value!);routeCache.set(cacheKey,result)}
    return finish(result)
  } catch(error) {
    if(providerStarted&&diagnostics.provider_ms===0)diagnostics.provider_ms=Date.now()-providerStarted
    diagnostics.error=error instanceof Error?`${error.name}: ${error.message}`:'Google Routes request failed.'
    return finish({ status: 'UNAVAILABLE', origin, destination, reason: 'Google Routes could not be reached.' })
  }
}
