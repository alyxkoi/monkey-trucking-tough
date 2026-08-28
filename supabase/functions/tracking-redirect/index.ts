import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (status: number, error: string) => new Response(JSON.stringify({ error }), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

function requestedSlug(req: Request): string {
  const url = new URL(req.url)
  const querySlug = url.searchParams.get('slug')?.trim()
  if (querySlug) return querySlug
  const marker = '/tracking-redirect/'
  const pathSlug = url.pathname.includes(marker) ? url.pathname.split(marker)[1] : ''
  try {
    return decodeURIComponent(pathSlug ?? '').split('/')[0].trim()
  } catch {
    return ''
  }
}

function publicDestination(raw: string): URL {
  const value = raw.trim()
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported destination protocol')
  return url
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, 'Method not allowed')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json(503, 'Tracking is not configured')

  const slug = requestedSlug(req)
  if (!slug) return json(400, 'Tracking link is required')

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: link, error: linkError } = await service
    .from('tracking_links')
    .select('id,source,campaign,destination,is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (linkError) {
    console.error('Tracking link lookup failed', linkError)
    return json(503, 'Tracking is temporarily unavailable')
  }
  if (!link) return json(404, 'Tracking link not found')
  if (!link.is_active) return json(410, 'This tracking link is archived')

  if (req.method === 'GET') {
    const { error: visitError } = await service.from('tracking_link_visits').insert({
      tracking_link_id: link.id,
    })
    if (visitError) {
      console.error('Tracking visit insert failed', visitError)
      return json(503, 'Tracking is temporarily unavailable')
    }
  }

  let destination: URL
  try {
    destination = publicDestination(link.destination)
  } catch (error) {
    console.error('Invalid tracking destination', error)
    return json(500, 'Tracking destination is invalid')
  }

  destination.searchParams.set('mt_source', link.source)
  destination.searchParams.set('mt_campaign', link.campaign)
  destination.searchParams.set('mt_tracking', link.id)

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.toString(),
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })
})
