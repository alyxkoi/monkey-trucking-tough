begin;

-- Staff-triggered document delivery is not a staff-authored conversation reply.
-- Keep the same outbox and immutable operation keys; introduce no second sender.
alter table public.sms_outbox drop constraint sms_outbox_origin_check;
alter table public.sms_outbox add constraint sms_outbox_origin_check
 check(origin in ('HUMAN','AI','AUTOMATION','OPT_IN','TRANSACTIONAL'));
do $$ declare d text; begin
 select pg_get_functiondef('public.enqueue_sms(uuid,text,text,text,uuid,text,uuid,text,jsonb)'::regprocedure) into d;
 if position('p_origin not in (''HUMAN'',''AI'',''AUTOMATION'',''OPT_IN'')' in d)=0 then raise exception 'Origin patch requires audit'; end if;
 d:=replace(d,'p_origin not in (''HUMAN'',''AI'',''AUTOMATION'',''OPT_IN'')','p_origin not in (''HUMAN'',''AI'',''AUTOMATION'',''OPT_IN'',''TRANSACTIONAL'')');
 d:=replace(d,'if p_origin in (''HUMAN'',''OPT_IN'') then','if p_origin=''HUMAN'' then');
 d:=replace(d,'case when p_origin in (''AI'',''AUTOMATION'') then ''AI'' else ''HUMAN'' end',
 'case when p_origin in (''AI'',''AUTOMATION'') then ''AI'' when p_origin in (''TRANSACTIONAL'',''OPT_IN'') then ''SYSTEM'' else ''HUMAN'' end');
 d:=replace(d,'if p_origin=''OPT_IN'' and (', $patch$
 if p_origin='TRANSACTIONAL' then
   if c.sms_consent_at is null or c.sms_double_opt_in_at is null then raise exception 'Customer has not completed SMS double opt in'; end if;
   if not exists(select 1 from public.email_send_log e where e.id::text=p_guard->>'email_log_id'
     and e.customer_id=c.id and e.invoice_id::text=p_guard->>'subject_id'
     and e.template_type='INVOICE_READY' and e.status='accepted_by_provider'
     and p_operation_key='invoice-email-notice:'||e.id::text)
   and not exists(select 1 from public.activity_history h where h.id::text=p_guard->>'approved_request_id'
     and h.entity_id=l.id and h.customer_id=c.id and h.event_type='AI_ACTION_OPEN'
     and p_operation_key='approved-change:'||h.id::text
     and public.ai_change_snapshot(h.id)=p_guard->'approved_snapshot')
   then raise exception 'Verified document or approved change event required'; end if;
 end if;
 if p_origin='OPT_IN' and ($patch$);
 execute d;
 select pg_get_functiondef('public.queue_invoice_email_notification(uuid,uuid,text)'::regprocedure) into d;
 if position('''HUMAN'',p_actor_id' in d)=0 then raise exception 'Invoice origin patch requires audit'; end if;
 execute replace(d,'''HUMAN'',p_actor_id','''TRANSACTIONAL'',p_actor_id');
 -- Staff approves a saved business change, but does not author a chat reply.
 -- Keep any existing pause and recheck the approved snapshot at dispatch.
 if to_regprocedure('public.decide_ai_staff_action(uuid,text,text,jsonb)') is not null then
  select pg_get_functiondef('public.decide_ai_staff_action(uuid,text,text,jsonb)'::regprocedure) into d;
  execute replace(d,'''HUMAN'',auth.uid()','''TRANSACTIONAL'',auth.uid()');
 end if;
 select pg_get_functiondef('public.authorize_sms_dispatch(uuid,uuid)'::regprocedure) into d;
 d:=replace(d,'when o.origin in (''AI'',''AUTOMATION'') and (c.sms_consent_at is null',
 'when o.origin in (''AI'',''AUTOMATION'',''TRANSACTIONAL'') and (c.sms_consent_at is null');
 if position('o.conversation_revision<>l.conversation_revision' in d)=0 then raise exception 'Dispatch revision patch requires audit'; end if;
 d:=replace(d,'o.conversation_revision<>l.conversation_revision',
 '(m.automation_rule_id is distinct from ''review-request'' and o.conversation_revision<>l.conversation_revision)');
 execute d;

 -- Store immediately, make the durable job claimable after a brief quiet period.
 -- A new inbound still cancels older jobs and invalidates their revision.
 select pg_get_functiondef('public.record_customer_inbound_sms(text,text,text,text,timestamptz)'::regprocedure) into d;
 if position('due_delay:=case when first_reply then greatest(coalesce(target_seconds,0),0) else 0 end;' in d)=0 then raise exception 'Burst patch requires audit'; end if;
 d:=replace(d,'due_delay:=case when first_reply then greatest(coalesce(target_seconds,0),0) else 0 end;',
 'due_delay:=case when first_reply then greatest(coalesce(target_seconds,0),3) else 3 end;');
 -- Reviews are driven by completed/paid business records, not SMS turn count.
 -- STOP still cancels everything; dispatch still checks takeover and consent.
 d:=replace(d,'where lead_id=l.id and state in (''QUEUED'',''WORKING'')',
 'where lead_id=l.id and (rule_id is distinct from ''review-request'' or keyword=''STOP'') and state in (''QUEUED'',''WORKING'')');
 d:=replace(d,'(o.origin in (''AI'',''AUTOMATION'') or keyword=''STOP'')',
 '((o.origin in (''AI'',''AUTOMATION'') and lm.automation_rule_id is distinct from ''review-request'') or keyword=''STOP'')');
 execute d;

 -- SQL NULL comparison was allowing non-review delivery receipts to mark a
 -- review sent. A receipt must positively identify the review automation.
 select pg_get_functiondef('public.audit_review_request_delivery()'::regprocedure) into d;
 execute replace(d,'new.automation_rule_id<>''review-request''','new.automation_rule_id is distinct from ''review-request''');
end $$;

-- Correct false audit labels without deleting history or modifying sent payloads.
update public.activity_history a set event_type='REVIEW_REQUEST_AUDIT_CORRECTED',
 summary='Corrected historical review label: delivered message was not a review request',
 metadata=a.metadata||jsonb_build_object('previous_event_type','REVIEW_REQUEST_SENT','correction_reason','Non-review receipt matched a nullable rule check')
where a.event_type='REVIEW_REQUEST_SENT' and exists(select 1 from public.lead_messages m
 where m.id::text=a.metadata->>'message_id' and m.automation_rule_id is distinct from 'review-request');
commit;