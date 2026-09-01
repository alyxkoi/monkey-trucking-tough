-- READ ONLY. Run first in the Lovable-managed SQL editor after verifying that a
-- recoverable managed backup is available. This script does not delete or update.

begin transaction read only;

do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'customers','leads','lead_messages','quotes','quote_items','jobs','tickets',
    'ticket_items','ticket_history','invoices','invoice_tickets','payments',
    'worker_payments','activity_history','financial_history','attention_snoozes',
    'customer_document_tokens','email_send_log','email_unsubscribe_tokens',
    'ai_conversation_state','ai_audit_logs','ai_drafts','stripe_checkout_sessions',
    'stripe_webhook_events','materials','drivers','workers','app_settings',
    'control_center_settings','automation_rules','tracking_link_groups',
    'tracking_links','tracking_link_visits','user_roles',
    'email_send_state','suppressed_emails','ticket_deletion_audit'
  ] loop
    if to_regclass('public.' || v_name) is null then
      raise exception 'Required managed table public.% is missing; stop before reset', v_name;
    end if;
  end loop;

  if to_regclass('public.quote_number_seq') is null
    or to_regclass('public.invoice_number_seq') is null
    or to_regprocedure('public.next_ticket_number()') is null
    or to_regprocedure('public.next_quote_number()') is null
    or to_regprocedure('public.next_invoice_number()') is null then
    raise exception 'A required numbering source is missing; stop before reset';
  end if;
end
$$;

-- Project identity evidence. The Lovable project and supabase/config.toml must
-- both resolve to the expected ref before the reset guard is completed.
select
  'dugmcjpistrxxryaubkd' as expected_project_ref,
  current_setting('app.settings.api_url', true) as managed_api_url_if_exposed,
  current_database() as database_name,
  current_user as database_role;

select * from (
  values
    ('customers', (select count(*) from public.customers)),
    ('leads', (select count(*) from public.leads)),
    ('lead_messages', (select count(*) from public.lead_messages)),
    ('quotes', (select count(*) from public.quotes)),
    ('quote_items', (select count(*) from public.quote_items)),
    ('jobs', (select count(*) from public.jobs)),
    ('tickets', (select count(*) from public.tickets)),
    ('ticket_items', (select count(*) from public.ticket_items)),
    ('ticket_history', (select count(*) from public.ticket_history)),
    ('invoices', (select count(*) from public.invoices)),
    ('invoice_tickets', (select count(*) from public.invoice_tickets)),
    ('payments', (select count(*) from public.payments)),
    ('worker_payments', (select count(*) from public.worker_payments)),
    ('activity_history', (select count(*) from public.activity_history)),
    ('financial_history', (select count(*) from public.financial_history)),
    ('attention_snoozes', (select count(*) from public.attention_snoozes)),
    ('customer_document_tokens', (select count(*) from public.customer_document_tokens)),
    ('operational_email_send_log', (
      select count(*) from public.email_send_log
      where customer_id is not null or quote_id is not null or invoice_id is not null
        or payment_id is not null or document_token_id is not null
        or template_type in ('QUOTE_READY','INVOICE_READY','PAYMENT_RECEIVED')
    )),
    ('customer_email_unsubscribe_tokens', (
      select count(*) from public.email_unsubscribe_tokens u
      where exists (
        select 1 from public.customers c
        where c.email is not null and lower(c.email) = lower(u.email)
      )
    )),
    ('ai_conversation_state', (select count(*) from public.ai_conversation_state)),
    ('customer_linked_ai_audit_logs', (
      select count(*) from public.ai_audit_logs where customer_id is not null or lead_id is not null
    )),
    ('ai_drafts', (select count(*) from public.ai_drafts)),
    ('stripe_checkout_sessions', (select count(*) from public.stripe_checkout_sessions)),
    ('stripe_webhook_events', (select count(*) from public.stripe_webhook_events)),
    ('ticket_deletion_audit_retained', (select count(*) from public.ticket_deletion_audit))
) as counts(record_type, row_count)
order by record_type;

select
  coalesce((select sum(amount) from public.payments where voided_at is null), 0) as collected_all_time,
  coalesce((
    select sum(greatest(i.amount - coalesce(p.paid, 0), 0))
    from public.invoices i
    left join (
      select invoice_id, sum(amount) as paid
      from public.payments where voided_at is null group by invoice_id
    ) p on p.invoice_id = i.id
    where i.status not in ('PAID','VOID') and i.voided_at is null
  ), 0) as outstanding,
  coalesce((
    select sum(greatest(i.amount - coalesce(p.paid, 0), 0))
    from public.invoices i
    left join (
      select invoice_id, sum(amount) as paid
      from public.payments where voided_at is null group by invoice_id
    ) p on p.invoice_id = i.id
    where i.status = 'SENT' and i.voided_at is null and i.due_at < now()
  ), 0) as overdue;

select
  next_ticket_number,
  company_name,
  tax_enabled,
  tax_rate,
  tax_applies_to_delivery,
  delivery_tier_1_fee,
  delivery_tier_1_max_miles,
  delivery_tier_2_fee,
  delivery_tier_2_max_miles,
  delivery_tier_3_fee,
  delivery_tier_3_max_miles,
  delivery_overage_base_fee,
  delivery_overage_per_mile,
  print_method,
  print_copies
from public.app_settings
order by id;

select last_value, is_called from public.quote_number_seq;
select last_value, is_called from public.invoice_number_seq;
select pg_get_functiondef('public.next_ticket_number()'::regprocedure) as next_ticket_number_definition;

select id, name, price_per_yard, full_load_price, full_load_yards, is_active, sort_order
from public.materials
order by sort_order, name;

select
  (select count(*) from public.materials where is_active) as active_materials,
  (select count(*) from public.drivers) as drivers,
  (select count(*) from public.workers) as workers,
  (select count(*) from public.user_roles where role in ('admin','staff')) as authorized_users,
  (select count(*) from public.automation_rules) as automation_rules,
  (select count(*) from public.tracking_link_groups) as tracking_link_groups,
  (select count(*) from public.tracking_links) as tracking_links,
  (select count(*) from public.tracking_link_visits) as tracking_link_visits;

select * from public.control_center_settings order by id;
select id, name, is_active from public.drivers order by name;
select id, name, pay_type, hourly_rate, is_driver, is_active from public.workers order by name;

-- Copy this token into the guarded reset script only after project identity and
-- the recoverable backup have both been verified. Any live operational or
-- counter change produces a different token and aborts the reset.
select upper(md5(jsonb_build_object(
  'project_ref', 'dugmcjpistrxxryaubkd',
  'customers', (select count(*) from public.customers),
  'leads', (select count(*) from public.leads),
  'lead_messages', (select count(*) from public.lead_messages),
  'quotes', (select count(*) from public.quotes),
  'quote_items', (select count(*) from public.quote_items),
  'jobs', (select count(*) from public.jobs),
  'tickets', (select count(*) from public.tickets),
  'ticket_items', (select count(*) from public.ticket_items),
  'ticket_history', (select count(*) from public.ticket_history),
  'invoices', (select count(*) from public.invoices),
  'invoice_tickets', (select count(*) from public.invoice_tickets),
  'payments', (select count(*) from public.payments),
  'worker_payments', (select count(*) from public.worker_payments),
  'activity_history', (select count(*) from public.activity_history),
  'financial_history', (select count(*) from public.financial_history),
  'attention_snoozes', (select count(*) from public.attention_snoozes),
  'document_tokens', (select count(*) from public.customer_document_tokens),
  'ai_state', (select count(*) from public.ai_conversation_state),
  'ai_customer_logs', (select count(*) from public.ai_audit_logs where customer_id is not null or lead_id is not null),
  'ai_drafts', (select count(*) from public.ai_drafts),
  'stripe_sessions', (select count(*) from public.stripe_checkout_sessions),
  'stripe_events', (select count(*) from public.stripe_webhook_events),
  'next_ticket_number', (select next_ticket_number from public.app_settings order by id limit 1),
  'quote_sequence', (select jsonb_build_array(last_value, is_called) from public.quote_number_seq),
  'invoice_sequence', (select jsonb_build_array(last_value, is_called) from public.invoice_number_seq)
)::text)) as preflight_token;

rollback;
