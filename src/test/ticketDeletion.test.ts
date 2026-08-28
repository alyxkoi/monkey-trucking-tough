import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createQaFixtureData } from '@/control-center/demo/qaFixtures'
import { ticketDeleteProtection } from '@/control-center/ticketDeletion'

const migration = readFileSync('supabase/migrations/20260828013000_phase06_ticket_delete_readiness.sql', 'utf8')
const detail = readFileSync('src/control-center/approved/screens/TicketDetail.tsx', 'utf8')

describe('permanent Ticket deletion safety', () => {
  it('blocks every downstream Invoice relationship and reports paid truth', () => {
    const data = createQaFixtureData(new Date('2026-08-27T12:00:00-05:00'))
    const protectedResult = ticketDeleteProtection(data, 'qa-ticket-mixed')
    expect(protectedResult).toMatchObject({
      status: 'PROTECTED',
      invoice_number: '1048',
      invoice_status: 'PAID',
      payment_count: 1,
    })
    expect(protectedResult?.message).toContain('paid customer record')
    expect(ticketDeleteProtection(data, 'qa-ticket-void')).toBeNull()
  })

  it('uses one secured transaction and deletes only Ticket-owned records', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain('public.is_admin_or_staff()')
    expect(migration).toContain("revoke all on function public.delete_ticket_permanently(uuid, text, text) from public, anon")
    expect(migration).toContain('i.standalone_ticket_id = p_ticket_id')
    expect(migration).toContain('public.invoice_tickets')
    expect(migration).toContain('public.payments')
    expect(migration).toContain('delete from public.ticket_history')
    expect(migration).toContain('delete from public.ticket_items')
    expect(migration).toContain('delete from public.tickets')
    expect(migration).not.toContain('delete from public.invoices')
    expect(migration).not.toContain('delete from public.payments')
  })

  it('preserves a minimal audit without retaining material references or changing the MT counter', () => {
    expect(migration).toContain('public.ticket_deletion_audit')
    expect(migration).toContain('ticket_number text not null')
    expect(migration).toContain('was_job_linked boolean not null')
    expect(migration).not.toContain('material_id uuid')
    expect(migration).not.toMatch(/update\s+public\.app_settings\s+set\s+next_ticket_number/i)
    expect(migration).not.toMatch(/perform\s+public\.next_ticket_number/i)
  })

  it('requires the exact Ticket number and a deletion reason in the live routed UI', () => {
    expect(detail).toContain('Permanently delete ${ticket.number')
    expect(detail).toContain("deleteConfirmation.trim() !== ticket.number")
    expect(detail).toContain('deleteReason.trim().length === 0')
    expect(detail).toContain('Delete permanently')
  })
})
