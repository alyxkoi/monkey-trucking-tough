-- Independent read-only verification after the guarded reset transaction.

begin transaction read only;

select
  (select count(*) from public.customers) as customers,
  (select count(*) from public.leads) as leads,
  (select count(*) from public.lead_messages) as lead_messages,
  (select count(*) from public.quotes) as quotes,
  (select count(*) from public.quote_items) as quote_items,
  (select count(*) from public.jobs) as jobs,
  (select count(*) from public.tickets) as tickets,
  (select count(*) from public.ticket_items) as ticket_items,
  (select count(*) from public.ticket_history) as ticket_history,
  (select count(*) from public.invoices) as invoices,
  (select count(*) from public.invoice_tickets) as invoice_tickets,
  (select count(*) from public.payments) as payments,
  (select count(*) from public.worker_payments) as worker_payments,
  (select count(*) from public.activity_history) as activity_history,
  (select count(*) from public.financial_history) as financial_history,
  (select count(*) from public.attention_snoozes) as attention_snoozes,
  (select count(*) from public.customer_document_tokens) as customer_document_tokens,
  (select count(*) from public.ai_conversation_state) as ai_conversation_state,
  (select count(*) from public.ai_drafts) as ai_drafts,
  (select count(*) from public.ai_audit_logs where customer_id is not null or lead_id is not null) as customer_linked_ai_audit_logs,
  (select count(*) from public.stripe_checkout_sessions) as stripe_checkout_sessions,
  (select count(*) from public.stripe_webhook_events) as stripe_webhook_events;

select
  coalesce((select sum(amount) from public.payments where voided_at is null), 0) as collected,
  coalesce((select sum(amount) from public.invoices where status not in ('PAID','VOID') and voided_at is null), 0) as outstanding,
  coalesce((select sum(amount) from public.invoices where status = 'SENT' and voided_at is null and due_at < now()), 0) as overdue;

select
  (select count(*) from public.materials where is_active) as active_materials,
  (select count(*) from public.drivers) as drivers,
  (select count(*) from public.workers) as workers,
  (select count(*) from public.app_settings) as app_settings_rows,
  (select count(*) from public.control_center_settings) as control_center_settings_rows,
  (select count(*) from public.automation_rules) as automation_rules,
  (select count(*) from public.tracking_link_groups) as tracking_link_groups,
  (select count(*) from public.tracking_links) as tracking_links,
  (select count(*) from public.tracking_link_visits) as tracking_link_visits,
  (select count(*) from public.user_roles where role in ('admin','staff')) as authorized_users,
  (select count(*) from public.email_send_state) as email_send_state_rows,
  (select count(*) from public.ticket_deletion_audit) as retained_ticket_deletion_audits;

select
  (select next_ticket_number from public.app_settings order by id limit 1) as next_ticket_number,
  (select last_value from public.quote_number_seq) as quote_sequence_last_value,
  (select is_called from public.quote_number_seq) as quote_sequence_is_called,
  (select last_value from public.invoice_number_seq) as invoice_sequence_last_value,
  (select is_called from public.invoice_number_seq) as invoice_sequence_is_called;

select id, name, price_per_yard, full_load_price, full_load_yards, is_active, sort_order
from public.materials
order by sort_order, name;

rollback;
