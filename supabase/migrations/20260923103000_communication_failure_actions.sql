begin;
-- Terminal communication failures use the existing append-only staff-action
-- architecture. Retries, stale generations and business escalations are not
-- new failures. One source event produces at most one action and SMS alert.
create unique index communication_failure_source_once on public.activity_history
 ((metadata->>'failure_source')) where event_type='AI_ACTION_OPEN' and metadata->>'kind'='COMMUNICATION_FAILURE';
create function public.communication_failure_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.leads%rowtype; m public.lead_messages%rowtype; source text; detail text; failed boolean:=false;
begin
 if tg_table_name='communication_jobs' then
  if new.state is not distinct from old.state or new.state<>'FAILED' then return new; end if;
  select * into l from public.leads where id=new.lead_id;
  if l.human_takeover or (new.kind='AI_REPLY' and l.conversation_revision is distinct from (new.context->>'conversation_revision')::bigint)
    or coalesce(new.last_error,'')~*'no longer eligible|eligibility changed' then return new; end if;
  -- An intentional escalation already has its own actionable staff request.
  if exists(select 1 from public.activity_history a where a.entity_id=l.id and a.event_type='AI_ACTION_OPEN'
    and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=a.id::text)) then return new; end if;
  source:='job:'||new.id;detail:=new.last_error;failed:=true;
 elsif tg_table_name='sms_outbox' then
  if new.state is not distinct from old.state or new.state not in ('FAILED','REVIEW') then return new; end if;
  select * into m from public.lead_messages where id=new.message_id;
  select * into l from public.leads where id=m.lead_id;
  source:='message:'||m.id;detail:=new.last_error;failed:=true;
 else
  select * into l from public.leads where id=new.lead_id;
  if new.delivery_status is not distinct from old.delivery_status then return new; end if;
  if new.delivery_status in ('FAILED','FILTERED') and new.sender_type<>'CUSTOMER' then
   m:=new;source:='message:'||new.id;detail:=new.send_error;failed:=true;
  elsif new.delivery_status='DELIVERED' and new.sender_type<>'CUSTOMER' then
   insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
    select l.customer_id,'LEAD',l.id,'AI_ACTION_RESOLVED','Message delivery recovered','Communications',jsonb_build_object('request_id',a.id,'resolution_source','DELIVERY_RECOVERED')
    from public.activity_history a where a.entity_id=l.id and a.event_type='AI_ACTION_OPEN' and a.metadata->>'kind'='COMMUNICATION_FAILURE'
      and (a.metadata->>'failure_source'='message:'||new.id::text
       or (a.metadata->>'failure_source' like 'job:%' and new.sender_type in ('AI','HUMAN') and new.automation_rule_id is null and new.created_at>=a.created_at))
      and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=a.id::text)
    on conflict do nothing;
  end if;
 end if;
 if failed and l.id is not null and not exists(select 1 from public.customers where id=l.customer_id and sms_opted_out_at is not null) then
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
  values(l.customer_id,'LEAD',l.id,'AI_ACTION_OPEN','Customer communication needs review','Communications',
   jsonb_build_object('kind','COMMUNICATION_FAILURE','failure_source',source,'message_id',m.id,
    'request',case when source like 'job:%' then 'The customer did not receive a reply. Review the conversation.' else 'A message could not be confirmed delivered. Check its status before sending again.' end,'error',left(detail,500)))
  on conflict do nothing;
 end if;
 return new;
end $$;
create trigger communication_job_failure after update on public.communication_jobs for each row execute function public.communication_failure_event();
create trigger communication_outbox_failure after update on public.sms_outbox for each row execute function public.communication_failure_event();
create trigger communication_delivery_recovery after update on public.lead_messages for each row execute function public.communication_failure_event();
revoke all on function public.communication_failure_event() from public,anon,authenticated;
commit;
