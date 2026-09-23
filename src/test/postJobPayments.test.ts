// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCommunicationJob } from '../../supabase/functions/_shared/communication-worker'
import { dispatchSms } from '../../supabase/functions/_shared/sms-dispatch'

const read = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, 'utf8')
const base = read('20260826233501_36b91b63-9c99-426a-9ad4-fd55280d9c6b')
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
let db: PGlite
// PostgreSQL fixture rows contain heterogeneous JSON and scalar result shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = async (sql: string, args: unknown[] = []) => (await db.query<Record<string, any>>(sql, args)).rows
const rpc = async (name: string, args: unknown[] = []) => (await query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args))[0].result
// Exercise the real worker/transport against PostgreSQL; only the carrier is stubbed.
const workerService = {
  async rpc(name: string, args: Record<string, unknown> = {}) {
    try { return { data: (await query(`select public.${name}(${Object.keys(args).map((key,i)=>`${key} => $${i+1}`).join(',')}) result`,Object.values(args)))[0].result,error:null } }
    catch (error) { return {data:null,error} }
  },
  from(table: string) {
    let columns='*',order='',limit='',single=false
    const values:unknown[]=[],where:string[]=[]
    const chain = {
      select(value:string) {columns=value;return chain},
      eq(key:string,value:unknown) {values.push(value);where.push(`${key}=$${values.length}`);return chain},
      order(key:string,options:{ascending:boolean}) {order=` order by ${key} ${options.ascending?'asc':'desc'}`;return chain},
      limit(n:number) {limit=` limit ${n}`;return chain},
      single() {single=true;return chain},
      then(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown) {
        return query(`select ${columns} from ${table}${where.length?' where '+where.join(' and '):''}${order}${limit}`,values)
          .then(rows=>resolve({data:single?rows[0]:rows,error:single&&!rows.length?'Missing row':null}),reject)
      },
    }
    return chain
  },
}
async function customer(phone = '+12143568256', consent = true) {
  const [c] = await query("insert into customers(name,phone,normalized_phone,sms_consent_at) values('Fixture',$1,$2,case when $3 then now()-interval '2 days' end) returning id", [phone, phone.slice(-10), consent])
  const [l] = await query("insert into leads(customer_id,source,need) values($1,'Website','Test request') returning id", [c.id])
  return { customerId: c.id, leadId: l.id }
}


beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function auth.role() returns text language sql as 'select ''service_role''::text';
    create schema vault; create table vault.decrypted_secrets(name text,decrypted_secret text);
    create table tickets(id uuid primary key);
    create table materials(id uuid primary key default gen_random_uuid(),name text,price_per_yard numeric,sort_order integer,updated_at timestamptz default now());
    create table app_settings(id integer);
    create table user_roles(user_id uuid,role text);
    create function is_admin_or_staff() returns boolean language sql as 'select true';`)
  for (const table of ['customers', 'leads', 'quotes', 'quote_items', 'jobs', 'invoices', 'payments', 'activity_history', 'control_center_settings', 'automation_rules', 'lead_messages']) {
    const ddl = base.match(new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
    if (!ddl) throw new Error(`Missing fixture DDL: ${table}`)
    await db.exec(ddl)
  }
  await db.exec(`alter table customers add sms_consent_at timestamptz,add sms_consent_source text,add sms_opted_out_at timestamptz;
    create table email_send_log(id uuid primary key default gen_random_uuid(),template_type text,recipient_email text,customer_id uuid references customers(id),invoice_id uuid references invoices(id),status text,created_at timestamptz default now());
    create table contact_submissions(id uuid primary key,customer_id uuid,lead_id uuid,phone text,project_type text,message text,sms_consent boolean,sms_consent_at timestamptz,submitted_at timestamptz,consent_source text);
    insert into control_center_settings(id) values(1);
    insert into user_roles values('${actor}','admin');`)
  await db.exec(base.match(/insert into public\.automation_rules[\s\S]*?on conflict \(id\) do nothing;/)![0])
  for (const file of ['20260913090000_sent_dm_sms_transport', '20260913170000_durable_sms_pipeline', '20260913171000_sms_consent_and_inbox', '20260913172000_communication_worker', '20260913180000_worker_vault_auth']) await db.exec(read(file))
  await db.exec("update control_center_settings set sms_status='TESTING'")
  await db.exec(read('20260914154000_failed_consent_retry'))
  await db.exec(read('20260914190000_initial_response_and_reschedule_intake'))
  await db.exec(read('20260914223000_immediate_sms_processing'))
  await db.exec(read('20260915010000_ai_material_and_route_intelligence'))
  await db.exec(read('20260915021000_transactional_followup_alignment'))
  await db.exec(read('20260915030000_fast_message_reconciliation'))
  await db.exec(`create table ai_audit_logs(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),status text);`)
  await db.exec(read('20260915120000_ai_control_audit'))
  await db.exec(read('20260915193000_followup_completion'))
  await db.exec(read('20260915201500_outbound_receipt_reconciliation'))
  await db.exec(read('20260915220000_ai_lifecycle_actions'))
  await db.exec(read('20260916120000_approved_change_confirmations'))
  await db.exec(read('20260918210000_post_job_communications'))
  await db.exec(read('20260918223000_immediate_review_request'))
  await db.exec(base.match(/create table if not exists public\.financial_history \([\s\S]*?\n\);/)![0])
  await db.exec(`create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';
    alter table invoices add subtotal_amount numeric,add processing_fee_rate numeric,add processing_fee_amount numeric;
    alter table payments add payment_source text default 'MANUAL';
    create table stripe_checkout_sessions(id uuid primary key default gen_random_uuid(),invoice_id uuid,status text,expires_at timestamptz);`)
  for(const file of ['20260921100000_manual_payment_fees','20260921101000_post_job_review_events','20260921102000_staff_sms_notifications','20260921103000_resolve_obsolete_quote_actions','20260921104000_historical_staff_sms_isolation','20260921105000_staff_sms_receipt_reconciliation'])await db.exec(read(file))
  await db.exec(read('20260923100000_conversation_origin_and_bursts'))
  await db.exec(read('20260923101000_staff_alert_preferences_and_links'))
  await db.exec(read('20260923103000_communication_failure_actions'))
  await db.exec(read('20260923110000_staff_template_layout'))
}, 30_000)
afterAll(async () => { await db?.close() })

describe('provider-safe staff template layout',()=>{
 it('keeps all detail lines and strips forbidden whitespace inside variables',async()=>{
   expect(await rpc('staff_sms_template_parameters',['QUOTE READY\nTyrone\n20 yd Flexbase\n$1,042.43\n\nOpen: monkeytrucking.llc/a/1234567890'])).toEqual({event:'QUOTE READY',customer:'Tyrone',detail:'20 yd Flexbase · $1,042.43',link:'monkeytrucking.llc/a/1234567890'})
 })
 it('uses immutable approved layout payload and keeps fallback parameters valid',()=>transaction(async()=>{
   await db.exec("update control_center_settings set sms_status='READY'")
   const first=await rpc('queue_staff_sms_test',[crypto.randomUUID()])
   const claim=await rpc('claim_staff_sms',[first])
   const fallback=await rpc('authorize_staff_sms_dispatch',[first,claim.lease_token,'legacy'])
   expect(fallback.payload.template.parameters.message).not.toMatch(/[\n\r\t]| {5}/)
   await db.exec("update staff_sms_settings set staff_template_ready=true,staff_template_id='staff-layout'")
   const id=await rpc('queue_staff_sms_test',[crypto.randomUUID()]),lease=await rpc('claim_staff_sms',[id])
   const approved=await rpc('authorize_staff_sms_dispatch',[id,lease.lease_token,'legacy'])
   expect(approved.payload.template).toEqual({id:'staff-layout',parameters:{event:'TEST ALERT',customer:'Salvador',detail:'Staff SMS alerts are connected.',link:'monkeytrucking.llc/admin'}})
   await expect(query("update staff_sms_outbox set payload='{}' where message_id=$1",[id])).rejects.toThrow(/immutable/)
 }))
})

async function transaction(work:()=>Promise<void>) {await db.exec('begin');try{await work()}finally{await db.exec('rollback')}}
async function order(completed=true) {
 const c=await customer('+12145550123')
 await db.exec("update communication_runtime set scheduled_sending_enabled=true,activated_at=now()-interval '10 days'; update control_center_settings set sms_status='READY',review_url='https://g.page/r/CZlyc3Gsu8I8EAI/review'; update automation_rules set status='OFF'; update automation_rules set status='ON',enabled_at=now()-interval '10 days' where id='review-request'")
 await query('update customers set sms_double_opt_in_at=now() where id=$1',[c.customerId])
 const [j]=await query("insert into jobs(customer_id,category,description,address,status,completed_at,scheduled_date) values($1,'MATERIAL_DELIVERY','Material delivery','123 Fixture Rd',$2,case when $3 then now() end,current_date) returning *",[c.customerId,completed?'COMPLETED':'SCHEDULED',completed])
 const [i]=await query("insert into invoices(invoice_number,customer_id,job_id,amount_source,description,amount,subtotal_amount,processing_fee_amount,status) values('P-'||gen_random_uuid(),$1,$2,'JOB','Materials',103,100,3,'SENT') returning *",[c.customerId,j.id])
 return {...c,j,i}
}
const pay=(invoiceId:string,amount:number,fee=0,expected=103,key=crypto.randomUUID())=>rpc('record_manual_invoice_payment',[invoiceId,'ZELLE',new Date(Date.now()-86400000).toISOString(),'Fixture only',amount,fee,key,expected])

describe.sequential('manual accounting and post-job integration',()=>{
 it('ordinary inbound cannot cancel a paid-job review, but STOP still can',()=>transaction(async()=>{
   const a=await order();await pay(a.i.id,100)
   const [job]=await query("select * from communication_jobs where lead_id=$1 and rule_id='review-request'",[a.leadId])
   await rpc('record_inbound_sms',['review-thanks-1','+12145550123','thanks'])
   expect((await query('select state from communication_jobs where id=$1',[job.id]))[0].state).toBe('QUEUED')
   const result=await runCommunicationJob(workerService,{apiKey:'unused',baseUrl:'unused',model:'unused'},'approved-fixture',job.id)
   expect(result.reserved).toBe(true)
   await rpc('record_inbound_sms',['review-thanks-2','+12145550123','thank you'])
   let calls=0
   const carrier=async()=>{calls++;return new Response(JSON.stringify({data:{recipients:[{message_id:'thanks-review',status:'DELIVERED'}]}}),{status:202})}
   expect(await dispatchSms(workerService,{apiKey:'fixture'},result.messageId!,carrier)).toMatchObject({accepted:true})
   expect(calls).toBe(1)
   await rpc('record_inbound_sms',['review-stop','+12145550123','STOP','STOP'])
   expect(await rpc('sms_automation_guard',['review-request',a.leadId,job.context])).toBe(false)
 }))
 it('approved business confirmation preserves both active AI and a genuine existing pause',()=>transaction(async()=>{
   const a=await order(false)
   await query("insert into lead_messages(lead_id,customer_id,sender_type,body,delivery_status,message_kind) values($1,$2,'CUSTOMER','Please update my email','RECEIVED','INBOUND')",[a.leadId,a.customerId])
   await query("update customers set email='fixture@example.com' where id=$1",[a.customerId])
   const request=await rpc('open_ai_staff_action',[a.leadId,null,'CONTACT_REVIEW',{email:'fixture@example.com'}])
   const snapshot=await rpc('preview_ai_change_approval',[request])
   const result=await rpc('decide_ai_staff_action',[request,'Contact verified','APPROVED',snapshot])
   expect((await query('select human_takeover from leads where id=$1',[a.leadId]))[0].human_takeover).toBe(false)
   expect((await query('select origin from sms_outbox where message_id=$1',[result.message_id]))[0].origin).toBe('TRANSACTIONAL')
   await query('update leads set human_takeover=true where id=$1',[a.leadId])
   const next=await rpc('open_ai_staff_action',[a.leadId,null,'CONTACT_REVIEW',{email:'fixture@example.com'}])
   await rpc('decide_ai_staff_action',[next,'Contact verified','APPROVED',await rpc('preview_ai_change_approval',[next])])
   expect((await query('select human_takeover from leads where id=$1',[a.leadId]))[0].human_takeover).toBe(true)
 }))
 it('invoice notification cannot pause AI or masquerade as a review; silent payment queues the real review',()=>transaction(async()=>{
   const a=await order()
   const [log]=await query("insert into email_send_log(customer_id,invoice_id,template_type,recipient_email,status) values($1,$2,'INVOICE_READY','fixture@example.com','accepted_by_provider') returning id",[a.customerId,a.i.id])
   const notice=await rpc('queue_invoice_email_notification',[log.id,actor,'fixture'])
   expect(notice.status).toBe('QUEUED')
   expect((await query('select human_takeover from leads where id=$1',[a.leadId]))[0].human_takeover).toBe(false)
   expect((await query('select origin from sms_outbox where message_id=$1',[notice.message_id]))[0].origin).toBe('TRANSACTIONAL')
   await query("update lead_messages set delivery_status='DELIVERED' where id=$1",[notice.message_id])
   expect(await query("select id from activity_history where event_type='REVIEW_REQUEST_SENT' and metadata->>'message_id'=$1",[notice.message_id])).toHaveLength(0)
   await pay(a.i.id,100)
   expect(await query("select id from communication_jobs where lead_id=$1 and rule_id='review-request'",[a.leadId])).toHaveLength(1)
   await rpc('enqueue_sms',[a.leadId,'Real staff reply','real-human','HUMAN',actor,'fixture'])
   expect((await query('select human_takeover from leads where id=$1',[a.leadId]))[0].human_takeover).toBe(true)
 }))
 it('stores both burst messages immediately but claims only the newest revision after 3 seconds',()=>transaction(async()=>{
   const a=await customer('+12145550888')
   await query('update customers set sms_double_opt_in_at=now() where id=$1',[a.customerId])
   await db.exec('update communication_runtime set ai_sending_enabled=true')
   const first=await rpc('record_inbound_sms',['burst-1','+12145550888','I need 20 yards of flexbase'])
   const second=await rpc('record_inbound_sms',['burst-2','+12145550888','please and thank you'])
   expect(await query("select id from lead_messages where lead_id=$1 and sender_type='CUSTOMER'",[a.leadId])).toHaveLength(2)
   expect((await query('select state from communication_jobs where id=$1',[first.job_id]))[0].state).toBe('CANCELLED')
   expect(await rpc('claim_communication_job_by_id',[second.job_id])).toBeNull()
   await query("update communication_jobs set due_at=now() where id=$1",[second.job_id])
   expect(await rpc('claim_communication_job_by_id',[second.job_id])).toMatchObject({state:'WORKING',attempts:1})
 }))
 it('removes the invoice surcharge on manual Zelle, pays correct total and queues one review',()=>transaction(async()=>{
   const a=await order(),key=crypto.randomUUID()
   const payment=await pay(a.i.id,100,0,103,key)
   expect(await pay(a.i.id,100,0,103,key)).toBe(payment)
   expect((await query('select amount,processing_fee_amount,status,review_eligible_at from invoices where id=$1',[a.i.id]))[0]).toMatchObject({amount:'100.00',processing_fee_amount:'0',status:'PAID',review_eligible_at:expect.any(Date)})
   expect((await query('select amount from payments where invoice_id=$1',[a.i.id]))).toEqual([{amount:'100'}])
   expect(await query("select * from communication_jobs where rule_id='review-request'")).toHaveLength(1)
   await query("update invoices set status='PAID' where id=$1",[a.i.id]);await query("update jobs set status='COMPLETED' where id=$1",[a.j.id]);await rpc('plan_communication_jobs')
   expect(await query("select * from communication_jobs where rule_id='review-request'")).toHaveLength(1)
   expect(await query('select * from financial_history where record_id=$1',[payment])).toHaveLength(1)
 }))
 it('handles edited fee and partial payment, stopping only at the real full balance',()=>transaction(async()=>{
   const a=await order()
   await pay(a.i.id,40,5)
   expect((await query('select amount,status,review_eligible_at from invoices where id=$1',[a.i.id]))[0]).toEqual({amount:'105.00',status:'SENT',review_eligible_at:null})
   expect(await query("select * from communication_jobs where rule_id='review-request'")).toHaveLength(0)
   await pay(a.i.id,65,5,105)
   expect((await query('select status from invoices where id=$1',[a.i.id]))[0].status).toBe('PAID')
   expect((await query('select sum(amount) paid from payments where invoice_id=$1',[a.i.id]))[0].paid).toBe('105')
   expect(await query("select * from communication_jobs where rule_id='review-request'")).toHaveLength(1)
 }))
 it('payment first waits for completion; completion then creates one durable event',()=>transaction(async()=>{
   const a=await order(false)
   await pay(a.i.id,100)
   expect(await query("select * from communication_jobs where rule_id='review-request'")).toHaveLength(0)
   await query("update jobs set status='COMPLETED',completed_at=now() where id=$1",[a.j.id])
   expect(await query("select * from communication_jobs where rule_id='review-request'")).toHaveLength(1)
 }))
 it('rejects overpayment, stale totals and active Stripe checkout without changing records',async()=>{
   const a=await order(false)
   await expect(pay(a.i.id,101)).rejects.toThrow('exceeds')
   await expect(pay(a.i.id,100,0,999)).rejects.toThrow('changed')
   await query("insert into stripe_checkout_sessions(invoice_id,status,expires_at) values($1,'OPEN',now()+interval '1 hour')",[a.i.id])
   await expect(pay(a.i.id,100)).rejects.toThrow('Stripe checkout')
   expect(await query('select * from payments where invoice_id=$1',[a.i.id])).toHaveLength(0)
 })
 it('preserves processor payment rows and locks surcharge after Stripe',async()=>{
   const a=await order(false)
   await query("insert into payments(invoice_id,customer_id,amount,method,confirmed_by,payment_source,received_at) values($1,$2,20,'STRIPE','PROCESSOR','STRIPE',now())",[a.i.id,a.customerId])
   await expect(pay(a.i.id,80)).rejects.toThrow('after a Stripe payment')
   await pay(a.i.id,83,3)
   expect((await query("select amount,method,confirmed_by from payments where invoice_id=$1 and payment_source='STRIPE'",[a.i.id]))[0]).toEqual({amount:'20',method:'STRIPE',confirmed_by:'PROCESSOR'})
 })
 it('dispatches outside business hours, with provider receipts and no duplicate review',()=>transaction(async()=>{
   const a=await order();await pay(a.i.id,100)
   await db.exec("create or replace function sms_business_time(p_at timestamptz,p_hours integer default 0) returns timestamptz language sql stable as 'select now()+interval ''3 days'''")
   const [queued]=await query("select * from communication_jobs where lead_id=$1 and rule_id='review-request'",[a.leadId])
   const result=await runCommunicationJob(workerService,{apiKey:'unused',baseUrl:'unused',model:'unused'},'approved-fixture',queued.id)
   expect(result.reserved).toBe(true)
   let calls=0
   const carrier=async()=>{calls++;return new Response(JSON.stringify({data:{recipients:[{message_id:'review-fixture',status:'DELIVERED'}]}}),{status:202})}
   expect(await dispatchSms(workerService,{apiKey:'fixture'},result.messageId!,carrier)).toMatchObject({accepted:true})
   expect(await dispatchSms(workerService,{apiKey:'fixture'},result.messageId!,carrier)).toMatchObject({dispatched:false})
   expect(calls).toBe(1)
   expect((await query('select body from lead_messages where id=$1',[result.messageId]))[0].body).toMatch(/material delivery!.*Google review.*God bless 🚚/)
 }))
 it('uses Friday 7 PM eligibility without weekend rounding or a thirty-minute loss window',()=>transaction(async()=>{
   const a=await order();await pay(a.i.id,100)
   const friday='2026-09-19T00:00:00Z'
   await query('update invoices set review_eligible_at=$2 where id=$1',[a.i.id,friday])
   await db.exec("update communication_runtime set activated_at='2026-09-01';update automation_rules set enabled_at='2026-09-01' where id='review-request'")
   const [i]=await query('select * from invoices where id=$1',[a.i.id])
   const guard={subject_id:i.id,anchor:i.paid_at,step:0}
   expect(await rpc('sms_automation_guard',['review-request',a.leadId,guard,friday])).toBe(true)
   expect(await rpc('sms_automation_guard',['review-request',a.leadId,guard,'2026-09-19T02:00:00Z'])).toBe(true)
   await query('update customers set sms_opted_out_at=now() where id=$1',[a.customerId])
   expect(await rpc('sms_automation_guard',['review-request',a.leadId,guard,friday])).toBe(false)
 }))
})

describe.sequential('internal staff notifications',()=>{
 it('short links disclose nothing anonymously and resolve only through the staff RPC',()=>transaction(async()=>{
   const c=await customer('+12145550770'),path='/admin/leads/'+c.leadId
   const url=await rpc('staff_alert_link',[path]),code=url.split('/').pop()
   expect(url).toMatch(/^monkeytrucking\.llc\/a\/[A-F0-9]{10}$/)
   expect(await rpc('staff_alert_link',[path])).toBe(url)
   expect(await rpc('resolve_staff_alert_link',[code])).toBe(path)
   expect((await query("select has_function_privilege('anon','resolve_staff_alert_link(text)','execute') allowed"))[0].allowed).toBe(false)
   expect((await query("select has_table_privilege('authenticated','staff_alert_links','select') allowed"))[0].allowed).toBe(false)
   await db.exec("create or replace function is_admin_or_staff() returns boolean language sql as 'select false'")
   await db.exec('savepoint unauthorized_link')
   await expect(rpc('resolve_staff_alert_link',[code])).rejects.toThrow('Staff access required')
   await db.exec('rollback to savepoint unauthorized_link')
 }))
 it.each(['QUOTE_READY','CUSTOM_WORK','SCHEDULE_CHANGE','ORDER_CHANGE','ADDRESS_CHANGE','PAYMENT_CLAIM','HUMAN_REQUEST','COMMUNICATION_FAILURE'])('one structured %s alert obeys its toggle at enqueue and dispatch',kind=>transaction(async()=>{
   const c=await customer('+12145550771')
   const type=kind==='PAYMENT_CLAIM'?'PAYMENT_ISSUE':kind==='HUMAN_REQUEST'?'SALVADOR_NEEDED':kind
   const [event]=await query("insert into activity_history(customer_id,entity_type,entity_id,event_type,summary,metadata) values($1,'LEAD',$2,'AI_ACTION_OPEN','Test',jsonb_build_object('kind',$3::text,'request','A customer request')) returning id",[c.customerId,c.leadId,kind])
   const [alert]=await query('select * from staff_sms_outbox where operation_key=$1',['staff-action:'+event.id])
   expect(alert.event_type).toBe(type);expect(alert.body.split('\n').length).toBeGreaterThanOrEqual(5);expect(alert.body).toContain('/a/')
   await rpc('save_staff_sms_preferences',[true,{[type]:false}])
   const claim=await rpc('claim_staff_sms',[alert.message_id]);expect(await rpc('authorize_staff_sms_dispatch',[alert.message_id,claim.lease_token,'fixture'])).toBeNull()
   expect(await rpc('queue_staff_sms',[type,event.id,'staff-action:'+event.id,alert.body])).toBe(alert.message_id)
   expect(await query('select * from staff_sms_outbox where operation_key=$1',['staff-action:'+event.id])).toHaveLength(1)
   expect(await query('select id from activity_history where id=$1',[event.id])).toHaveLength(1)
 }))
 it('terminal delivery failure opens one action/alert; confirmed recovery resolves it',()=>transaction(async()=>{
   const a=await order(false)
   const message=await rpc('enqueue_sms',[a.leadId,'Staff test','failure-test','HUMAN',actor,'fixture'])
   await query("update lead_messages set delivery_status='FAILED',send_error='Carrier rejected' where id=$1",[message.id])
   await query("update sms_outbox set state='FAILED',last_error='Carrier rejected' where message_id=$1",[message.id])
   const actions=await query("select id from activity_history where entity_id=$1 and metadata->>'kind'='COMMUNICATION_FAILURE'",[a.leadId])
   expect(actions).toHaveLength(1)
   expect(await query('select message_id from staff_sms_outbox where operation_key=$1',['staff-action:'+actions[0].id])).toHaveLength(1)
   await query("update lead_messages set delivery_status='DELIVERED',send_error=null where id=$1",[message.id])
   expect(await query("select id from activity_history where event_type='AI_ACTION_RESOLVED' and metadata->>'request_id'=$1",[actions[0].id])).toHaveLength(1)
 }))
 it('blocks customer SMS for a historical staff contact without deleting its history',async()=>{
   await db.exec('alter table customers disable trigger protect_internal_staff_contact; alter table leads disable trigger protect_internal_staff_lead')
   const c=await customer('+12146778466')
   await db.exec("alter table customers enable trigger protect_internal_staff_contact; alter table leads enable trigger protect_internal_staff_lead; update control_center_settings set sms_status='READY'")
   await expect(rpc('enqueue_sms',[c.leadId,'Customer test','historical-staff-test','HUMAN',actor,'fixture'])).rejects.toThrow('Internal staff number')
   await expect(query("insert into leads(customer_id,source,need) values($1,'SMS','Duplicate staff lead')",[c.customerId])).rejects.toThrow('Internal staff number')
   expect(await rpc('record_inbound_sms',['historical-staff-reply','+12146778466','Hello'])).toMatchObject({internal:true})
   expect(await query('select id from leads where customer_id=$1',[c.customerId])).toHaveLength(1)
   expect(await query('select id from lead_messages where lead_id=$1',[c.leadId])).toHaveLength(0)
 })
 it('keeps quote and staff-action dashboard events when those SMS copies are disabled',()=>transaction(async()=>{
   await rpc('save_staff_sms_settings',[true,true,false,false])
   const c=await customer('+12145550901')
   const [q]=await query("insert into quotes(quote_number,customer_id,lead_id,description,status,grand_total) values('Q-off',$1,$2,'Material','ACCEPTED',100) returning id",[c.customerId,c.leadId])
   const [a]=await query("insert into activity_history(customer_id,entity_type,entity_id,event_type,summary,metadata) values($1,'LEAD',$2,'AI_ACTION_OPEN','Complaint','{\"kind\":\"COMPLAINT\"}') returning id",[c.customerId,c.leadId])
   expect((await query('select state from staff_sms_outbox where operation_key in ($1,$2)',['quote-accepted:'+q.id,'staff-action:'+a.id])).map(r=>r.state)).toEqual(['CANCELLED','CANCELLED'])
   expect(await query('select id from activity_history where id=$1',[a.id])).toHaveLength(1)
   await rpc('save_staff_sms_settings',[true,true,true,true])
   expect((await query('select state from staff_sms_outbox where operation_key=$1',['staff-action:'+a.id]))[0].state).toBe('CANCELLED')
 }))
 it('retries staff transport with the identical payload and provider idempotency key',()=>transaction(async()=>{
   await db.exec("update control_center_settings set sms_status='READY'")
   const id=await rpc('queue_staff_sms_test',[crypto.randomUUID()])
   const bodies:string[]=[],keys:string[]=[]
   const carrier=async(_url:unknown,init?:RequestInit)=>{
     bodies.push(String(init?.body));keys.push(new Headers(init?.headers).get('Idempotency-Key')!)
     return bodies.length===1?new Response('temporarily unavailable',{status:503}):new Response(JSON.stringify({data:{recipients:[{message_id:'staff-retry',status:'SENT'}]}}),{status:202})
   }
   const config={apiKey:'fixture',internal:true,templateId:'approved-fixture'}
   await dispatchSms(workerService,config,id,carrier)
   await query('update staff_sms_outbox set next_attempt_at=now() where message_id=$1',[id])
   await dispatchSms(workerService,config,id,carrier)
   expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1]);expect(keys[0]).toBe(keys[1])
 }))
 it('resolves only the fulfilled quote-ready task, leaving custom work intact',()=>transaction(async()=>{
   const c=await customer('+12145550902')
   const [q]=await query("insert into quotes(quote_number,customer_id,lead_id,description,status,grand_total) values('Q-task',$1,$2,'Material','DRAFT',100) returning id",[c.customerId,c.leadId])
   const [a]=await query("insert into activity_history(customer_id,entity_type,entity_id,event_type,summary,metadata) values($1,'LEAD',$2,'AI_ACTION_OPEN','Ready',jsonb_build_object('kind','QUOTE_READY','quote_id',$3::text)) returning id",[c.customerId,c.leadId,q.id])
   const [b]=await query("insert into activity_history(customer_id,entity_type,entity_id,event_type,summary,metadata) values($1,'LEAD',$2,'AI_ACTION_OPEN','Custom work',jsonb_build_object('kind','CUSTOM_WORK','quote_id',$3::text)) returning id",[c.customerId,c.leadId,q.id])
   await query("update quotes set status='SENT' where id=$1",[q.id]);await query("update quotes set status='ACCEPTED' where id=$1",[q.id])
   expect(await query("select id from activity_history where event_type='AI_ACTION_RESOLVED' and metadata->>'request_id'=$1",[a.id])).toHaveLength(1)
   expect(await query("select id from activity_history where event_type='AI_ACTION_RESOLVED' and metadata->>'request_id'=$1",[b.id])).toHaveLength(0)
 }))
 it('new lead and quote acceptance produce single deterministic alerts',()=>transaction(async()=>{
   const c=await customer('+12145550777')
   expect(await query("select * from staff_sms_outbox where operation_key=$1",['lead:'+c.leadId])).toHaveLength(1)
   const [q]=await query("insert into quotes(quote_number,customer_id,lead_id,description,status,grand_total) values('Q1012',$1,$2,'Flexbase','DRAFT',1784) returning id",[c.customerId,c.leadId])
   await query("update quotes set status='ACCEPTED' where id=$1",[q.id]);await query("update quotes set status='ACCEPTED' where id=$1",[q.id])
   const alerts=await query('select * from staff_sms_outbox where operation_key=$1',['quote-accepted:'+q.id])
   expect(alerts).toHaveLength(1);expect(alerts[0].body).toContain('Q1012 · $1784.00')
 }))
 it('master and individual toggles suppress only SMS, including queued work',()=>transaction(async()=>{
   await rpc('save_staff_sms_settings',[true,false,true,true])
   const c=await customer('+12145550778')
   expect((await query('select state from staff_sms_outbox where operation_key=$1',['lead:'+c.leadId]))[0].state).toBe('CANCELLED')
   expect(await query('select * from leads where id=$1',[c.leadId])).toHaveLength(1)
   const id=await rpc('queue_staff_sms_test',[crypto.randomUUID()])
   await rpc('save_staff_sms_settings',[false,true,true,true])
   const leased=await rpc('claim_staff_sms',[id])
   expect(await rpc('authorize_staff_sms_dispatch',[id,leased.lease_token,'fixture'])).toBeNull()
 }))
 it('logs the actual staff-action reason and cancels alerts resolved before dispatch',()=>transaction(async()=>{
   const c=await customer('+12145550779')
   const [action]=await query("insert into activity_history(customer_id,entity_type,entity_id,event_type,summary,metadata) values($1,'LEAD',$2,'AI_ACTION_OPEN','Custom work',jsonb_build_object('kind','CUSTOM_WORK','request','Driveway work needs pricing')) returning id",[c.customerId,c.leadId])
   const [alert]=await query('select * from staff_sms_outbox where operation_key=$1',['staff-action:'+action.id])
   expect(alert.body).toContain('Driveway work needs pricing')
   await query("insert into activity_history(customer_id,entity_type,entity_id,event_type,summary,metadata) values($1,'LEAD',$2,'AI_ACTION_RESOLVED','Handled',jsonb_build_object('request_id',$3::text))",[c.customerId,c.leadId,action.id])
   const claim=await rpc('claim_staff_sms',[alert.message_id]);expect(await rpc('authorize_staff_sms_dispatch',[alert.message_id,claim.lease_token,'fixture'])).toBeNull()
 }))
 it('test uses real transport/idempotency without a fake customer; inbound staff stays internal',()=>transaction(async()=>{
   await db.exec("update control_center_settings set sms_status='READY'")
   const before=await query('select count(*)::int n from customers')
   const key=crypto.randomUUID(),id=await rpc('queue_staff_sms_test',[key])
   expect(await rpc('queue_staff_sms_test',[key])).toBe(id)
   let calls=0
   const carrier=async()=>{calls++;return new Response(JSON.stringify({data:{recipients:[{message_id:'staff-fixture',status:'SENT'}]}}),{status:202})}
   const config={apiKey:'fixture',internal:true,templateId:'approved-fixture'}
   expect(await dispatchSms(workerService,config,id,carrier)).toMatchObject({accepted:true})
   expect(await dispatchSms(workerService,config,id,carrier)).toMatchObject({dispatched:false})
   expect(calls).toBe(1)
   await query("update staff_sms_outbox set next_receipt_check_at=now() where message_id=$1",[id])
   expect(await rpc('claim_sms_receipt_checks')).toContainEqual({message_id:id,internal:true})
   expect(await rpc('claim_sms_receipt_checks')).not.toContainEqual({message_id:id,internal:true})
   await rpc('ingest_sms_event',['staff-fixture','message.delivered','DELIVERED',false,'+19453750877'])
   expect((await query('select delivery_status from staff_sms_outbox where message_id=$1',[id]))[0].delivery_status).toBe('DELIVERED')
   expect(await rpc('record_inbound_sms',['staff-reply','+12146778466','hi'])).toMatchObject({internal:true})
   expect(await rpc('resolve_inbound_sms_conversation',['2146778466'])).toMatchObject({internal:true})
   expect(await query('select count(*)::int n from customers')).toEqual(before)
   await rpc('record_inbound_sms',['staff-stop','+12146778466','STOP','STOP'])
   expect(await rpc('staff_sms_enabled',['TEST'])).toBe(false)
   await rpc('record_inbound_sms',['staff-start','+12146778466','START','START',new Date(Date.now()+1000).toISOString()])
   expect(await rpc('staff_sms_enabled',['TEST'])).toBe(true)
 }))
})
