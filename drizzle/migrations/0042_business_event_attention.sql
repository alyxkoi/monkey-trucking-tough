begin;
-- Current business records invalidate old intake objectives without a new SMS.
create function public.sync_business_conversation(p_lead_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.quotes%rowtype; j public.jobs%rowtype; i public.invoices%rowtype; l public.leads%rowtype; a public.activity_history%rowtype; reason text;
begin
 select * into l from public.leads where id=p_lead_id;
 if not found then return; end if;
 select * into q from public.quotes where lead_id=l.id and status not in ('VOID','DECLINED') order by created_at desc limit 1;
 select * into j from public.jobs where quote_id=q.id and status<>'CANCELLED' order by created_at desc limit 1;
 select * into i from public.invoices where (job_id=j.id or quote_id=q.id) and status<>'VOID' order by created_at desc limit 1;
 if q.status in ('SENT','ACCEPTED') or j.id is not null or l.status='WON' then
  update public.ai_conversation_state set missing_facts='[]',updated_at=now() where lead_id=l.id and missing_facts<>'[]'::jsonb;
 end if;
 for a in select h.* from public.activity_history h where h.entity_id=l.id and h.event_type='AI_ACTION_OPEN'
 and not exists(select 1 from public.activity_history r where r.event_type='AI_ACTION_RESOLVED' and r.metadata->>'request_id'=h.id::text) loop
  reason:=null;
  if a.metadata->>'kind'='QUOTE_READY' and exists(select 1 from public.quotes where id::text=a.metadata->>'quote_id' and status in ('SENT','ACCEPTED','DECLINED','VOID')) then reason:='Quote already handled';
  elsif a.metadata->>'kind'='PAYMENT_CLAIM' and i.id::text=a.metadata->>'invoice_id' and i.status='PAID' and not i.disputed and i.payment_claimed_at is null
    and (select coalesce(sum(amount),0) from public.payments where invoice_id=i.id and voided_at is null and confirmed_by in ('HUMAN','PROCESSOR'))>=i.amount then reason:='Full payment confirmed';
  elsif a.metadata->>'kind'='HUMAN_REQUEST' and not l.human_takeover then reason:='Staff resumed this conversation';
  elsif a.metadata->>'kind'='CUSTOM_WORK' and a.metadata->>'quote_id'=q.id::text and q.status in ('SENT','ACCEPTED') and a.created_at<=q.sent_at
    and exists(select 1 from public.quote_items where quote_id=q.id and kind='CUSTOM_WORK' and line_total>0) then reason:='Custom work priced in the sent quote';
  end if;
  if reason is not null then
   insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_label,metadata)
   values(l.customer_id,'LEAD',l.id,'AI_ACTION_RESOLVED',reason,'Business workflow',jsonb_build_object('request_id',a.id,'resolution_source','BUSINESS_EVENT')) on conflict do nothing;
  end if;
 end loop;
end $$;
create function public.business_conversation_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare lead_id uuid;
begin
 if tg_table_name='quotes' then lead_id:=new.lead_id;
 elsif tg_table_name='leads' then lead_id:=new.id;
 elsif tg_table_name='jobs' then select q.lead_id into lead_id from public.quotes q where q.id=new.quote_id;
 else select coalesce(q.lead_id,jq.lead_id) into lead_id from public.invoices i left join public.quotes q on q.id=i.quote_id left join public.jobs j on j.id=i.job_id left join public.quotes jq on jq.id=j.quote_id where i.id=new.id;
 end if;
 if lead_id is not null then perform public.sync_business_conversation(lead_id); end if;
 return new;
end $$;
create trigger business_conversation_quote after insert or update of status,sent_at on public.quotes for each row execute function public.business_conversation_event();
create trigger business_conversation_job after insert or update of status,completed_at on public.jobs for each row execute function public.business_conversation_event();
create trigger business_conversation_invoice after insert or update of status,paid_at,payment_claimed_at on public.invoices for each row execute function public.business_conversation_event();
create trigger business_conversation_lead after update of status,human_takeover on public.leads for each row execute function public.business_conversation_event();
revoke all on function public.sync_business_conversation(uuid),public.business_conversation_event() from public,anon,authenticated;
grant execute on function public.sync_business_conversation(uuid) to service_role;

-- Only extend source evidence to the actual adjacent, unsent customer burst.
-- Identity, revision, consent, protected records and current-trigger checks stay.
do $$ declare d text; begin
 select pg_get_functiondef('public.apply_ai_lifecycle_before_calendar(uuid,bigint,uuid,jsonb)'::regprocedure) into d;
 if position('facts_only:=' in d)=0 then raise exception 'Lifecycle evidence patch requires audit'; end if;
 d:=replace(d,'facts_only:=',$patch$
 if m.message_kind is distinct from 'COMPLIANCE' then
  select string_agg(b.body,E'\n' order by b.created_at,b.id) into m.body from (
   select prior.id,prior.body,prior.created_at from public.lead_messages prior
   where prior.lead_id=l.id and prior.sender_type='CUSTOMER' and prior.message_kind is distinct from 'COMPLIANCE'
    and (prior.created_at,prior.id)<=(m.created_at,m.id) and prior.created_at>=m.created_at-interval '10 seconds'
    and not exists(select 1 from public.lead_messages boundary where boundary.lead_id=l.id
      and (boundary.sender_type<>'CUSTOMER' or boundary.message_kind='COMPLIANCE')
      and (boundary.created_at,boundary.id)>(prior.created_at,prior.id) and (boundary.created_at,boundary.id)<(m.created_at,m.id))
   order by prior.created_at desc,prior.id desc limit 6
  ) b;
  if evidence.id=m.id then evidence.body:=m.body; end if;
 end if;
 if lower(trim(coalesce(p_plan->>'name',''))) ~ '^(it[''’]?s okay|okay|ok|thanks|thank you|please|sounds good|no problem|está bien)$' then
  p_plan:=p_plan-'name';
 end if;
 facts_only:=$patch$);
 execute d;
end $$;
-- Reconcile existing state using business truth, never blanket-close requests.
select public.sync_business_conversation(id) from public.leads;
commit;