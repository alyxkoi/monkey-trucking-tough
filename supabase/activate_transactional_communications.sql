-- Run once after the matching migrations and Edge Functions are deployed.
-- This is deliberately an operation, not a migration: applying schema must
-- never begin contacting customers. The activation is forward-only.
begin;

do $$
declare
  v_sms_status text;
  v_business_number text;
  v_worker_cron_count integer := 0;
begin
  select sms_status,business_number
    into v_sms_status,v_business_number
  from public.control_center_settings
  where id=1
  for update;

  if v_sms_status is distinct from 'READY' then
    raise exception 'SMS must be READY before transactional automation activation';
  end if;
  if regexp_replace(coalesce(v_business_number,''),'[^0-9]','','g') <> '19453750877' then
    raise exception 'The approved Monkey Trucking business number is not configured';
  end if;
  if to_regclass('cron.job') is null then
    raise exception 'The communications worker cron is not installed';
  end if;
  execute 'select count(*) from cron.job where jobname=''process-communications-minute'' and active'
    into v_worker_cron_count;
  if v_worker_cron_count <> 1 then
    raise exception 'Exactly one active communications worker cron is required';
  end if;
end $$;

update public.communication_runtime
set ai_sending_enabled=true,
    scheduled_sending_enabled=true,
    marketing_approved=false,
    activated_at=clock_timestamp(),
    updated_at=now()
where id=1;

update public.automation_rules
set status=case
      when id in ('new-lead','quote-follow-up','human-takeover','job-reminder') then 'ON'
      when id in ('missed-call','invoice-follow-up','review-request','reactivation') then 'SETUP_REQUIRED'
      else status
    end,
    updated_at=now()
where id in ('new-lead','missed-call','quote-follow-up','human-takeover','job-reminder','invoice-follow-up','review-request','reactivation');

do $$
declare
  v_candidates integer;
  v_planned integer;
begin
  select count(*) into v_candidates from public.communication_candidates();
  if v_candidates <> 0 then
    raise exception 'Fresh activation unexpectedly found % due candidate(s)',v_candidates;
  end if;
  select public.plan_communication_jobs() into v_planned;
  if v_planned <> 0 then
    raise exception 'Fresh activation unexpectedly planned % historical job(s)',v_planned;
  end if;
end $$;

commit;

select
  r.ai_sending_enabled,
  r.scheduled_sending_enabled,
  r.marketing_approved,
  r.activated_at,
  coalesce(jsonb_object_agg(a.id,a.status order by a.id),'{}'::jsonb) as rule_statuses
from public.communication_runtime r
cross join public.automation_rules a
where r.id=1
group by r.ai_sending_enabled,r.scheduled_sending_enabled,r.marketing_approved,r.activated_at;
