-- READ ONLY. Run before the public request confirmation migrations.

select
  to_regclass('public.contact_submissions') as contact_submissions,
  to_regclass('public.customers') as customers,
  to_regclass('public.leads') as leads,
  to_regclass('public.email_send_log') as email_send_log;

select
  to_regprocedure('public.create_website_contact_submission(jsonb)') as idempotent_contact_function,
  to_regprocedure('public.update_customer_contact(uuid,text,text)') as customer_contact_function,
  to_regprocedure('public.enqueue_email(text,jsonb)') as enqueue_email_function;

select
  count(*) as contact_submissions,
  count(distinct email_message_id) as distinct_request_ids,
  count(*) filter (where customer_id is null or lead_id is null) as submissions_missing_relationships
from public.contact_submissions;

select normalized_phone, count(*) as customer_count
from public.customers
where normalized_phone is not null
group by normalized_phone
having count(*) > 1;

select normalized_email, count(*) as customer_count
from public.customers
where normalized_email is not null
group by normalized_email
having count(*) > 1;

select status, count(*) as email_rows
from public.email_send_log
group by status
order by status;

select id, name, status, conditions, delay_description, stop_conditions, log_description
from public.automation_rules
where id in ('new-lead','missed-call','quote-follow-up','job-reminder','invoice-follow-up','review-request','reactivation','human-takeover')
order by id;
