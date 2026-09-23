-- Run once after migrations 0040-0043. This is the specifically traced test
-- conversation, not a blanket resume or historical review-request campaign.
-- Preserve all sent messages, immutable outboxes, invoices and payment records.
begin;
do $$
declare l public.leads%rowtype; c public.customers%rowtype; repaired boolean:=false;
begin
 select * into l from public.leads where id='19674d37-f4ef-4e26-9063-d2cebf019045';
 select * into c from public.customers where id=l.customer_id for update;
 select * into l from public.leads where id=l.id for update;
 if l.id is null or c.id<>'a5bc1fee-4efc-4c1d-9c59-e2e27a9d36b8' then return; end if;
 if l.human_takeover
 and exists(select 1 from public.sms_outbox o join public.lead_messages m on m.id=o.message_id
   where m.id='c4fe141a-bb33-49a8-a6d2-8df5ef3def18' and m.lead_id=l.id and o.operation_key like 'invoice-email-notice:%' and m.delivery_status='DELIVERED')
 and exists(select 1 from public.activity_history where entity_id=l.id and event_type='AI_RESUMED' and created_at='2026-09-22T14:18:15.681832Z')
 and not exists(select 1 from public.lead_messages m join public.sms_outbox o on o.message_id=m.id where m.lead_id=l.id and o.origin='HUMAN'
   and o.operation_key not like 'invoice-email-notice:%' and m.created_at>'2026-09-22T14:18:15.681832Z')
 and not exists(select 1 from public.activity_history a where a.entity_id=l.id and a.event_type='AI_ACTION_OPEN'
   and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=a.id::text))
 and not exists(select 1 from public.ai_audit_logs where lead_id=l.id and created_at>'2026-09-22T14:36:21.48416Z') then
  update public.leads set human_takeover=false,conversation_revision=conversation_revision+1,updated_at=now() where id=l.id;
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
  values(c.id,'LEAD',l.id,'AUTOMATED_TAKEOVER_CORRECTED','Removed invoice-notice-induced pause; prior staff resume preserved','Maintenance',jsonb_build_object('message_id','c4fe141a-bb33-49a8-a6d2-8df5ef3def18','previous_human_takeover',true,'previous_revision',l.conversation_revision));
  repaired:=true;
 end if;
 if lower(c.name) in ('it''s okay','it’s okay')
 and exists(select 1 from public.lead_messages n where n.lead_id=l.id and n.sender_type='CUSTOMER' and lower(trim(n.body))='tyrone'
   and exists(select 1 from public.lead_messages q where q.lead_id=l.id and q.sender_type='AI' and q.body ilike '%What name should we put this under?%' and q.created_at<n.created_at)) then
  update public.customers set name='Tyrone',updated_at=now() where id=c.id;
  update public.ai_conversation_state s set known_facts=(select coalesce(jsonb_agg(case when f->>'key' in ('name','customer_name') and lower(f->>'value') in ('it''s okay','it’s okay') then jsonb_set(f,'{value}','"Tyrone"') else f end),'[]') from jsonb_array_elements(s.known_facts) f),updated_at=now() where lead_id=l.id;
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
  values(c.id,'CUSTOMER',c.id,'CUSTOMER_NAME_CORRECTED','Corrected name from the customer answer to the name question','Maintenance',jsonb_build_object('before_name',c.name,'after_name','Tyrone','lead_id',l.id));
 end if;
 -- Existing confirmed completion/payment remains the only eligibility source.
 if repaired then perform public.plan_communication_jobs(); end if;
end $$;
commit;
