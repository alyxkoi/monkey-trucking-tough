begin;

create or replace function public.apply_ai_lead_need(
  p_lead_id uuid,
  p_expected_revision bigint,
  p_source_message_id uuid,
  p_need text,
  p_source_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_quote public.quotes%rowtype;
  v_message public.lead_messages%rowtype;
  v_need text := lower(trim(coalesce(p_need, '')));
  v_source_text text := trim(coalesce(p_source_text, ''));
  v_previous_need text;
begin
  if v_need not in ('material-delivery','material-pickup','driveway','pond','dirt-grading','land-clearing') then
    raise exception 'Unsupported lead need classification' using errcode = '22023';
  end if;
  if v_source_text = '' or length(v_source_text) > 500 then
    raise exception 'Lead need classification requires concise customer evidence' using errcode = '22023';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null or v_lead.conversation_revision is distinct from p_expected_revision then
    return jsonb_build_object('status', 'STALE');
  end if;
  if v_lead.human_takeover then
    return jsonb_build_object('status', 'HUMAN_TAKEOVER');
  end if;

  select * into v_message
  from public.lead_messages
  where id = p_source_message_id
    and lead_id = v_lead.id
    and customer_id = v_lead.customer_id
    and sender_type = 'CUSTOMER';

  if v_message.id is null or position(lower(v_source_text) in lower(v_message.body)) = 0 then
    raise exception 'Lead need classification must come from the cited customer message' using errcode = '22023';
  end if;

  select * into v_quote
  from public.quotes
  where lead_id = v_lead.id and status not in ('VOID','DECLINED')
  order by created_at desc
  limit 1
  for update;

  if v_quote.id is not null and v_quote.status <> 'DRAFT' then
    return jsonb_build_object('status', 'PROTECTED');
  end if;

  if exists (
    select 1
    from public.activity_history
    where entity_id = v_lead.id
      and event_type = 'AI_LEAD_NEED_UPDATED'
      and metadata->>'source_message_id' = v_message.id::text
      and metadata->>'need' = v_need
  ) then
    return jsonb_build_object('status', 'ALREADY_APPLIED', 'need', v_need);
  end if;

  v_previous_need := v_lead.need;
  if v_previous_need is distinct from v_need then
    update public.leads
    set need = v_need, updated_at = now()
    where id = v_lead.id;

    if v_quote.id is not null
      and v_quote.status = 'DRAFT'
      and (v_quote.description = v_previous_need or v_quote.description = 'Inbound SMS conversation') then
      update public.quotes set description = v_need where id = v_quote.id;
    end if;
  end if;

  insert into public.activity_history (
    customer_id, entity_type, entity_id, event_type, summary, actor_label, metadata
  ) values (
    v_lead.customer_id, 'LEAD', v_lead.id, 'AI_LEAD_NEED_UPDATED',
    case when v_previous_need is distinct from v_need
      then 'AI updated the lead need from customer conversation evidence'
      else 'AI confirmed the existing lead need from customer conversation evidence'
    end,
    'AI',
    jsonb_build_object(
      'source_message_id', v_message.id,
      'source_text', v_source_text,
      'previous_need', v_previous_need,
      'need', v_need,
      'quote_id', v_quote.id
    )
  );

  return jsonb_build_object(
    'status', 'APPLIED',
    'need', v_need,
    'changed', v_previous_need is distinct from v_need
  );
end;
$$;

revoke all on function public.apply_ai_lead_need(uuid,bigint,uuid,text,text) from public, anon, authenticated;
grant execute on function public.apply_ai_lead_need(uuid,bigint,uuid,text,text) to service_role;

commit;