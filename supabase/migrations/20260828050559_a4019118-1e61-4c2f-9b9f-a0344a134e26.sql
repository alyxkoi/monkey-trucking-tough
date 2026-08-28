alter table public.email_send_log drop constraint if exists email_send_log_status_check;
alter table public.email_send_log add constraint email_send_log_status_check
  check (status in ('pending','sent','accepted_by_provider','suppressed','failed','bounced','complained','dlq'));