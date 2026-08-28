-- ONE-TIME GUARDED MAINTENANCE SCRIPT. NOT A MIGRATION.
--
-- Run only in the confirmed Lovable-managed project after a recoverable backup
-- exists and the read-only preflight output has been reviewed. This file aborts
-- unchanged. Replace only the three PASTE_..._HERE values in the managed SQL
-- editor for the one authorized run.

begin;

do $$
declare
  v_expected_project_ref constant text := 'dugmcjpistrxxryaubkd';
  v_confirmed_project_ref text := 'PASTE_CONFIRMED_PROJECT_REF_HERE';
  v_backup_reference text := 'PASTE_RECOVERABLE_BACKUP_REFERENCE_HERE';
  v_preflight_token text := 'PASTE_PREFLIGHT_TOKEN_HERE';
  v_actual_token text;
  v_api_url text := current_setting('app.settings.api_url', true);
  v_name text;
begin
  if v_confirmed_project_ref <> v_expected_project_ref then
    raise exception 'Project confirmation does not match Monkey Trucking managed project %', v_expected_project_ref;
  end if;
  if v_backup_reference like 'PASTE_%' or length(trim(v_backup_reference)) < 8 then
    raise exception 'A recoverable managed backup reference must be recorded before reset';
  end if;
  if v_preflight_token like 'PASTE_%' then
    raise exception 'Run the read-only preflight and paste its current token before reset';
  end if;
  if v_api_url is not null and v_api_url not like '%' || v_expected_project_ref || '%' then
    raise exception 'Managed API URL does not match expected project ref';
  end if;
  if current_user in ('anon','authenticated') then
    raise exception 'Run this maintenance operation only from managed database tooling';
  end if;

  foreach v_name in array array[
    'customers','leads','lead_messages','quotes','quote_items','jobs','tickets',
    'ticket_items','ticket_history','invoices','invoice_tickets','payments',
    'worker_payments','activity_history','financial_history','attention_snoozes',
    'customer_document_tokens','email_send_log','email_unsubscribe_tokens',
    'ai_conversation_state','ai_audit_logs','ai_drafts','stripe_checkout_sessions',
    'stripe_webhook_events','materials','drivers','workers','app_settings',
    'control_center_settings','automation_rules','tracking_links','user_roles',
    'email_send_state','suppressed_emails','ticket_deletion_audit'
  ] loop
    if to_regclass('public.' || v_name) is null then
      raise exception 'Required managed table public.% is missing; reset aborted', v_name;
    end if;
  end loop;

  select upper(md5(jsonb_build_object(
    'project_ref', v_expected_project_ref,
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
  )::text)) into v_actual_token;

  if upper(trim(v_preflight_token)) <> v_actual_token then
    raise exception 'Live data or counters changed after preflight; rerun preflight and review again';
  end if;
end
$$;

create temporary table prelaunch_counter_snapshot on commit drop as
select
  (select next_ticket_number from public.app_settings order by id limit 1) as next_ticket_number,
  (select last_value from public.quote_number_seq) as quote_last_value,
  (select is_called from public.quote_number_seq) as quote_is_called,
  (select last_value from public.invoice_number_seq) as invoice_last_value,
  (select is_called from public.invoice_number_seq) as invoice_is_called;

create temporary table prelaunch_configuration_snapshot (
  record_type text primary key,
  row_count bigint not null,
  checksum text not null
) on commit drop;

insert into prelaunch_configuration_snapshot
select 'materials', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.materials t
union all select 'drivers', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.drivers t
union all select 'workers', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.workers t
union all select 'app_settings', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.app_settings t
union all select 'control_center_settings', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.control_center_settings t
union all select 'automation_rules', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.automation_rules t
union all select 'tracking_links', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.tracking_links t
union all select 'user_roles', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text, '[]')) from public.user_roles t
union all select 'email_send_state', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.email_send_state t
union all select 'suppressed_emails', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.suppressed_emails t;

create temporary table prelaunch_customer_emails on commit drop as
select distinct lower(email) as email from public.customers where email is not null;

-- Explicit maintenance flags satisfy the existing historical-safety triggers;
-- no trigger, foreign key, RLS setting, or constraint is disabled.
select set_config('app.ticket_safe_write', 'true', true);
select set_config('app.financial_safe_write', 'true', true);

delete from public.email_unsubscribe_tokens
where lower(email) in (select email from prelaunch_customer_emails);

delete from public.email_send_log
where customer_id is not null or quote_id is not null or invoice_id is not null
  or payment_id is not null or document_token_id is not null
  or template_type in ('QUOTE_READY','INVOICE_READY','PAYMENT_RECEIVED');

delete from public.stripe_webhook_events;
delete from public.stripe_checkout_sessions;
delete from public.customer_document_tokens;

delete from public.ai_drafts;
delete from public.ai_conversation_state;
delete from public.ai_audit_logs where customer_id is not null or lead_id is not null;

delete from public.attention_snoozes;
delete from public.activity_history;
delete from public.financial_history;
delete from public.worker_payments;

delete from public.invoice_tickets;
delete from public.payments;
delete from public.invoices;

delete from public.ticket_history;
delete from public.ticket_items;
delete from public.tickets;

delete from public.jobs;
delete from public.quote_items;
delete from public.quotes;
delete from public.lead_messages;
delete from public.leads;
delete from public.customers;

do $$
begin
  if exists (
    select 1 from (
      values
        ((select count(*) from public.customers)),
        ((select count(*) from public.leads)),
        ((select count(*) from public.lead_messages)),
        ((select count(*) from public.quotes)),
        ((select count(*) from public.quote_items)),
        ((select count(*) from public.jobs)),
        ((select count(*) from public.tickets)),
        ((select count(*) from public.ticket_items)),
        ((select count(*) from public.ticket_history)),
        ((select count(*) from public.invoices)),
        ((select count(*) from public.invoice_tickets)),
        ((select count(*) from public.payments)),
        ((select count(*) from public.worker_payments)),
        ((select count(*) from public.activity_history)),
        ((select count(*) from public.financial_history)),
        ((select count(*) from public.attention_snoozes)),
        ((select count(*) from public.customer_document_tokens)),
        ((select count(*) from public.ai_conversation_state)),
        ((select count(*) from public.ai_drafts)),
        ((select count(*) from public.ai_audit_logs where customer_id is not null or lead_id is not null)),
        ((select count(*) from public.stripe_checkout_sessions)),
        ((select count(*) from public.stripe_webhook_events))
    ) as remaining(row_count)
    where row_count <> 0
  ) then
    raise exception 'Post-reset operational verification failed; transaction rolled back';
  end if;

  if exists (
    with current_configuration as (
      select 'materials' as record_type, count(*) as row_count, md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) as checksum from public.materials t
      union all select 'drivers', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.drivers t
      union all select 'workers', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.workers t
      union all select 'app_settings', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.app_settings t
      union all select 'control_center_settings', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.control_center_settings t
      union all select 'automation_rules', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.automation_rules t
      union all select 'tracking_links', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.tracking_links t
      union all select 'user_roles', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text, '[]')) from public.user_roles t
      union all select 'email_send_state', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.email_send_state t
      union all select 'suppressed_emails', count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text, '[]')) from public.suppressed_emails t
    )
    select 1
    from current_configuration c
    join prelaunch_configuration_snapshot s using (record_type)
    where c.row_count <> s.row_count or c.checksum <> s.checksum
  ) then
    raise exception 'A preserved configuration table changed; transaction rolled back';
  end if;

  if exists (
    select 1 from prelaunch_counter_snapshot s
    where s.next_ticket_number <> (select next_ticket_number from public.app_settings order by id limit 1)
      or s.quote_last_value <> (select last_value from public.quote_number_seq)
      or s.quote_is_called <> (select is_called from public.quote_number_seq)
      or s.invoice_last_value <> (select last_value from public.invoice_number_seq)
      or s.invoice_is_called <> (select is_called from public.invoice_number_seq)
  ) then
    raise exception 'A numbering counter changed; transaction rolled back';
  end if;
end
$$;

-- Returned only if all transactional safety checks passed.
select
  (select count(*) from public.customers) as customers,
  (select count(*) from public.leads) as leads,
  (select count(*) from public.quotes) as quotes,
  (select count(*) from public.jobs) as jobs,
  (select count(*) from public.tickets) as tickets,
  (select count(*) from public.invoices) as invoices,
  (select count(*) from public.payments) as payments,
  0::numeric as collected,
  0::numeric as outstanding,
  0::numeric as overdue,
  (select next_ticket_number from public.app_settings order by id limit 1) as next_ticket_number,
  (select last_value from public.quote_number_seq) as quote_sequence_last_value,
  (select last_value from public.invoice_number_seq) as invoice_sequence_last_value,
  (select count(*) from public.materials where is_active) as active_materials,
  (select count(*) from public.drivers) as drivers,
  (select count(*) from public.workers) as workers;

commit;

