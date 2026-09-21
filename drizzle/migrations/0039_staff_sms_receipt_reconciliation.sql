begin;
alter table public.staff_sms_outbox add column next_receipt_check_at timestamptz;
-- Reuse the existing receipt-only schedule. Never submit/resubmit a message.
alter function public.claim_sms_receipt_checks() rename to claim_customer_sms_receipt_checks;
create function public.claim_sms_receipt_checks() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare customers jsonb; staff jsonb;
begin
 customers:=public.claim_customer_sms_receipt_checks();
 with due as (
  select message_id from public.staff_sms_outbox where state='ACCEPTED' and provider_message_id is not null
   and delivery_status in ('PENDING','QUEUED','ROUTED','SCHEDULED','SENT')
   and created_at>now()-interval '7 days'
   and coalesce(next_receipt_check_at,created_at+interval '1 minute')<=now()
  order by coalesce(next_receipt_check_at,created_at) for update skip locked limit 2
 ), claimed as (
  update public.staff_sms_outbox o set next_receipt_check_at=now()+interval '1 minute' from due
  where o.message_id=due.message_id returning o.message_id
 ) select coalesce(jsonb_agg(jsonb_build_object('message_id',message_id,'internal',true)),'[]'::jsonb) into staff from claimed;
 return coalesce(customers,'[]'::jsonb)||staff;
end $$;
revoke all on function public.claim_customer_sms_receipt_checks(),public.claim_sms_receipt_checks() from public,anon,authenticated;
grant execute on function public.claim_customer_sms_receipt_checks(),public.claim_sms_receipt_checks() to service_role;
commit;
