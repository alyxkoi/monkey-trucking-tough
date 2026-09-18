begin;

-- A pre-acceptance reservation is not a job or an accepted quote. Keep it on
-- the existing lead; the calendar displays it separately until staff schedules.
alter table public.leads add column if not exists reserved_delivery_date date,
  add column if not exists reserved_delivery_time time,
  add column if not exists delivery_reserved_at timestamptz;
create index if not exists leads_delivery_reservation_idx on public.leads(reserved_delivery_date,reserved_delivery_time) where delivery_reserved_at is not null;

create or replace function public.delivery_slot_available(p_date date,p_time time,p_lead_id uuid default null,p_job_id uuid default null)
returns boolean language sql volatile security definer set search_path=public,pg_temp as $$
 select p_date is not null and p_time is not null
 and not exists(select 1 from public.jobs j where j.id is distinct from p_job_id
   and j.scheduled_date between p_date-1 and p_date+1
   and j.status in ('SCHEDULED','IN_PROGRESS') and
   (j.all_day and j.scheduled_date=p_date or j.scheduled_time is null and j.scheduled_date=p_date
    or abs(extract(epoch from ((j.scheduled_date+j.scheduled_time)-(p_date+p_time))))<3600))
 and not exists(select 1 from public.leads l where l.id is distinct from p_lead_id
   and l.reserved_delivery_date between p_date-1 and p_date+1
   and l.status<>'LOST' and l.delivery_reserved_at is not null
   and abs(extract(epoch from ((l.reserved_delivery_date+l.reserved_delivery_time)-(p_date+p_time))))<3600
   and not exists(select 1 from public.quotes q join public.jobs j on j.quote_id=q.id where q.lead_id=l.id and j.status<>'CANCELLED'));
$$;
revoke all on function public.delivery_slot_available(date,time,uuid,uuid) from public,anon,authenticated;
grant execute on function public.delivery_slot_available(date,time,uuid,uuid) to service_role;

create or replace function public.check_delivery_slot(p_date date,p_time time,p_lead_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_date is null or p_time is null or p_date>(now() at time zone 'America/Chicago')::date+730 then return jsonb_build_object('status','UNAVAILABLE'); end if;
 if p_date+p_time<=now() at time zone 'America/Chicago' then return jsonb_build_object('status','PAST','date',p_date,'time',p_time); end if;
 if public.delivery_slot_available(p_date,p_time,p_lead_id) then return jsonb_build_object('status','AVAILABLE','date',p_date,'time',p_time); end if;
 return jsonb_build_object('status',case when p_date+p_time<=now() at time zone 'America/Chicago' then 'PAST' else 'CONFLICT' end,'date',p_date,'time',p_time);
end $$;
revoke all on function public.check_delivery_slot(date,time,uuid) from public,anon,authenticated;
grant execute on function public.check_delivery_slot(date,time,uuid) to service_role;

-- Every calendar writer shares the same transactional lock, including staff.
-- Non-scheduling edits to historical jobs are not revalidated.
create or replace function public.guard_delivery_calendar() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare own_lead uuid;
begin
 if tg_op='UPDATE' and (new.scheduled_date,new.scheduled_time,new.all_day,new.status,new.quote_id)
   is not distinct from (old.scheduled_date,old.scheduled_time,old.all_day,old.status,old.quote_id) then return new; end if;
 if new.status not in ('SCHEDULED','IN_PROGRESS') then return new; end if;
 perform pg_advisory_xact_lock(724601918);
 select lead_id into own_lead from public.quotes where id=new.quote_id;
 if new.all_day or new.scheduled_time is null then
   if exists(select 1 from public.jobs where id<>new.id and status in ('SCHEDULED','IN_PROGRESS') and scheduled_date=new.scheduled_date)
     or exists(select 1 from public.leads where id is distinct from own_lead and status<>'LOST' and delivery_reserved_at is not null and reserved_delivery_date=new.scheduled_date)
   then raise exception 'This day already has a job or reserved delivery. Choose another day or a specific available time.'; end if;
 elsif not public.delivery_slot_available(new.scheduled_date,new.scheduled_time,own_lead,new.id) then
   raise exception 'This time is unavailable. Allow at least one hour between deliveries and check all-day jobs.';
 end if;
 return new;
end $$;
drop trigger if exists guard_delivery_calendar on public.jobs;
create trigger guard_delivery_calendar before insert or update on public.jobs for each row execute function public.guard_delivery_calendar();

create or replace function public.consume_delivery_reservation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status<>'CANCELLED' and new.quote_id is not null then
   update public.leads set reserved_delivery_date=null,reserved_delivery_time=null,delivery_reserved_at=null
   where id=(select lead_id from public.quotes where id=new.quote_id) and delivery_reserved_at is not null;
 end if;
 return new;
end $$;
drop trigger if exists consume_delivery_reservation on public.jobs;
create trigger consume_delivery_reservation after insert or update on public.jobs for each row execute function public.consume_delivery_reservation();

create or replace function public.release_declined_delivery_reservation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status in ('DECLINED','VOID') and new.status is distinct from old.status then
   update public.leads set reserved_delivery_date=null,reserved_delivery_time=null,delivery_reserved_at=null where id=new.lead_id;
 end if;
 return new;
end $$;
drop trigger if exists release_declined_delivery_reservation on public.quotes;
create trigger release_declined_delivery_reservation after update on public.quotes for each row execute function public.release_declined_delivery_reservation();

create or replace function public.release_inactive_delivery_reservation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.delivery_reserved_at is not null and (new.status='LOST' or new.need='material-pickup') then
   new.reserved_delivery_date:=null;new.reserved_delivery_time:=null;new.delivery_reserved_at:=null;
 end if;
 return new;
end $$;
drop trigger if exists release_inactive_delivery_reservation on public.leads;
create trigger release_inactive_delivery_reservation before update on public.leads for each row execute function public.release_inactive_delivery_reservation();

-- Retain the existing transactional identity/pricing/quote/revision protections.
do $$ begin
 if to_regprocedure('public.apply_ai_lifecycle_before_calendar(uuid,bigint,uuid,jsonb)') is null then
   alter function public.apply_ai_lifecycle(uuid,bigint,uuid,jsonb) rename to apply_ai_lifecycle_before_calendar;
 end if;
end $$;
revoke all on function public.apply_ai_lifecycle_before_calendar(uuid,bigint,uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function public.apply_ai_lifecycle(p_lead_id uuid,p_expected_revision bigint,p_source_message_id uuid,p_plan jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.leads%rowtype; c public.customers%rowtype; result jsonb; slot jsonb; plan jsonb:=p_plan; d date; t time; eligible boolean:=false;
begin
 -- Serialize the check and write with all staff job scheduling.
 perform pg_advisory_xact_lock(724601918);
 select * into l from public.leads where id=p_lead_id;
 select * into c from public.customers where id=l.customer_id for update;
 select * into l from public.leads where id=p_lead_id for update;
 if l.id is null or l.conversation_revision is distinct from p_expected_revision then return jsonb_build_object('status','STALE'); end if;
 select metadata->'result' into result from public.activity_history where entity_id=l.id and event_type='AI_LIFECYCLE_APPLIED' and metadata->>'source_message_id'=p_source_message_id::text limit 1;
 if found then return result||jsonb_build_object('status','ALREADY_APPLIED'); end if;
 eligible:=coalesce((plan->>'reserve_delivery')::boolean,false) and coalesce((plan->>'write_allowed')::boolean,false)
   and not l.human_takeover and l.status<>'LOST' and c.sms_opted_out_at is null and c.sms_double_opt_in_at is not null
   and nullif(plan->>'clarification','') is null
   and plan#>>'{context,pricing,status}'='MATERIAL_CALCULATED' and plan#>>'{context,pricing,route,status}'='ROUTE_CALCULATED'
   and coalesce(plan->>'lead_need',l.need)<>'material-pickup'
   and not exists(select 1 from public.quotes where lead_id=l.id and status not in ('DRAFT','VOID','DECLINED'))
   and not exists(select 1 from public.jobs j join public.quotes q on q.id=j.quote_id where q.lead_id=l.id and j.status<>'CANCELLED');
 if eligible then
   d:=nullif(plan#>>'{current,date}','')::date; t:=nullif(plan#>>'{current,time}','')::time;
   slot:=public.check_delivery_slot(d,t,l.id);
   if slot->>'status'='AVAILABLE' then
     plan:=plan||jsonb_build_object('requested_date',d,'requested_time',t);
   else
     -- Keep the requested facts, but never mark a conflicting time Quote Ready.
     plan:=plan||jsonb_build_object('ready',false);
   end if;
 elsif coalesce((plan->>'reserve_delivery')::boolean,false) then
   slot:=jsonb_build_object('status','UNAVAILABLE'); plan:=plan||jsonb_build_object('ready',false);
 end if;
 result:=public.apply_ai_lifecycle_before_calendar(p_lead_id,p_expected_revision,p_source_message_id,plan);
 if result->>'status' not in ('APPLIED','ALREADY_APPLIED') then return result; end if;
 if eligible and slot->>'status'='AVAILABLE' then
   update public.leads set reserved_delivery_date=d,reserved_delivery_time=t,delivery_reserved_at=now() where id=l.id;
   slot:=slot||jsonb_build_object('status','RESERVED');
   insert into public.activity_history(entity_type,entity_id,customer_id,event_type,summary,metadata)
   values('LEAD',l.id,l.customer_id,'DELIVERY_RESERVED','Delivery time reserved pending quote acceptance',jsonb_build_object('date',d,'time',t,'source_message_id',p_source_message_id,'previous_date',l.reserved_delivery_date,'previous_time',l.reserved_delivery_time));
 end if;
 if slot is not null then
   result:=result||jsonb_build_object('delivery_slot',slot);
   update public.activity_history set metadata=jsonb_set(metadata,'{result}',result) where entity_id=l.id and event_type='AI_LIFECYCLE_APPLIED' and metadata->>'source_message_id'=p_source_message_id::text;
 end if;
 return result;
end $$;
revoke all on function public.apply_ai_lifecycle(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_ai_lifecycle(uuid,bigint,uuid,jsonb) to service_role;

commit;
