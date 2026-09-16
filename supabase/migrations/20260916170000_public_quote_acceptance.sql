begin;

-- Output columns from RETURNS TABLE are PL/pgSQL variables. Qualify every
-- same-named table column so acceptance cannot fail with an ambiguous-column
-- error after the customer confirms the quote.
create or replace function public.accept_public_quote(p_token_hash text)
returns table (quote_id uuid, status text, accepted_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.customer_document_tokens%rowtype;
  v_quote public.quotes%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select t.* into v_token
  from public.customer_document_tokens as t
  where t.token_hash = p_token_hash and t.document_type = 'QUOTE'
  for update;
  if not found or v_token.revoked_at is not null then
    raise exception 'This link is no longer available';
  end if;

  select q.* into v_quote
  from public.quotes as q
  where q.id = v_token.quote_id
  for update;
  if not found or v_quote.status in ('VOID','DECLINED') then
    raise exception 'This quote is no longer available';
  end if;
  if v_quote.status not in ('SENT','ACCEPTED') then
    raise exception 'This quote is not available for acceptance';
  end if;

  if v_quote.status = 'SENT' then
    update public.quotes as q
      set status = 'ACCEPTED',
          accepted_at = coalesce(q.accepted_at, now()),
          updated_at = now()
      where q.id = v_quote.id
      returning q.* into v_quote;

    insert into public.activity_history (
      customer_id, entity_type, entity_id, event_type, summary, actor_label
    ) values (
      v_quote.customer_id, 'QUOTE', v_quote.id, 'ACCEPTED',
      'Quote ' || v_quote.quote_number || ' accepted through secure customer page',
      'Customer'
    );
  end if;

  update public.customer_document_tokens as t
    set accepted_at = coalesce(t.accepted_at, v_quote.accepted_at)
    where t.id = v_token.id;

  return query select v_quote.id, v_quote.status, v_quote.accepted_at;
end;
$$;

revoke all on function public.accept_public_quote(text) from public, anon, authenticated;
grant execute on function public.accept_public_quote(text) to service_role;

commit;
