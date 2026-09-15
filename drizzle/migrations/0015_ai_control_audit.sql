-- Stable catalog identities survive presentation-name edits. No historical
-- quote/ticket snapshots, rates, densities or delivery settings are rewritten.
alter table public.materials add column if not exists catalog_key text;
with catalog(key,name) as (values
 ('mat-1','Commercial Crushed Concrete Clean'),('mat-2','Select Fill and Cushion Sand'),
 ('mat-3','3x4 Crushed Concrete'),('mat-4','Flexbase First Class 1" or 3"'),
 ('mat-5','Mason Sand'),('mat-6','Millings Asphalt 1/2" Minus'),
 ('mat-7','Native Gravel 3/8"-1"'),('mat-8','Concrete Sand Mix Native Gravel'),
 ('mat-9','Decomposed Granite'),('mat-10','Limestone 1"-1 1/2"'))
update public.materials m set catalog_key=c.key from catalog c
where m.catalog_key is null and (lower(trim(m.name))=lower(c.name)
 or (c.key='mat-6' and lower(trim(m.name))='millings asphalt 1/2"'));
create unique index if not exists materials_catalog_key_unique on public.materials(catalog_key) where catalog_key is not null;
create or replace function public.protect_material_catalog_key() returns trigger language plpgsql as $$
begin
 if new.catalog_key is distinct from old.catalog_key then raise exception 'Material identity cannot be changed'; end if;
 return new;
end $$;
create trigger protect_material_catalog_identity before update on public.materials for each row execute function public.protect_material_catalog_key();

create table public.ai_operation_settings (
 id integer primary key default 1 check(id=1),
 model text, tone text not null default 'WARM' check(tone in ('WARM','DIRECT','PROFESSIONAL')),
 concise boolean not null default true, version integer not null default 1,
 review_enabled boolean not null default true, last_review_at timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.ai_operation_settings(id) values(1);
create table public.ai_operation_history (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 actor_id uuid, kind text not null check(kind in ('SETTINGS','ROLLBACK','REVIEW')),
 before_settings jsonb, after_settings jsonb, findings jsonb not null default '[]'::jsonb,
 summary text not null
);
alter table public.ai_operation_settings enable row level security;
alter table public.ai_operation_history enable row level security;
create policy ai_operations_staff_read on public.ai_operation_settings for select to authenticated using(public.is_admin_or_staff());
create policy ai_history_staff_read on public.ai_operation_history for select to authenticated using(public.is_admin_or_staff());
grant select on public.ai_operation_settings,public.ai_operation_history to authenticated;
grant all on public.ai_operation_settings,public.ai_operation_history to service_role;
revoke insert,update,delete on public.ai_operation_settings,public.ai_operation_history from anon,authenticated;

create function public.save_ai_operation_settings(p_actor uuid,p_expected_version integer,p_model text,p_tone text,p_concise boolean,p_review_enabled boolean,p_rollback_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare oldrow public.ai_operation_settings; newrow public.ai_operation_settings;
begin
 if not exists(select 1 from user_roles where user_id=p_actor and role='admin') then raise exception 'Admin required'; end if;
 select * into oldrow from ai_operation_settings where id=1 for update;
 if oldrow.version<>p_expected_version then raise exception 'Settings changed. Refresh before saving.'; end if;
 update ai_operation_settings set model=nullif(trim(p_model),''),tone=p_tone,concise=p_concise,
 review_enabled=p_review_enabled,version=version+1,updated_at=now() where id=1 returning * into newrow;
 insert into ai_operation_history(actor_id,kind,before_settings,after_settings,summary)
 values(p_actor,case when p_rollback_id is null then 'SETTINGS' else 'ROLLBACK' end,to_jsonb(oldrow),to_jsonb(newrow),
 case when p_rollback_id is null then 'AI presentation settings updated. Business rules unchanged.' else 'Restored earlier AI presentation settings. Business rules unchanged.' end);
 return to_jsonb(newrow);
end $$;
revoke all on function public.save_ai_operation_settings(uuid,integer,text,text,boolean,boolean,uuid) from public,anon,authenticated;
grant execute on function public.save_ai_operation_settings(uuid,integer,text,text,boolean,boolean,uuid) to service_role;

-- Evidence-based review, never a self-modifying prompt. Runs at most every
-- three days, including concurrent/manual invocations. Stores no message text.
create function public.review_ai_operations() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg public.ai_operation_settings; findings jsonb='[]'; failures integer; repeats integer; corrections integer;
begin
 select * into cfg from ai_operation_settings where id=1 for update;
 if not cfg.review_enabled or cfg.last_review_at>now()-interval '3 days' then return jsonb_build_object('skipped',true); end if;
 select count(*) into failures from ai_audit_logs where created_at>now()-interval '3 days' and status='FAILED';
 select count(*) into repeats from (select lead_id,lower(trim(body)) from lead_messages
   where created_at>now()-interval '3 days' and sender_type='AI' group by lead_id,lower(trim(body)) having count(*)>1) repeated;
 select count(*) into corrections from lead_messages where created_at>now()-interval '3 days' and sender_type='CUSTOMER'
   and body ~* '\m(actually|already told|that is wrong|not what|ya dije|incorrecto)\M';
 if failures>0 then findings=findings||jsonb_build_array(jsonb_build_object('code','GENERATION_FAILURES','count',failures,'recommendation','Inspect failure reasons and provider latency before changing the model.')); end if;
 if repeats>0 then findings=findings||jsonb_build_array(jsonb_build_object('code','REPEATED_REPLIES','count',repeats,'recommendation','Review repeated replies in context. Check extracted facts and preceding customer answers.')); end if;
 if corrections>0 then findings=findings||jsonb_build_array(jsonb_build_object('code','CUSTOMER_CORRECTIONS','count',corrections,'recommendation','Review customer corrections for missed context. Do not change prices or formulas automatically.')); end if;
 insert into ai_operation_history(kind,summary,findings) values('REVIEW','Three day conversation review. Recommendations only; no production rules changed.',findings);
 update ai_operation_settings set last_review_at=now() where id=1;
 return jsonb_build_object('findings',findings,'changed_rules',false);
end $$;
revoke all on function public.review_ai_operations() from public,anon,authenticated;
grant execute on function public.review_ai_operations() to service_role;

-- Replace the six-per-hour conversational cutoff with an emergency burst
-- circuit breaker. The one-job-per-inbound/revision/idempotency gates remain.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.authorize_sms_dispatch(uuid,uuid)'::regprocedure) into definition;
 if position('Conversation rate limit reached' in definition)=0 then raise exception 'SMS rate guard changed; manual migration review required'; end if;
 definition=replace(definition, 'other.first_attempt_at>now()-interval ''1 hour'')>=6 then ''Conversation rate limit reached''',
 'other.first_attempt_at>now()-interval ''1 minute'')>=12 then ''AI_BURST_GUARD: 12 replies in 60 seconds; inspect for a loop''');
 if position('Conversation rate limit reached' in definition)>0 then raise exception 'SMS rate guard replacement did not match'; end if;
 execute definition;
end $$;