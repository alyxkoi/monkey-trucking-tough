alter table public.sms_outbox add column next_receipt_check_at timestamptz;
-- Status lookup only: never claims a send, never retries a submission. Two
-- rows per existing worker run, at most once per minute per message.
create function public.claim_sms_receipt_checks() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  with due as (
    select o.message_id,m.lead_id from public.sms_outbox o join public.lead_messages m on m.id=o.message_id
    where o.state='ACCEPTED' and m.provider='SENT_DM' and m.provider_message_id is not null
      and m.delivery_status in ('PENDING','QUEUED','ROUTED','SCHEDULED','SENT')
      and o.created_at>now()-interval '7 days'
      and coalesce(o.next_receipt_check_at,o.created_at+interval '1 minute')<=now()
    order by coalesce(o.next_receipt_check_at,o.created_at) for update of o skip locked limit 2
  ), claimed as (
    update public.sms_outbox o set next_receipt_check_at=now()+interval '1 minute' from due
    where o.message_id=due.message_id returning o.message_id,due.lead_id
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
  return result;
end $$;
revoke all on function public.claim_sms_receipt_checks() from public,anon,authenticated;
grant execute on function public.claim_sms_receipt_checks() to service_role;