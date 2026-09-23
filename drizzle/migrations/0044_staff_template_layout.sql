begin;
alter table public.staff_sms_settings add column staff_template_id text, add column staff_template_ready boolean not null default false,
 add constraint staff_template_ready_requires_id check(not staff_template_ready or nullif(trim(staff_template_id),'') is not null);

-- Normalize each variable, never the rendered layout. Older approved template
-- is a safe one-line fallback while the dedicated layout awaits approval.
create function public.staff_sms_template_parameters(p_body text) returns jsonb
language sql immutable set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'event',regexp_replace(split_part(p_body,E'\n',1),'[\r\t ]+',' ','g'),
  'customer',regexp_replace(split_part(p_body,E'\n',2),'[\r\t ]+',' ','g'),
  'detail',trim(regexp_replace(regexp_replace(regexp_replace(split_part(p_body,E'\n\nOpen: ',1),E'^[^\n]*\n[^\n]*\n',''),E'\n+',' · ','g'),'[\r\t ]+',' ','g')),
  'link',trim(regexp_replace(split_part(p_body,E'\n\nOpen: ',2),'[\n\r\t ]+',' ','g'))
 );
$$;
revoke all on function public.staff_sms_template_parameters(text) from public,anon,authenticated;
grant execute on function public.staff_sms_template_parameters(text) to service_role;
do $$ declare d text; before_patch text; begin
 select pg_get_functiondef('public.authorize_staff_sms_dispatch(uuid,uuid,text)'::regprocedure) into d;
 before_patch:=d;
 d:=replace(d,'when nullif(trim(p_template_id),'''') is null then', 'when not s.staff_template_ready and nullif(trim(p_template_id),'''') is null then');
 d:=replace(d,$old$jsonb_build_object('id',p_template_id,'parameters',jsonb_build_object('message',o.body))$old$,
 $new$jsonb_build_object('id',case when s.staff_template_ready then s.staff_template_id else p_template_id end,'parameters',case when s.staff_template_ready then public.staff_sms_template_parameters(o.body) else jsonb_build_object('message',trim(regexp_replace(o.body,'[\n\r\t ]+',' ','g'))) end)$new$);
 if d=before_patch or position('staff_sms_template_parameters(o.body)' in d)=0 then raise exception 'Staff payload patch target changed'; end if;
 execute d;
end $$;
commit;
