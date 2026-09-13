-- Run once AFTER migrations and the process-communications deployment.
-- Store the same random credential as Edge secret COMMUNICATIONS_WORKER_SECRET
-- and Vault secret communications_worker_secret first. Never print the value.
begin;
do $$ begin
  if not exists(select 1 from vault.secrets where name='communications_worker_secret') then
    raise exception 'Dedicated communication worker credential is not configured';
  end if;
end $$;
create or replace function public.wake_communication_worker() returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare request_id bigint; worker_secret text;
begin
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='communications_worker_secret';
  if nullif(worker_secret,'') is null then raise exception 'Worker credential missing'; end if;
  select net.http_post(
    url:='https://dugmcjpistrxxryaubkd.supabase.co/functions/v1/process-communications',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),
    body:='{}'::jsonb,timeout_milliseconds:=100000
  ) into request_id;
  return request_id;
end $$;
revoke all on function public.wake_communication_worker() from public,anon,authenticated;
grant execute on function public.wake_communication_worker() to service_role;
select cron.schedule('process-communications-minute','* * * * *','select public.wake_communication_worker();');
commit;
