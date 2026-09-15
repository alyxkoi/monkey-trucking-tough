// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, 'utf8')
const base = read('20260826233501_36b91b63-9c99-426a-9ad4-fd55280d9c6b')
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
let db: PGlite
// PostgreSQL fixture rows contain heterogeneous JSON and scalar result shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = async (sql: string, args: unknown[] = []) => (await db.query<Record<string, any>>(sql, args)).rows
const rpc = async (name: string, args: unknown[] = []) => (await query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args))[0].result
async function customer(phone = '+12143568256', consent = true) {
  const [c] = await query("insert into customers(name,phone,normalized_phone,sms_consent_at) values('Fixture',$1,$2,case when $3 then now()-interval '2 days' end) returning id", [phone, phone.slice(-10), consent])
  const [l] = await query("insert into leads(customer_id,source,need) values($1,'Website','Test request') returning id", [c.id])
  return { customerId: c.id, leadId: l.id }
}
const enqueue = (lead: string, key: string, text = 'hello', origin = 'HUMAN', trigger: string | null = null) =>
  rpc('enqueue_sms', [lead, text, key, origin, actor, 'approved-template', trigger])

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create schema vault; create table vault.decrypted_secrets(name text,decrypted_secret text);
    create table tickets(id uuid primary key);
    create table user_roles(user_id uuid,role text);
    create function is_admin_or_staff() returns boolean language sql as 'select true';`)
  for (const table of ['customers', 'leads', 'quotes', 'jobs', 'invoices', 'payments', 'activity_history', 'control_center_settings', 'automation_rules', 'lead_messages']) {
    const ddl = base.match(new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
    if (!ddl) throw new Error(`Missing fixture DDL: ${table}`)
    await db.exec(ddl)
  }
  await db.exec(`alter table customers add sms_consent_at timestamptz,add sms_consent_source text,add sms_opted_out_at timestamptz;
    create table contact_submissions(id uuid primary key,customer_id uuid,lead_id uuid,phone text,project_type text,message text,sms_consent boolean,sms_consent_at timestamptz,submitted_at timestamptz,consent_source text);
    insert into control_center_settings(id) values(1);
    insert into user_roles values('${actor}','admin');`)
  await db.exec(base.match(/insert into public\.automation_rules[\s\S]*?on conflict \(id\) do nothing;/)![0])
  for (const file of ['20260913090000_sent_dm_sms_transport', '20260913170000_durable_sms_pipeline', '20260913171000_sms_consent_and_inbox', '20260913172000_communication_worker', '20260913180000_worker_vault_auth']) await db.exec(read(file))
  await db.exec("update control_center_settings set sms_status='TESTING'")
  await db.exec(read('20260914154000_failed_consent_retry'))
  await db.exec(read('20260914190000_initial_response_and_reschedule_intake'))
  await db.exec(read('20260914223000_immediate_sms_processing'))
  await db.exec(read('20260915021000_transactional_followup_alignment'))
}, 30_000)
afterAll(async () => { await db?.close() })

describe.sequential('executed PostgreSQL SMS transactions', () => {
  it('verifies a private Vault credential by digest without exposing it to callers', async () => {
    expect(await rpc('verify_communications_worker', ['0'.repeat(64)])).toBe(false)
    await db.exec("insert into vault.decrypted_secrets values('communications_worker_secret','fixture-only-token')")
    expect((await query("select verify_communications_worker(encode(sha256(convert_to('fixture-only-token','UTF8')),'hex')) as valid"))[0].valid).toBe(true)
    expect(await rpc('verify_communications_worker', ['0'.repeat(64)])).toBe(false)
    expect(await rpc('verify_communications_worker', [null])).toBe(false)
    expect((await query("select has_function_privilege('authenticated','public.verify_communications_worker(text)','EXECUTE') as allowed"))[0].allowed).toBe(false)
  })
  it('adds settings with all live automation gates closed', async () => {
    const [r] = await query('select * from communication_runtime')
    expect(r.ai_sending_enabled).toBe(false)
    expect(r.scheduled_sending_enabled).toBe(false)
    expect(r.marketing_approved).toBe(false)
    expect((await query('select ai_english,ai_spanish,initial_response_target_seconds from control_center_settings'))[0]).toMatchObject({ ai_english: true, ai_spanish: true, initial_response_target_seconds: 0 })
  })

  it('records website requests in the conversation and schedules the compliant first response once', async () => {
    const c = await customer('+12145550031')
    const submissionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await db.exec("update communication_runtime set ai_sending_enabled=true,test_numbers=array['+12145550031']")
    await query("insert into contact_submissions(id,customer_id,lead_id,phone,project_type,message,sms_consent,sms_consent_at,submitted_at,consent_source) values($1,$2,$3,'2145550031','material-delivery','Need gravel',true,now(),now(),'website_contact_form')", [submissionId, c.customerId, c.leadId])
    expect(await rpc('schedule_website_contact_response', [submissionId, 'approved-template'])).toMatchObject({ scheduled: true, kind: 'OPT_IN' })
    expect(await rpc('schedule_website_contact_response', [submissionId, 'approved-template'])).toMatchObject({ scheduled: true, kind: 'OPT_IN' })
    expect((await query("select count(*)::int n from lead_messages where lead_id=$1 and sender_type='CUSTOMER' and message_kind='INBOUND'", [c.leadId]))[0].n).toBe(1)
    expect((await query("select count(*)::int n from sms_outbox where origin='OPT_IN'", []))[0].n).toBe(1)
    expect((await query("select sender_type from lead_messages where idempotency_key=$1", [`website-opt-in:${submissionId}`]))[0].sender_type).toBe('SYSTEM')
    await db.exec('update communication_runtime set ai_sending_enabled=false')
  })

  it('queues an already opted-in website lead and a first direct text immediately', async () => {
    const website = await customer('+12145550032')
    const submissionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    await query('update customers set sms_double_opt_in_at=now() where id=$1', [website.customerId])
    await db.exec("update communication_runtime set ai_sending_enabled=true,test_numbers=array['+12145550032','+12145550030']")
    await query("insert into contact_submissions(id,customer_id,lead_id,phone,project_type,message,sms_consent,sms_consent_at,submitted_at,consent_source) values($1,$2,$3,'2145550032','driveway','Need an estimate',true,now(),now(),'website_contact_form')", [submissionId, website.customerId, website.leadId])
    expect(await rpc('schedule_website_contact_response', [submissionId, 'approved-template'])).toMatchObject({ scheduled: true, kind: 'AI_REPLY' })
    expect((await query("select (due_at <= now()+interval '2 seconds') as due,context->>'initial_response' as initial from communication_jobs where lead_id=$1", [website.leadId]))[0]).toEqual({ due: true, initial: 'true' })

    const direct = await customer('+12145550030')
    await query('update customers set sms_double_opt_in_at=now() where id=$1', [direct.customerId])
    await rpc('record_inbound_sms', ['first-direct', '+12145550030', 'Can you help me?'])
    expect((await query("select (due_at <= now()+interval '2 seconds') as due,context->>'initial_response' as initial from communication_jobs where lead_id=$1", [direct.leadId]))[0]).toEqual({ due: true, initial: 'true' })
    await query("update communication_jobs set state='CANCELLED' where lead_id in ($1,$2)", [website.leadId, direct.leadId])
    await db.exec('update communication_runtime set ai_sending_enabled=false')
  })

  it('lets an immediate trigger claim only its own durable communication job', async () => {
    const first = await customer('+12145550033')
    const second = await customer('+12145550034')
    await query('update customers set sms_double_opt_in_at=now() where id in ($1,$2)', [first.customerId, second.customerId])
    await db.exec("update communication_runtime set ai_sending_enabled=true,test_numbers=array['+12145550033','+12145550034']")
    const firstResult = await rpc('record_inbound_sms', ['targeted-first', '+12145550033', 'Need gravel'])
    const secondResult = await rpc('record_inbound_sms', ['targeted-second', '+12145550034', 'Need sand'])
    const claimed = await rpc('claim_communication_job_by_id', [secondResult.job_id])
    expect(claimed.id).toBe(secondResult.job_id)
    expect((await query('select state from communication_jobs where id=$1', [firstResult.job_id]))[0].state).toBe('QUEUED')
    expect(await rpc('claim_communication_job_by_id', [secondResult.job_id])).toBeNull()
    await query("update communication_jobs set state='CANCELLED' where id in ($1,$2)", [firstResult.job_id, secondResult.job_id])
    await db.exec('update communication_runtime set ai_sending_enabled=false')
  })

  it('restricts TESTING to the allowlist and denies opt-out', async () => {
    const c = await customer('+12145550001')
    await expect(enqueue(c.leadId, 'not-allowlisted')).rejects.toThrow('approved test numbers')
    await db.exec("update control_center_settings set sms_status='READY'")
    await query('update customers set sms_opted_out_at=now() where id=$1', [c.customerId])
    await expect(enqueue(c.leadId, 'optedout')).rejects.toThrow('opted out')
  })

  it('uses one permanent operation and rejects payload mutation', async () => {
    const c = await customer('+12145550002')
    const m = await enqueue(c.leadId, 'same-operation')
    expect((await enqueue(c.leadId, 'same-operation')).id).toBe(m.id)
    await expect(enqueue(c.leadId, 'same-operation', 'different')).rejects.toThrow('different content')
    await expect(query("update sms_outbox set payload='{}' where message_id=$1", [m.id])).rejects.toThrow('immutable')
    const [l] = await query('select human_takeover from leads where id=$1', [c.leadId])
    expect(l.human_takeover).toBe(true)
  })

  it('allows only one active lease, reconciles a status arriving before acceptance, and never downgrades delivery', async () => {
    const c = await customer('+12145550003')
    const m = await enqueue(c.leadId, 'early-event')
    const claim = await rpc('claim_sms', [m.id])
    expect(await rpc('claim_sms', [m.id])).toBeNull()
    await rpc('authorize_sms_dispatch', [m.id, claim.lease_token])
    expect(await rpc('ingest_sms_event', ['provider-early', 'message.delivered', 'DELIVERED', false, '+12145550003'])).toMatchObject({ unmatched: true })
    expect(await rpc('complete_sms_dispatch', [m.id, claim.lease_token, 'provider-early', 'QUEUED'])).toMatchObject({ delivery_status: 'DELIVERED' })
    await rpc('apply_sms_delivery_status', ['provider-early', 'SENT'])
    await rpc('apply_sms_delivery_status', ['provider-early', 'FAILED'])
    expect((await query('select delivery_status from lead_messages where id=$1', [m.id]))[0].delivery_status).toBe('DELIVERED')
    expect((await query("select processing_status from sms_webhook_events where provider_message_id='provider-early'"))[0].processing_status).toBe('PROCESSED')
  })

  it('rechecks STOP between claim and dispatch and captures unknown numbers once', async () => {
    const c = await customer('+12145550004')
    const m = await enqueue(c.leadId, 'stop-race')
    const claim = await rpc('claim_sms', [m.id])
    const first = await rpc('record_inbound_sms', ['stop-1', '+12145550004', 'STOP', 'STOP'])
    expect((await rpc('record_inbound_sms', ['stop-1', '+12145550004', 'STOP', 'STOP'])).inserted).toBe(false)
    expect(await rpc('authorize_sms_dispatch', [m.id, claim.lease_token])).toBeNull()
    expect(first.customer_id).toBe(c.customerId)
    const unknown = await rpc('record_inbound_sms', ['unknown-1', '+12145550009', 'Do you deliver gravel?'])
    expect(unknown.inserted).toBe(true)
    expect((await query('select sms_double_opt_in_at from customers where id=$1', [unknown.customer_id]))[0].sms_double_opt_in_at).toBeNull()
  })

  it('does not let an old START override a newer STOP, and HELP changes no consent', async () => {
    await customer('+12145550005')
    await rpc('record_inbound_sms', ['stop-ordered', '+12145550005', 'STOP', 'STOP', new Date().toISOString()])
    await rpc('record_inbound_sms', ['start-old', '+12145550005', 'START', 'START', new Date(Date.now() - 3600000).toISOString()])
    await rpc('record_inbound_sms', ['help-1', '+12145550005', 'HELP', 'HELP'])
    const [c] = await query("select sms_opted_out_at,sms_double_opt_in_at from customers where phone='+12145550005'")
    expect(c.sms_opted_out_at).not.toBeNull()
    expect(c.sms_double_opt_in_at).toBeNull()
  })

  it('requires a real pending opt-in request before YES counts', async () => {
    const c = await customer('+12145550006')
    await rpc('record_inbound_sms', ['yes-generic', '+12145550006', 'yes'])
    expect((await query('select sms_double_opt_in_at from customers where id=$1', [c.customerId]))[0].sms_double_opt_in_at).toBeNull()
    const m = await enqueue(c.leadId, 'opt-in-request', 'Please reply YES to confirm service texts', 'OPT_IN')
    const claim = await rpc('claim_sms', [m.id])
    await rpc('authorize_sms_dispatch', [m.id, claim.lease_token])
    await rpc('complete_sms_dispatch', [m.id, claim.lease_token, 'opt-in-provider', 'SENT'])
    expect(await rpc('record_inbound_sms', ['yes-confirmed', '+12145550006', 'YES'])).toMatchObject({ consent_confirmed: true })
  })

  it('quarantines ambiguous submissions outside the provider idempotency window', async () => {
    const c = await customer('+12145550007')
    const m = await enqueue(c.leadId, 'stale-ambiguous')
    await query("update sms_outbox set state='DISPATCHING',first_attempt_at=now()-interval '25 hours',lease_until=now()-interval '1 minute' where message_id=$1", [m.id])
    expect(await rpc('claim_sms', [m.id])).toBeNull()
    expect((await query('select state from sms_outbox where message_id=$1', [m.id]))[0].state).toBe('REVIEW')
  })

  it.each(['FAILED', 'FILTERED', 'BLOCKED'])('allows a new consent request after confirmed %s delivery, but blocks pending duplicates', async (status) => {
    const phone = `+1214555002${['FAILED', 'FILTERED', 'BLOCKED'].indexOf(status)}`
    const c = await customer(phone)
    const first = await enqueue(c.leadId, `consent-first-${status}`, 'Please reply YES', 'OPT_IN')
    const claim = await rpc('claim_sms', [first.id])
    await rpc('authorize_sms_dispatch', [first.id, claim.lease_token])
    const providerId = `consent-provider-${status}`
    await rpc('complete_sms_dispatch', [first.id, claim.lease_token, providerId, 'SENT'])
    await expect(enqueue(c.leadId, `consent-pending-${status}`, 'Please reply YES', 'OPT_IN')).rejects.toThrow('already pending')
    await rpc('apply_sms_delivery_status', [providerId, status])
    const replacement = await enqueue(c.leadId, `consent-replacement-${status}`, 'Please reply YES', 'OPT_IN')
    expect(replacement.id).not.toBe(first.id)
    expect((await query('select state from sms_outbox where message_id=$1', [first.id]))[0].state).toBe('ACCEPTED')
    expect((await query('select delivery_status from lead_messages where id=$1', [first.id]))[0].delivery_status).toBe(status)
    await expect(enqueue(c.leadId, `consent-duplicate-${status}`, 'Please reply YES', 'OPT_IN')).rejects.toThrow('already pending')
    expect((await query('select sms_double_opt_in_at from customers where id=$1', [c.customerId]))[0].sms_double_opt_in_at).toBeNull()
  })

  it('denies browser RPC execution and table writes', async () => {
    const [access] = await query("select has_function_privilege('authenticated','enqueue_sms(uuid,text,text,text,uuid,text,uuid,text,jsonb)','execute') as execute,has_function_privilege('authenticated','claim_communication_job_by_id(uuid)','execute') as targeted_claim,has_table_privilege('authenticated','sms_outbox','insert') as insert")
    expect(access).toEqual({ execute: false, targeted_claim: false, insert: false })
  })

  it('cancels AI work when staff replies while a draft is being generated', async () => {
    const c=await customer('+12145550010')
    await query('update customers set sms_double_opt_in_at=now() where id=$1',[c.customerId])
    await db.exec('update communication_runtime set ai_sending_enabled=true')
    await rpc('record_inbound_sms',['ai-input-1','+12145550010','I need gravel delivered'])
    await db.exec("update communication_jobs set due_at=now() where state='QUEUED'")
    const job=await rpc('claim_communication_job')
    expect(await rpc('communication_job_eligible',[job.id,job.lease_token])).toBe(true)
    await enqueue(c.leadId,'staff-interruption','i can help with that')
    expect(await rpc('finish_communication_job',[job.id,job.lease_token,'what is the address','approved-template'])).toBeNull()
    expect((await query("select count(*)::int n from lead_messages where lead_id=$1 and sender_type='AI'",[c.leadId]))[0].n).toBe(0)
    await rpc('resume_conversation_ai',[c.leadId,actor])
    expect((await query("select count(*)::int n from communication_jobs where lead_id=$1 and state='QUEUED'",[c.leadId]))[0].n).toBe(0)
    await db.exec('update communication_runtime set ai_sending_enabled=false')
  })

  it('adds business hours across a weekend and the daylight-saving transition', async () => {
    const result=await rpc('sms_business_time',['2026-10-30T16:00:00-05:00',4])
    expect(new Date(result).toISOString()).toBe('2026-11-02T18:00:00.000Z')
  })

  it('does not create a historical catch-up campaign', async () => {
    await db.exec("update communication_runtime set scheduled_sending_enabled=true,activated_at=now();")
    await db.exec("update automation_rules set status='ON' where id='new-lead'")
    expect(await query('select * from communication_candidates()')).toEqual([])
    expect(await rpc('plan_communication_jobs')).toBe(0)
    await db.exec('update communication_runtime set scheduled_sending_enabled=false')
  })

  it('reserves one AI reply, then cancels it if a newer customer message arrives',async()=>{
    const c=await customer('+12145550011')
    await query('update customers set sms_double_opt_in_at=now() where id=$1',[c.customerId])
    await db.exec('update communication_runtime set ai_sending_enabled=true')
    await rpc('record_inbound_sms',['ai-input-2','+12145550011','I need gravel delivered'])
    await db.exec("update communication_jobs set due_at=now() where state='QUEUED'")
    const job=await rpc('claim_communication_job')
    const message=await rpc('finish_communication_job',[job.id,job.lease_token,'what is the address','approved-template'])
    expect(message.sender_type).toBe('AI')
    expect(await rpc('finish_communication_job',[job.id,job.lease_token,'what is the address','approved-template'])).toBeNull()
    await rpc('record_inbound_sms',['ai-input-3','+12145550011','Actually can I talk to a person?'])
    expect((await query('select state from sms_outbox where message_id=$1',[message.id]))[0].state).toBe('CANCELLED')
    await db.exec('update communication_runtime set ai_sending_enabled=false')
  })

  it('selects due follow-ups once and rechecks quote changes',async()=>{
    await db.exec('begin')
    try {
      const c=await customer('+12145550012')
      await db.exec("update communication_runtime set scheduled_sending_enabled=true,activated_at='2026-09-01T00:00:00Z'; update automation_rules set status='ON'")
      await query("update customers set sms_double_opt_in_at='2026-09-01T00:00:00Z' where id=$1",[c.customerId])
      await query("update leads set created_at='2026-09-14T09:00:00-05:00' where id=$1",[c.leadId])
      const due=await query("select * from communication_candidates('2026-09-14T13:05:00-05:00') where lead_id=$1",[c.leadId])
      expect(due).toHaveLength(1)
      expect(due[0]).toMatchObject({rule_id:'new-lead',step:1})
      const [q]=await query("insert into quotes(quote_number,customer_id,lead_id,status,sent_at) values('FIX-Q1',$1,$2,'SENT','2026-09-14T10:00:00-05:00') returning *",[c.customerId,c.leadId])
      const guard={subject_id:q.id,anchor:q.sent_at,version:q.updated_at,step:0}
      expect(await rpc('sms_automation_guard',['quote-follow-up',c.leadId,guard,'2026-09-15T09:05:00-05:00'])).toBe(true)
      await query("update quotes set status='ACCEPTED' where id=$1",[q.id])
      expect(await rpc('sms_automation_guard',['quote-follow-up',c.leadId,guard,'2026-09-15T09:05:00-05:00'])).toBe(false)
    } finally {await db.exec('rollback')}
  })

  it('never duplicates the immediate reply and stops lead follow-ups after a real customer response',async()=>{
    await db.exec('begin')
    try {
      const c=await customer('+12145550014')
      await db.exec("update communication_runtime set scheduled_sending_enabled=true,activated_at='2026-09-01T00:00:00Z'; update automation_rules set status='ON' where id='new-lead'")
      await query("update customers set sms_double_opt_in_at='2026-09-01T00:00:00Z' where id=$1",[c.customerId])
      await query("update leads set created_at='2026-09-14T09:00:00-05:00' where id=$1",[c.leadId])
      await query("insert into lead_messages(lead_id,customer_id,sender_type,body,delivery_status,message_kind,created_at) values($1,$2,'CUSTOMER','Need gravel','RECEIVED','INBOUND','2026-09-14T09:00:00-05:00')",[c.leadId,c.customerId])
      expect(await query("select * from communication_candidates('2026-09-14T09:05:00-05:00') where lead_id=$1",[c.leadId])).toEqual([])
      const [candidate]=await query("select * from communication_candidates('2026-09-14T13:05:00-05:00') where lead_id=$1",[c.leadId])
      expect(candidate).toMatchObject({rule_id:'new-lead',step:1})
      await query("insert into lead_messages(lead_id,customer_id,sender_type,body,delivery_status,message_kind,created_at) values($1,$2,'CUSTOMER','10 yards','RECEIVED','INBOUND','2026-09-14T09:10:00-05:00')",[c.leadId,c.customerId])
      expect(await rpc('sms_automation_guard',['new-lead',c.leadId,candidate.guard,'2026-09-14T13:05:00-05:00'])).toBe(false)
    } finally {await db.exec('rollback')}
  })

  it('blocks a rescheduled job and an invoice with a payment claim',async()=>{
    await db.exec('begin')
    try {
      const c=await customer('+12145550013')
      await db.exec("update communication_runtime set scheduled_sending_enabled=true,activated_at='2026-09-01T00:00:00Z'; update automation_rules set status='ON'")
      await query('update customers set sms_double_opt_in_at=now() where id=$1',[c.customerId])
      const [j]=await query("insert into jobs(customer_id,category,scheduled_date,scheduled_time,address,description,created_at) values($1,'DRIVEWAY','2026-09-16','10:00','Fixture address','Fixture job','2026-09-12T10:00:00Z') returning *",[c.customerId])
      const guard={subject_id:j.id,anchor:'2026-09-16T10:00:00-05:00',version:j.updated_at,step:0}
      expect(await rpc('sms_automation_guard',['job-reminder',c.leadId,guard,'2026-09-15T10:05:00-05:00'])).toBe(true)
      await query("update jobs set scheduled_time='11:00' where id=$1",[j.id])
      expect(await rpc('sms_automation_guard',['job-reminder',c.leadId,guard,'2026-09-15T10:05:00-05:00'])).toBe(false)
      const [i]=await query("insert into invoices(invoice_number,customer_id,job_id,amount_source,description,amount,status,due_at) values('FIX-I1',$1,$2,'JOB','Fixture',100,'SENT','2026-09-16T10:00:00Z') returning *",[c.customerId,j.id])
      const invoiceGuard={subject_id:i.id,anchor:i.due_at,version:i.updated_at,step:0}
      expect(await rpc('sms_automation_guard',['invoice-follow-up',c.leadId,invoiceGuard])).toBe(true)
      await query('update invoices set payment_claimed_at=now() where id=$1',[i.id])
      expect(await rpc('sms_automation_guard',['invoice-follow-up',c.leadId,invoiceGuard])).toBe(false)
    } finally {await db.exec('rollback')}
  })
})
