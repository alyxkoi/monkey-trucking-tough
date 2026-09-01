// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { captureTrackingAttribution, getTrackingAttribution, trackingRedirectUrl } from '@/lib/trackingAttribution'

const read = (path: string) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20260828183000_settings_tracking_material_only_tax.sql')
const organizationMigration = read('supabase/migrations/20260901150000_tracking_link_groups_and_sessions.sql')

describe('durable Tracking Links', () => {
  beforeEach(() => window.localStorage.clear())

  it('copies a real server redirect URL rather than a destination query string', () => {
    const url = trackingRedirectUrl('august-driveway')
    expect(url).toContain('/functions/v1/tracking-redirect?slug=august-driveway')
    expect(url).not.toContain('?source=')
    expect(url).not.toContain('&campaign=')
  })

  it('persists first-party attribution across public navigation and expires it', () => {
    captureTrackingAttribution('?mt_tracking=11111111-1111-4111-8111-111111111111&mt_source=Facebook&mt_campaign=August+Driveway')
    expect(getTrackingAttribution()).toMatchObject({
      trackingLinkId: '11111111-1111-4111-8111-111111111111',
      source: 'Facebook',
      campaign: 'August Driveway',
    })
    expect(getTrackingAttribution(Date.now() + 31 * 24 * 60 * 60 * 1000)).toBeNull()
  })

  it('records one server-side visit per signed browser session and avoids fingerprinting', () => {
    const handler = read('supabase/functions/tracking-redirect/index.ts')
    const session = read('supabase/functions/_shared/tracking-session.ts')
    expect(handler).toContain(".from('tracking_link_visits').upsert")
    expect(handler).toContain("onConflict: 'tracking_link_id,session_id'")
    expect(handler).toContain('ignoreDuplicates: true')
    expect(handler.indexOf("tracking_link_visits")).toBeLessThan(handler.indexOf('status: 302'))
    expect(handler).toContain("destination.searchParams.set('mt_tracking', link.id)")
    expect(handler).toContain("headers.set('Set-Cookie', sessionCookie)")
    expect(session).toContain('Max-Age=${TRACKING_SESSION_MAX_AGE_SECONDS}')
    expect(session).toContain('HttpOnly; Secure; SameSite=Lax')
    expect(`${handler}\n${session}`).not.toMatch(/user.agent|ip_address|fingerprint/i)
  })

  it('derives metrics, supports archive/reactivate, and protects used history from delete', () => {
    expect(migration).toContain('create table if not exists public.tracking_link_visits')
    expect(migration).toContain('create or replace view public.tracking_link_metrics')
    expect(migration).toContain('coalesce(tl.visits, 0) + (select count(*)')
    expect(migration).toContain('add column if not exists tracking_link_id uuid')
    expect(migration).toContain('set_tracking_link_archived')
    expect(migration).toContain('delete_tracking_link_if_unused')
    expect(migration).toContain("'status', 'PROTECTED'")
    expect(migration).toContain('from public.contact_submissions where tracking_link_id = p_tracking_link_id')
    expect(migration).toContain('on delete restrict')
    expect(migration).not.toMatch(/update\s+public\.(tickets|ticket_items|quotes|quote_items|invoices|payments)\b/i)
    expect(migration).not.toMatch(/next_ticket_number\s*=/i)
  })

  it('adds ordered single-level groups without rewriting existing tracking history', () => {
    expect(organizationMigration).toContain('create table if not exists public.tracking_link_groups')
    expect(organizationMigration).toContain('add column if not exists group_id uuid')
    expect(organizationMigration).toContain('add column if not exists session_id uuid')
    expect(organizationMigration).toContain('tracking_link_visits_link_session_unique')
    expect(organizationMigration).toContain('create or replace function public.move_tracking_link')
    expect(organizationMigration).toContain('lock table public.tracking_links in share row exclusive mode')
    expect(organizationMigration).toContain('on delete set null')
    expect(organizationMigration).not.toMatch(/delete from public\.tracking_link_visits/i)
    expect(organizationMigration).not.toMatch(/update public\.tracking_link_visits/i)
  })

  it('creates a deduplicated website Lead with canonical stored attribution', () => {
    expect(migration).toContain('prepare_website_contact_lead')
    expect(migration).toContain('perform pg_advisory_xact_lock')
    expect(migration).toContain('new.source := v_link.source')
    expect(migration).toContain('new.campaign := v_link.campaign')
    expect(migration).toContain('tracking_link_id, need')
    const contact = read('src/components/public/QuoteRequestForm.tsx')
    const handler = read('supabase/functions/send-contact-email/index.ts')
    expect(contact).toContain('trackingAttribution: getTrackingAttribution()')
    expect(handler).toContain('tracking_link_id: trackingLinkId')
    expect(handler).toContain("['PGRST204', '42703']")
  })

  it('ships compact routed rows with deterministic source identity and active/archive views', () => {
    const settings = read('src/control-center/approved/screens/settings/TrackingLinksSettings.tsx')
    expect(settings).toContain("source === 'Facebook'")
    expect(settings).toContain("source === 'Website'")
    expect(settings).toContain("source === 'QR code'")
    expect(settings).toContain("value: 'ACTIVE' as const")
    expect(settings).toContain("value: 'ARCHIVED' as const")
    expect(settings).toContain("xl:grid-cols-[minmax(280px,1fr)_auto_auto]")
    expect(settings).toContain('truncate text-[12px]')
    expect(settings).toContain('sortableKeyboardCoordinates')
    expect(settings).toContain('Move {link.campaign} to group')
    expect(settings).toContain('Drag to reorder or move')
  })
})
