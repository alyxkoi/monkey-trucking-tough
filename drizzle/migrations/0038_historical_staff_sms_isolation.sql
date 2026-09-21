begin;
-- A configured employee number may exist in historical test/customer data.
-- Keep that history, but never reserve or deliver customer SMS to staff.
do $$ declare definition text; begin
 select pg_get_functiondef('public.enqueue_sms(uuid,text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure) into definition;
 if position('if c.sms_opted_out_at is not null' in definition)=0 then raise exception 'Customer reservation staff guard requires audit'; end if;
 execute replace(definition,'if c.sms_opted_out_at is not null',
 'if public.is_internal_sms_phone(c.phone) then raise exception ''Internal staff number; use staff notifications, not customer SMS''; end if; if c.sms_opted_out_at is not null');
 select pg_get_functiondef('public.authorize_sms_dispatch(uuid,uuid)'::regprocedure) into definition;
 if position('when c.sms_opted_out_at is not null' in definition)=0 then raise exception 'Customer dispatch staff guard requires audit'; end if;
 execute replace(definition,'when c.sms_opted_out_at is not null',
 'when public.is_internal_sms_phone(c.phone) or public.is_internal_sms_phone(o.payload->''to''->>0) then ''Internal staff destination; customer SMS is blocked'' when c.sms_opted_out_at is not null');
end $$;
create function public.protect_internal_staff_lead() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.customers where id=new.customer_id and public.is_internal_sms_phone(phone)) then
  raise exception 'Internal staff number cannot open a customer lead';
 end if;
 return new;
end $$;
create trigger protect_internal_staff_lead before insert on public.leads for each row execute function public.protect_internal_staff_lead();
revoke all on function public.protect_internal_staff_lead() from public,anon,authenticated;
commit;
