/* eslint-disable @typescript-eslint/no-explicit-any */

export type QuantityResolution = {
  status: 'NOT_READY' | 'RESOLVED' | 'UNAVAILABLE'
  material_id?: string
  material_name?: string
  input_unit?: 'TONS' | 'YARDS'
  input_value?: number
  yards?: number
  raw_yards?: number
  estimated_yards?: number
  recommended_yards?: number
  coverage_buffer_yards?: number
  tons_per_cubic_yard?: number
  conversion_basis?: string
  conversion_verified?: boolean
  source_message_id?: string | null
  reason?: string
}

const MATERIAL_ALIASES: Record<string, string[]> = {
  'commercial crushed concrete clean': ['commercial crushed concrete', 'clean crushed concrete', 'crushed concrete clean'],
  'select fill and cushion sand': ['select fill', 'cushion sand'],
  '3x4 crushed concrete': ['3x4 crushed concrete', '3 x 4 crushed concrete'],
  'flexbase first class 1" or 3"': ['flexbase', 'flex base', 'first class base'],
  'mason sand': ['mason sand', 'arena mason'],
  'millings asphalt 1/2" minus': ['asphalt millings', 'millings asphalt', 'millings'],
  'native gravel 3/8"-1"': ['native gravel', 'grava nativa'],
  'concrete sand mix native gravel': ['concrete sand mix', 'sand mix native gravel'],
  'decomposed granite': ['decomposed granite', 'granite'],
  'limestone 1"-1 1/2"': ['limestone', 'piedra caliza'],
}

const normalize = (value: string) => value.toLowerCase().replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

function materialForText(text: string, materials: any[]) {
  const normalized = normalize(text)
  let best: { material: any; index: number; length: number } | null = null
  for (const material of materials) {
    const canonical = normalize(String(material.name ?? ''))
    const aliases = [canonical, ...(MATERIAL_ALIASES[canonical] ?? [])]
    for (const alias of aliases) {
      const index = normalized.lastIndexOf(alias)
      if (index >= 0 && (!best || index > best.index || (index === best.index && alias.length > best.length))) {
        best = { material, index, length: alias.length }
      }
    }
  }
  return best?.material ?? null
}

function lastQuantity(text: string) {
  const matches: Array<{ index: number; unit: 'TONS' | 'YARDS'; value: number }> = []
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:short\s+)?(?:tons?|toneladas?)\b/gi)) {
    matches.push({ index: match.index ?? 0, unit: 'TONS', value: Number(match[1]) })
  }
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:cubic\s+)?(?:yards?|yardas?)\b/gi)) {
    matches.push({ index: match.index ?? 0, unit: 'YARDS', value: Number(match[1]) })
  }
  return matches.sort((a, b) => a.index - b.index).at(-1) ?? null
}

const COVERAGE_BUFFER_YARDS = 1
const roundToTenthYard = (value: number) => Math.round(value * 10) / 10
const roundUpToHalfYard = (value: number) => Math.ceil(value * 2) / 2

export function resolveConversationQuantity(messages: any[], materials: any[]): QuantityResolution {
  let currentMaterial: any = null
  let quantity: ReturnType<typeof lastQuantity> = null
  let sourceMessageId: string | null = null

  for (const message of messages) {
    if (message.sender_type !== 'CUSTOMER') continue
    currentMaterial = materialForText(String(message.body ?? ''), materials) ?? currentMaterial
    const found = lastQuantity(String(message.body ?? ''))
    if (found) {
      quantity = found
      sourceMessageId = message.id ?? null
    }
  }

  if (!quantity) return { status: 'NOT_READY', reason: 'A yard or ton quantity is required.' }
  if (!Number.isFinite(quantity.value) || quantity.value <= 0 || quantity.value > 10_000) {
    return { status: 'UNAVAILABLE', reason: 'The quantity is outside the supported range.' }
  }
  if (!currentMaterial) return { status: 'NOT_READY', input_unit: quantity.unit, input_value: quantity.value, reason: 'A specific catalog material is required.' }

  if (quantity.unit === 'YARDS') {
    return {
      status: 'RESOLVED', material_id: currentMaterial.id, material_name: currentMaterial.name,
      input_unit: 'YARDS', input_value: quantity.value, yards: quantity.value, raw_yards: quantity.value,
      estimated_yards: quantity.value, recommended_yards: quantity.value, coverage_buffer_yards: 0,
      source_message_id: sourceMessageId,
    }
  }

  const factor = Number(currentMaterial.tons_per_cubic_yard)
  if (!Number.isFinite(factor) || factor <= 0 || factor > 5) {
    return {
      status: 'UNAVAILABLE', material_id: currentMaterial.id, material_name: currentMaterial.name,
      input_unit: 'TONS', input_value: quantity.value, source_message_id: sourceMessageId,
      reason: 'This material needs a tons-per-cubic-yard factor in Settings.',
    }
  }
  const rawYards = quantity.value / factor
  const estimatedYards = roundToTenthYard(rawYards)
  const recommendedYards = roundUpToHalfYard(rawYards + COVERAGE_BUFFER_YARDS)
  return {
    status: 'RESOLVED', material_id: currentMaterial.id, material_name: currentMaterial.name,
    input_unit: 'TONS', input_value: quantity.value, raw_yards: rawYards,
    estimated_yards: estimatedYards, recommended_yards: recommendedYards,
    coverage_buffer_yards: COVERAGE_BUFFER_YARDS, yards: recommendedYards,
    tons_per_cubic_yard: factor,
    conversion_basis: currentMaterial.tons_conversion_basis ?? 'OPERATIONAL_ESTIMATE',
    conversion_verified: Boolean(currentMaterial.tons_conversion_verified),
    source_message_id: sourceMessageId,
  }
}

export function isSimpleAcceptance(text: string) {
  return /^(?:(?:ok(?:ay)?|yes|yep|yeah|sure|perfect|si|sí)[,\s]+)?(?:ok(?:ay)?|yes|yep|yeah|sure|sounds good|let'?s do (?:it|that)|do that|perfect|si|sí|est[aá] bien|vamos a hacerlo)[.!\s]*$/i.test(text.trim())
}
