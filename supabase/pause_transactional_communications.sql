-- Fast, recoverable rollback for scheduled customer communication. This keeps
-- inbound AI available and preserves every message, job, event and audit row.
begin;

update public.communication_runtime
set scheduled_sending_enabled=false,
    activated_at=null,
    updated_at=now()
where id=1;

update public.automation_rules
set status='SETUP_REQUIRED',updated_at=now()
where id in ('new-lead','quote-follow-up','job-reminder');

update public.communication_jobs
set state='CANCELLED',last_error='Scheduled communications paused by operator',updated_at=now()
where kind='AUTOMATION' and state in ('QUEUED','WORKING');

update public.sms_outbox o
set state='CANCELLED',last_error='Scheduled communications paused by operator',updated_at=now()
from public.lead_messages m
where m.id=o.message_id and o.origin='AUTOMATION' and o.state in ('QUEUED','RETRY','LEASED');

commit;
