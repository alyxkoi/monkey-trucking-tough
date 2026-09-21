begin;
-- QUOTE_READY is fulfilled by sending/accepting that exact quote. Do not
-- resolve CUSTOM_WORK, complaints, human requests or other outstanding tasks.
create function public.resolve_fulfilled_quote_action() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status in ('SENT','ACCEPTED','DECLINED','VOID') then
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
  select h.customer_id,h.entity_type,h.entity_id,'AI_ACTION_RESOLVED','Quote preparation complete; quote moved to '||new.status,'Lifecycle',jsonb_build_object('request_id',h.id,'quote_id',new.id,'resolution','QUOTE_ADVANCED')
  from public.activity_history h where h.event_type='AI_ACTION_OPEN' and h.metadata->>'kind'='QUOTE_READY' and h.metadata->>'quote_id'=new.id::text
  and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=h.id::text) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger resolve_fulfilled_quote_action after update of status on public.quotes for each row execute function public.resolve_fulfilled_quote_action();
insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
select h.customer_id,h.entity_type,h.entity_id,'AI_ACTION_RESOLVED','Historical quote preparation already fulfilled','Lifecycle',jsonb_build_object('request_id',h.id,'quote_id',q.id,'resolution','QUOTE_ADVANCED')
from public.activity_history h join public.quotes q on q.id::text=h.metadata->>'quote_id'
where h.event_type='AI_ACTION_OPEN' and h.metadata->>'kind'='QUOTE_READY' and q.status in ('SENT','ACCEPTED','DECLINED','VOID')
and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=h.id::text) on conflict do nothing;
revoke all on function public.resolve_fulfilled_quote_action() from public,anon,authenticated;
commit;
