// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
const preflight = read('supabase/maintenance/prelaunch_operational_reset_preflight.sql')
const reset = read('supabase/maintenance/prelaunch_operational_reset.sql')
const postflight = read('supabase/maintenance/prelaunch_operational_reset_postflight.sql')
const css = read('src/control-center/approved/approved.css')
const sideNav = read('src/control-center/approved/components/shell/SideNav.tsx')
const controlCenterLayout = read('src/control-center/ExactControlCenterLayout.tsx')

describe('guarded prelaunch operational reset', () => {
  it('is maintenance tooling rather than a deployment migration', () => {
    expect(reset).toContain('NOT A MIGRATION')
    expect(reset).toContain('PASTE_CONFIRMED_PROJECT_REF_HERE')
    expect(reset).toContain('PASTE_RECOVERABLE_BACKUP_REFERENCE_HERE')
    expect(reset).toContain('PASTE_PREFLIGHT_TOKEN_HERE')
    expect(reset).toContain('dugmcjpistrxxryaubkd')
    expect(reset).not.toMatch(/\btruncate\b/i)
    expect(reset).not.toMatch(/\bsetval\s*\(/i)
    expect(reset).not.toMatch(/disable\s+trigger|drop\s+constraint|drop\s+table/i)
  })

  it('deletes operational dependencies while preserving configuration tables', () => {
    for (const table of [
      'customers', 'leads', 'lead_messages', 'quotes', 'quote_items', 'jobs',
      'tickets', 'ticket_items', 'ticket_history', 'invoices', 'invoice_tickets',
      'payments', 'worker_payments', 'activity_history', 'financial_history',
      'attention_snoozes', 'customer_document_tokens', 'stripe_checkout_sessions',
      'stripe_webhook_events', 'ai_drafts', 'ai_conversation_state',
    ]) {
      expect(reset).toContain(`delete from public.${table}`)
    }

    for (const table of [
      'materials', 'drivers', 'workers', 'app_settings', 'control_center_settings',
      'automation_rules', 'tracking_link_groups', 'tracking_links',
      'tracking_link_visits', 'user_roles', 'email_send_state',
      'suppressed_emails', 'ticket_deletion_audit',
    ]) {
      expect(reset).not.toContain(`delete from public.${table}`)
    }
  })

  it('snapshots and verifies counters and preserved configuration', () => {
    expect(preflight).toContain('preflight_token')
    expect(preflight).toContain('next_ticket_number_definition')
    expect(reset).toContain('prelaunch_counter_snapshot')
    expect(reset).toContain('prelaunch_configuration_snapshot')
    expect(reset).toContain("set_config('app.ticket_safe_write', 'true', true)")
    expect(reset).toContain("set_config('app.financial_safe_write', 'true', true)")
    expect(postflight).toContain('quote_sequence_last_value')
    expect(postflight).toContain('invoice_sequence_last_value')
  })
})

describe('authenticated Control Center atmosphere', () => {
  it('uses a fixed dark platinum atmosphere only in the Control Center scope', () => {
    expect(css).toContain('.control-center-root::after')
    expect(css).toContain('#1b1d22 0%')
    expect(css).toContain('#17191e 30%')
    expect(css).toContain('#0d0e12 100%')
    expect(css).toContain('ellipse 105% 64%')
    expect(css).toContain('overflow-x: clip')
    expect(css).toContain('rgba(92, 10, 14, 0.22)')
    expect(css).not.toContain('Love%20and%20Liberty.jpg')
    expect(css).toContain('background-size: cover')
    expect(css).toContain('background-position: center')
  })

  it('keeps Overview open while applying one continuous dot texture to tab routes', () => {
    expect(controlCenterLayout).toContain('pathname === "/admin" || pathname === "/admin/"')
    expect(controlCenterLayout).toContain('"cc-overview-canvas" : "cc-tab-canvas"')
    expect(css).toContain('.control-center-root.cc-tab-canvas::before')
    expect(css).toContain('rgba(235, 239, 244, 0.06) 1px')
    expect(css).toContain('background-size: 24px 24px')
    expect(css).toContain('background-repeat: repeat')
  })

  it('keeps the desktop sidebar detached and smoked-glass', () => {
    expect(sideNav).toContain('lg:bottom-4')
    expect(sideNav).toContain('lg:left-4')
    expect(sideNav).toContain('lg:top-4')
    expect(sideNav).toContain('lg:rounded-[24px]')
    expect(sideNav).toContain('sidebar-frost')
    expect(css).toContain('backdrop-filter: blur(24px) saturate(118%)')
  })
})
