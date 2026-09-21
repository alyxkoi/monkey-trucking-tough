begin;

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check(method in ('ACH','CARD','ZELLE','APPLE_PAY','CASH','CHECK','OTHER','STRIPE'));
alter table public.payments add column if not exists manual_request_id uuid;
create unique index if not exists payments_manual_request_once on public.payments(manual_request_id) where manual_request_id is not null;

-- Invoice fee is the customer-facing surcharge, NOT Stripe's actual processor fee.
-- Change it and record the actual received amount in one locked transaction.
create or replace function public.record_manual_invoice_payment(
 p_invoice_id uuid,p_method text,p_received_at timestamptz,p_note text,
 p_amount numeric,p_processing_fee numeric,p_request_id uuid,p_expected_total numeric
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.invoices%rowtype; paid numeric; subtotal numeric; total numeric; result uuid; prior public.payments%rowtype;
begin
 if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Payment request ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('manual-payment:'||p_request_id,0));
 select * into prior from public.payments where manual_request_id=p_request_id;
 if found then
   if prior.invoice_id is distinct from p_invoice_id or prior.amount is distinct from p_amount or prior.method is distinct from p_method
     or not exists(select 1 from public.financial_history where record_id=prior.id and event_type='RECORDED' and (after_snapshot->>'processing_fee')::numeric=p_processing_fee)
   then raise exception 'Payment request already used'; end if;
   return prior.id;
 end if;
 if p_method not in ('ACH','CARD','ZELLE','APPLE_PAY','CASH','CHECK','OTHER') then raise exception 'Unsupported manual payment method'; end if;
 if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_processing_fee is null or p_processing_fee<0 or p_processing_fee<>round(p_processing_fee,2)
   or p_amount::text in ('NaN','Infinity','-Infinity') or p_processing_fee::text in ('NaN','Infinity','-Infinity') then raise exception 'Valid dollars and cents required'; end if;
 select * into i from public.invoices where id=p_invoice_id for update;
 if not found or i.status in ('PAID','VOID') then raise exception 'Invoice is not eligible for payment'; end if;
 if p_expected_total is distinct from i.amount then raise exception 'Invoice changed. Refresh before recording payment'; end if;
 -- Do not race an active checkout or modify processor-backed accounting.
 if exists(select 1 from public.stripe_checkout_sessions where invoice_id=i.id and (status='CREATING' or status='OPEN' and (expires_at is null or expires_at>now()))) then
   raise exception 'An active Stripe checkout exists. Expire it before recording an offline payment';
 end if;
 if p_processing_fee<>coalesce(i.processing_fee_amount,0) and exists(select 1 from public.payments where invoice_id=i.id and payment_source='STRIPE' and voided_at is null) then
   raise exception 'Processing fee cannot change after a Stripe payment';
 end if;
 subtotal:=coalesce(i.subtotal_amount,i.amount-coalesce(i.processing_fee_amount,0));
 if p_processing_fee>subtotal then raise exception 'Processing fee cannot exceed the invoice subtotal'; end if;
 total:=round(subtotal+p_processing_fee,2);
 select coalesce(sum(amount),0) into paid from public.payments where invoice_id=i.id and voided_at is null;
 if total<=paid or p_amount>round(total-paid,2) then raise exception 'Payment exceeds the outstanding balance'; end if;
 perform set_config('app.financial_safe_write','true',true);
 -- Save all balance fields before payment-triggered communications can run.
 update public.invoices set subtotal_amount=subtotal,processing_fee_amount=p_processing_fee,
   processing_fee_rate=case when subtotal>0 then round(p_processing_fee/subtotal*100,4) else 0 end,
   amount=total,updated_at=now() where id=i.id;
 insert into public.payments(invoice_id,customer_id,amount,method,confirmed_by,note,received_at,payment_source,manual_request_id)
 values(i.id,i.customer_id,p_amount,p_method,'HUMAN',nullif(trim(p_note),''),coalesce(p_received_at,now()),'MANUAL',p_request_id) returning id into result;
 update public.invoices set status=case when paid+p_amount>=total then 'PAID' else status end,
   paid_at=case when paid+p_amount>=total then now() else null end,
   payment_claimed_at=null,payment_claim_method=null,payment_claim_note=null,updated_at=now() where id=i.id;
 insert into public.financial_history(record_type,record_id,event_type,reason,before_snapshot,after_snapshot,actor_label)
 values('PAYMENT',result,'RECORDED','Confirmed manual payment and invoice fee',to_jsonb(i),
 jsonb_build_object('amount_received',p_amount,'invoice_total',total,'processing_fee',p_processing_fee,'paid',paid+p_amount,'balance',total-paid-p_amount,'method',p_method),coalesce(auth.jwt()->>'email',auth.uid()::text));
 insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,metadata,actor_label)
 values(i.customer_id,'PAYMENT',result,'RECORDED','Manual payment recorded for invoice '||i.invoice_number,
 jsonb_build_object('invoice_id',i.id,'amount',p_amount,'balance',total-paid-p_amount),'Dashboard staff');
 update public.customers set last_activity_at=now() where id=i.customer_id;
 return result;
end $$;
revoke all on function public.record_manual_invoice_payment(uuid,text,timestamptz,text,numeric,numeric,uuid,numeric) from public,anon;
grant execute on function public.record_manual_invoice_payment(uuid,text,timestamptz,text,numeric,numeric,uuid,numeric) to authenticated;
commit;
