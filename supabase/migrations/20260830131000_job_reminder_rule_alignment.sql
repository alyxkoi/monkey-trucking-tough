-- Align the existing dry-run Job Reminder definition with approved scheduling
-- behavior. This does not enable a transport or send any customer message.

begin;

update public.automation_rules set
  conditions = '["Job is scheduled and active","Current schedule was set more than 24 hours before work","Customer has recorded SMS consent","Customer has not opted out","No reminder is logged for this exact scheduled time"]'::jsonb,
  delay_description = 'About 24 hours before the current scheduled work time',
  action_description = 'Prepare one SMS reminder with the current date and time',
  stop_conditions = '["Cancelled","Completed","Rescheduled, which invalidates the old schedule","SMS opt out","Reminder already logged for this scheduled time"]'::jsonb,
  fallback_description = 'Short notice work is skipped. Time change requests go to Salvador and are never moved by AI.',
  log_description = 'Job and customer history with the scheduled time used for duplicate prevention',
  updated_at = now()
where id = 'job-reminder';

commit;
