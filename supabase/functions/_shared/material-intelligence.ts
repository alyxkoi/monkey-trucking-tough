/* eslint-disable @typescript-eslint/no-explicit-any */

export type QuantityResolution = {
  status: 'NOT_READY' | 'RESOLVED' | 'UNAVAILABLE'
  material_id?: string
  material_name?: string
  material_catalog_key?: string
  material_candidates?: Array<{id:string;catalog_key:string|null;name:string}>
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
  'commercial crushed concrete clean': ['commercial', 'commercial clean', 'commercial crushed concrete', 'clean crushed concrete', 'crushed concrete clean'],
  'select fill and cushion sand': ['select fill', 'cushion sand'],
  '3x4 crushed concrete': ['3x4', '3 x 4', '3x4 crushed concrete', '3 x 4 crushed concrete'],
  'flexbase first class 1" or 3"': ['flexbase', 'flex base', 'first class base'],
  'mason sand': ['mason sand', 'arena mason'],
  'millings asphalt 1/2" minus': ['asphalt millings', 'millings asphalt', 'millings'],
  'native gravel 3/8"-1"': ['native gravel', 'grava nativa'],
  'concrete sand mix native gravel': ['concrete sand mix', 'sand mix native gravel'],
  'decomposed granite': ['decomposed granite', 'granite'],
  'limestone 1"-1 1/2"': ['limestone', 'piedra caliza'],
}

const normalize = (value: string) => value.toLowerCase().replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

export function materialCandidates(text: string, materials: any[]) {
  const normalized = normalize(text)
  const found: Array<{material:any;index:number;length:number}> = []
  for (const material of materials) {
    const canonical = normalize(String(material.name ?? ''))
    const identityName = material.catalog_key === 'mat-6' ? 'millings asphalt 1/2" minus' : Object.keys(MATERIAL_ALIASES)[Number(String(material.catalog_key ?? '').replace('mat-', '')) - 1]
    const aliases = [canonical, ...(MATERIAL_ALIASES[identityName ?? canonical] ?? MATERIAL_ALIASES[canonical] ?? [])]
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (!alias) continue
      const matches = [...normalized.matchAll(new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'g'))]
      for (const match of matches) {
        found.push({material,index:match.index!,length:alias.length})
      }
    }
  }
  // Longer overlapping aliases win, but separate product mentions are never
  // silently collapsed into the last product in a comparison question.
  const specific = found.filter(a=>!found.some(b=>b!==a&&b.length>a.length&&b.index<=a.index&&b.index+b.length>=a.index+a.length))
  if (!specific.length && /\bcrushed concrete\b/i.test(text)) return materials.filter(m=>['mat-1','mat-3'].includes(m.catalog_key)||/crushed concrete/i.test(m.name))
  return [...new Map(specific.map(item=>[item.material.id,item.material])).values()]
}

function materialForText(text:string,materials:any[]) {
  const candidates=materialCandidates(text,materials)
  return candidates.length===1?candidates[0]:null
}

function lastQuantity(text: string) {
  const matches: Array<{ index: number; unit: 'TONS' | 'YARDS'; value: number }> = []
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:short\s+)?(?:tons?|toneladas?)\b/gi)) {
    matches.push({ index: match.index ?? 0, unit: 'TONS', value: Number(match[1]) })
  }
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:cubic\s+)?(?:yards?|yardas?)\b/gi)) {
    matches.push({ index: match.index ?? 0, unit: 'YARDS', value: Number(match[1]) })
  }
  return matches.filter(match=>! /\b(?:not|rather than|instead of)\s*$/i.test(text.slice(0,match.index))).sort((a, b) => a.index - b.index).at(-1) ?? null
}

const COVERAGE_BUFFER_YARDS = 1
const roundToTenthYard = (value: number) => Math.round(value * 10) / 10
const roundUpToHalfYard = (value: number) => Math.ceil(value * 2) / 2

export function resolveConversationQuantity(messages: any[], materials: any[], state?:any): QuantityResolution {
  const facts=Array.isArray(state?.known_facts)?state.known_facts:[]
  const fact=(key:string)=>facts.find((f:any)=>f.key===key)?.value
  let currentMaterial: any = materials.find(m=>m.id===fact('material_id')||m.catalog_key&&m.catalog_key===fact('material_catalog_key'))??null
  let quantity: ReturnType<typeof lastQuantity> = fact('quantity_input_value') && ['TONS','YARDS'].includes(fact('quantity_input_unit'))
    ? {index:0,unit:fact('quantity_input_unit'),value:Number(fact('quantity_input_value'))}
    : fact('quantity_yards') ? {index:0,unit:'YARDS',value:Number(fact('quantity_yards'))}:null
  let candidates:any[]=[]
  let sourceMessageId: string | null = null

  for (const [index,message] of messages.entries()) {
    if (message.sender_type !== 'CUSTOMER') continue
    const body=String(message.body ?? '')
    const selections=[...body.matchAll(/\b(?:go with|choose|use|want|make it|make that|quiero|prefiero|mejor)\s+/gi)]
    const selector=selections.at(-1)
    const explicitSelection=selector?body.slice(selector.index!+selector[0].length):undefined
    const comparing=/\b(difference|compare|versus|vs|recommend|diferencia|recomienda)\b/i.test(body)
    const selectedMentions=explicitSelection?materialCandidates(explicitSelection,materials):[]
    const mentions=selectedMentions.length?selectedMentions:materialCandidates(body,materials)
    if (!comparing || explicitSelection) {
      if(mentions.length===1){currentMaterial=mentions[0];candidates=[]}
      else if(mentions.length>1){currentMaterial=null;candidates=mentions}
    }
    let found = lastQuantity(body)
    // A bare correction inherits the most recent confirmed quantity unit,
    // never the unitless digits of a ZIP, address, price or product grade.
    const correction=[...body.matchAll(/\b(?:make (?:it|that)|change (?:it|that) to|c[aá]mbialo a|que sean)\s+(\d{1,4}(?:\.\d+)?)(?=\s*(?:[.!?,]|$|\b(?:and|y|for|para)\b))/gi)].at(-1)
    const previous=messages[index-1]
    const askedUnit=/\b(yards?|yardas?)\b/i.test(previous?.body??'')?'YARDS':/\b(tons?|toneladas?)\b/i.test(previous?.body??'')?'TONS':quantity?.unit
    const directAnswer=askedUnit && previous?.sender_type==='AI' && /\b(how many|cu[aá]ntas|quantity|cantidad)\b/i.test(previous.body??'')
      ? body.trim().match(/^(\d{1,4}(?:\.\d+)?)[.!\s]*$/):null
    const proposedUnit=previous?.sender_type==='AI'?lastQuantity(previous.body??'')?.unit:null
    if(correction&&quantity&&(!found||correction.index!>found.index))found={index:correction.index!,unit:proposedUnit??quantity.unit,value:Number(correction[1])}
    if(!found&&directAnswer&&askedUnit)found={index:0,unit:askedUnit,value:Number(directAnswer[1])}
    // An acceptance applies to the preceding single yard proposal, not an
    // older ton estimate. Multiple yard options still require clarification.
    if (!found && isSimpleAcceptance(String(message.body ?? '')) && ['AI','HUMAN'].includes(previous?.sender_type)) {
      const proposals=[...String(previous.body??'').matchAll(/\b(\d+(?:\.\d+)?)\s*(?:cubic\s+)?(?:yards?|yardas?)\b/gi)]
      const values=new Set(proposals.map(match=>Number(match[1])))
      if(values.size===1){
        found={index:0,unit:'YARDS',value:[...values][0]}
        currentMaterial=materialForText(String(previous.body??''),materials)??currentMaterial
      }
    }
    if (found) {
      quantity = found
      sourceMessageId = message.id ?? null
    }
  }

  const identity=currentMaterial?{material_id:currentMaterial.id,material_catalog_key:currentMaterial.catalog_key,material_name:currentMaterial.name}:{}
  if (!quantity) return { status: 'NOT_READY',...identity, material_candidates:candidates, reason: 'A yard or ton quantity is required.' }
  if (!Number.isFinite(quantity.value) || quantity.value <= 0 || quantity.value > 10_000) {
    return { status: 'UNAVAILABLE', reason: 'The quantity is outside the supported range.' }
  }
  if (!currentMaterial) return { status: 'NOT_READY', input_unit: quantity.unit, input_value: quantity.value, yards:quantity.unit==='YARDS'?quantity.value:undefined, material_candidates:candidates.map(m=>({id:m.id,catalog_key:m.catalog_key??null,name:m.name})), reason: 'A specific catalog material is required.' }

  if (quantity.unit === 'YARDS') {
    return {
      status: 'RESOLVED', ...identity,
      input_unit: 'YARDS', input_value: quantity.value, yards: quantity.value, raw_yards: quantity.value,
      estimated_yards: quantity.value, recommended_yards: quantity.value, coverage_buffer_yards: 0,
      source_message_id: sourceMessageId,
    }
  }

  const factor = Number(currentMaterial.tons_per_cubic_yard)
  if (!Number.isFinite(factor) || factor <= 0 || factor > 5) {
    return {
      status: 'UNAVAILABLE', ...identity,
      input_unit: 'TONS', input_value: quantity.value, source_message_id: sourceMessageId,
      reason: 'This material needs a tons-per-cubic-yard factor in Settings.',
    }
  }
  const rawYards = quantity.value / factor
  const estimatedYards = roundToTenthYard(rawYards)
  const recommendedYards = roundUpToHalfYard(rawYards + COVERAGE_BUFFER_YARDS)
  return {
    status: 'RESOLVED', ...identity,
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
