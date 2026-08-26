create or replace function public.next_quote_number()
returns text language sql security definer set search_path = public, pg_temp as $$
  select 'Q' || nextval('public.quote_number_seq')::text;
$$;
create or replace function public.next_invoice_number()
returns text language sql security definer set search_path = public, pg_temp as $$
  select nextval('public.invoice_number_seq')::text;
$$;
revoke all on function public.next_quote_number() from public, anon, authenticated;
revoke all on function public.next_invoice_number() from public, anon, authenticated;

create or replace function public.find_or_create_customer(
  p_name text,
  p_phone text default null,
  p_email text default null
)
returns public.customers
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_customer public.customers%rowtype;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Customer name is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(v_phone, '') || '|' || coalesce(v_email, ''), 0));

  select * into v_customer from public.customers
  where (v_phone is not null and normalized_phone = v_phone)
     or (v_email is not null and normalized_email = v_email)
  order by last_activity_at desc limit 1 for update;

  if found then
    update public.customers set
      phone = coalesce(phone, nullif(trim(p_phone), '')),
      email = coalesce(email, nullif(trim(p_email), '')),
      normalized_phone = coalesce(normalized_phone, v_phone),
      normalized_email = coalesce(normalized_email, v_email),
      last_activity_at = now()
    where id = v_customer.id returning * into v_customer;
  else
    insert into public.customers (name, phone, normalized_phone, email, normalized_email)
    values (trim(p_name), nullif(trim(p_phone), ''), v_phone, nullif(trim(p_email), ''), v_email)
    returning * into v_customer;
  end if;
  return v_customer;
end;
$$;

create or replace function public.create_lead_with_customer(
  p_name text, p_phone text, p_email text, p_source text, p_campaign text, p_need text
)
returns table (lead_id uuid, customer_id uuid, matched_existing boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_before integer;
  v_customer public.customers%rowtype;
  v_lead_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  select count(*) into v_before from public.customers
    where normalized_phone = nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '')
       or normalized_email = nullif(lower(trim(coalesce(p_email, ''))), '');
  v_customer := public.find_or_create_customer(p_name, p_phone, p_email);
  insert into public.leads (customer_id, source, campaign, need)
    values (v_customer.id, p_source, nullif(trim(p_campaign), ''), trim(p_need)) returning id into v_lead_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_customer.id, 'LEAD', v_lead_id, 'CREATED', 'Lead created', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return query select v_lead_id, v_customer.id, v_before > 0;
end;
$$;

create or replace function public.create_job_with_customer(
  p_name text, p_phone text, p_email text, p_customer_id uuid, p_quote_id uuid,
  p_category text, p_date date, p_time time, p_all_day boolean, p_address text,
  p_description text, p_agreed_amount numeric, p_notes text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_customer public.customers%rowtype; v_customer_id uuid; v_job_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if p_customer_id is null then
    v_customer := public.find_or_create_customer(p_name, p_phone, p_email);
    v_customer_id := v_customer.id;
  else
    v_customer_id := p_customer_id;
  end if;
  insert into public.jobs (customer_id, quote_id, category, scheduled_date, scheduled_time, all_day, address, description, agreed_amount, notes)
  values (v_customer_id, p_quote_id, p_category, p_date, case when p_all_day then null else p_time end, p_all_day, trim(p_address), trim(p_description), p_agreed_amount, nullif(trim(p_notes), ''))
  returning id into v_job_id;
  if p_quote_id is not null then
    update public.quotes set status = 'ACCEPTED', accepted_at = coalesce(accepted_at, now()) where id = p_quote_id;
    update public.leads set status = 'WON' where id = (select lead_id from public.quotes where id = p_quote_id);
  end if;
  update public.customers set last_activity_at = now() where id = v_customer_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_customer_id, 'JOB', v_job_id, 'SCHEDULED', 'Job scheduled', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return v_job_id;
end;
$$;

create or replace function public.save_quote_atomic(p_quote jsonb, p_items jsonb)
returns table (id uuid, quote_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_number text; v_customer_id uuid; v_lead_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  v_customer_id := (p_quote->>'customer_id')::uuid;
  v_lead_id := nullif(p_quote->>'lead_id', '')::uuid;
  if jsonb_array_length(p_items) = 0 then raise exception 'At least one quote item is required'; end if;
  v_number := public.next_quote_number();
  insert into public.quotes (
    quote_number, customer_id, lead_id, status, description, address, delivery_type, delivery_miles,
    delivery_fee_per_load, delivery_load_count, delivery_total, materials_subtotal,
    custom_work_subtotal, tax_rate, tax_applies_to_delivery, custom_work_tax_rule,
    tax_amount, grand_total, notes
  ) values (
    v_number, v_customer_id, v_lead_id, coalesce(nullif(p_quote->>'status',''),'DRAFT'),
    coalesce(p_quote->>'description',''), coalesce(p_quote->>'address',''), nullif(p_quote->>'delivery_type',''),
    nullif(p_quote->>'delivery_miles','')::numeric, coalesce((p_quote->>'delivery_fee_per_load')::numeric,0),
    coalesce((p_quote->>'delivery_load_count')::integer,1), coalesce((p_quote->>'delivery_total')::numeric,0),
    coalesce((p_quote->>'materials_subtotal')::numeric,0), coalesce((p_quote->>'custom_work_subtotal')::numeric,0),
    coalesce((p_quote->>'tax_rate')::numeric,0), coalesce((p_quote->>'tax_applies_to_delivery')::boolean,true),
    coalesce(nullif(p_quote->>'custom_work_tax_rule',''),'PENDING'), coalesce((p_quote->>'tax_amount')::numeric,0),
    coalesce((p_quote->>'grand_total')::numeric,0), nullif(p_quote->>'notes','')
  ) returning public.quotes.id into v_id;
  insert into public.quote_items (quote_id, kind, material_id, description, loads, yards, is_full_load, rate_used, line_total)
  select v_id, item->>'kind', nullif(item->>'material_id','')::uuid, item->>'description',
    nullif(item->>'loads','')::integer, nullif(item->>'yards','')::numeric,
    coalesce((item->>'is_full_load')::boolean,false), coalesce((item->>'rate_used')::numeric,0),
    coalesce((item->>'line_total')::numeric,0)
  from jsonb_array_elements(p_items) as elements(item);
  if v_lead_id is not null then update public.leads set status = 'QUOTED' where public.leads.id = v_lead_id; end if;
  update public.customers set last_activity_at = now() where public.customers.id = v_customer_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_customer_id, 'QUOTE', v_id, 'CREATED', 'Quote ' || v_number || ' created', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return query select v_id, v_number;
end;
$$;

-- A distinctly named compatibility RPC prevents PostgREST ambiguity when both
-- the approved UUID overload and Lovable's later text overload exist.
create or replace function public.create_ticket_compat_atomic(
  p_ticket jsonb, p_items jsonb, p_client_request_id text,
  p_preserve_legacy_unknowns boolean default false
)
returns table (id uuid, ticket_number text, created boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_number text; v_existing public.tickets%rowtype;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if nullif(trim(p_client_request_id),'') is null then raise exception 'Client request id is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id, 0));
  select * into v_existing from public.tickets where client_request_id::text = p_client_request_id;
  if found then
    return query select v_existing.id, v_existing.ticket_number, false;
    return;
  end if;

  -- Prefer the approved UUID overload. If the managed project only has the
  -- Lovable text overload, call that instead. UUID-formatted request ids are
  -- used by the client in either case.
  if to_regprocedure('public.create_ticket_atomic(jsonb,jsonb,uuid,boolean)') is not null then
    execute 'select x.id, x.ticket_number from public.create_ticket_atomic($1,$2,$3::uuid,$4) x'
      into v_id, v_number using p_ticket, p_items, p_client_request_id, p_preserve_legacy_unknowns;
  else
    execute 'select x.id, x.ticket_number from public.create_ticket_atomic($1,$2,$3::text,$4) x'
      into v_id, v_number using p_ticket, p_items, p_client_request_id, p_preserve_legacy_unknowns;
  end if;
  if v_id is null then raise exception 'Ticket save returned no record'; end if;
  return query select v_id, v_number, true;
end;
$$;

create or replace function public.create_control_center_ticket_atomic(
  p_ticket jsonb, p_items jsonb, p_client_request_id text, p_customer_id uuid,
  p_job_id uuid default null, p_preserve_legacy_unknowns boolean default false
)
returns table (id uuid, ticket_number text, created boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result record;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.customers where public.customers.id = p_customer_id) then raise exception 'Customer not found'; end if;
  if p_job_id is not null and not exists (
    select 1 from public.jobs where public.jobs.id = p_job_id and customer_id = p_customer_id
  ) then raise exception 'Job does not belong to this customer'; end if;

  select * into v_result from public.create_ticket_compat_atomic(
    p_ticket, p_items, p_client_request_id, p_preserve_legacy_unknowns
  );
  if not v_result.created then
    if exists (
      select 1 from public.tickets t where t.id=v_result.id
        and (t.customer_id is distinct from p_customer_id or t.job_id is distinct from p_job_id)
    ) then raise exception 'Idempotency key already belongs to a different Ticket context'; end if;
    return query select v_result.id, v_result.ticket_number, false;
    return;
  end if;

  perform set_config('app.ticket_safe_write', 'true', true);
  update public.tickets set customer_id = p_customer_id, job_id = p_job_id where public.tickets.id = v_result.id;
  insert into public.ticket_history (ticket_id, event_type, actor_id, actor_label, after_snapshot)
    values (
      v_result.id,
      'context_linked',
      auth.uid(),
      coalesce(auth.jwt()->>'email', auth.uid()::text),
      jsonb_build_object('customer_id', p_customer_id, 'job_id', p_job_id)
    );
  update public.customers set last_activity_at = now() where public.customers.id = p_customer_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (p_customer_id, 'TICKET', v_result.id, 'CREATED', 'Ticket ' || v_result.ticket_number || ' created', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return query select v_result.id, v_result.ticket_number, true;
end;
$$;

revoke all on function public.find_or_create_customer(text,text,text) from public, anon;
revoke all on function public.create_lead_with_customer(text,text,text,text,text,text) from public, anon;
revoke all on function public.create_job_with_customer(text,text,text,uuid,uuid,text,date,time,boolean,text,text,numeric,text) from public, anon;
revoke all on function public.save_quote_atomic(jsonb,jsonb) from public, anon;
revoke all on function public.create_ticket_compat_atomic(jsonb,jsonb,text,boolean) from public, anon;
revoke all on function public.create_control_center_ticket_atomic(jsonb,jsonb,text,uuid,uuid,boolean) from public, anon;

grant execute on function public.find_or_create_customer(text,text,text) to authenticated;
grant execute on function public.create_lead_with_customer(text,text,text,text,text,text) to authenticated;
grant execute on function public.create_job_with_customer(text,text,text,uuid,uuid,text,date,time,boolean,text,text,numeric,text) to authenticated;
grant execute on function public.save_quote_atomic(jsonb,jsonb) to authenticated;
grant execute on function public.create_ticket_compat_atomic(jsonb,jsonb,text,boolean) to authenticated;
grant execute on function public.create_control_center_ticket_atomic(jsonb,jsonb,text,uuid,uuid,boolean) to authenticated;