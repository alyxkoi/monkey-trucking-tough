-- Run after migrations and both communications worker function deployments.
-- The updated worker verifies through verify_communications_worker. Its random
-- credential is generated and retained in Vault only, never copied into logs.
begin;
do $$ begin
  if not exists(select 1 from vault.secrets where name='communications_worker_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),
      'communications_worker_secret','Private communications cron credential');
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

create or replace function public.wake_sent_dm_reconciliation() returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare request_id bigint; worker_secret text;
begin
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='communications_worker_secret';
  if nullif(worker_secret,'') is null then raise exception 'Worker credential missing'; end if;
  select net.http_post(
    url:='https://dugmcjpistrxxryaubkd.supabase.co/functions/v1/reconcile-sent-conversations',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),
    body:='{}'::jsonb,timeout_milliseconds:=15000
  ) into request_id;
  return request_id;
end $$;
revoke all on function public.wake_sent_dm_reconciliation() from public,anon,authenticated;
grant execute on function public.wake_sent_dm_reconciliation() to service_role;

-- Named schedules update in place, so rerunning this operation never creates duplicates.
select cron.schedule('process-communications-minute','10 seconds','select public.wake_communication_worker();');
select cron.schedule('reconcile-sent-conversations','10 seconds','select public.wake_sent_dm_reconciliation();');
select cron.schedule('ai-conversation-review','0 8 * * *','select public.review_ai_operations();');
commit;
