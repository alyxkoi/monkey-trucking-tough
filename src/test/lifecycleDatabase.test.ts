// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll,afterAll,describe,it,expect } from 'vitest'
const read=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8')
const base=read('20260826233501_36b91b63-9c99-426a-9ad4-fd55280d9c6b')
let db:PGlite
const query=async(sql:string,args:any[]=[])=> (await db.query<any>(sql,args)).rows
const rpc=async(name:string,args:any[]=[])=> (await query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))[0].result
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as 'select null::uuid';create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);create table tickets(id uuid primary key);create table user_roles(user_id uuid,role text);create function is_admin_or_staff() returns boolean language sql as 'select true';create sequence quote_number_seq;
 create table materials(id uuid primary key default gen_random_uuid(),name text,price_per_yard numeric,full_load_price numeric,full_load_yards numeric,is_active boolean default true,sort_order integer,updated_at timestamptz default now());
 create table app_settings(id integer,company_address text,company_city_state_zip text,delivery_tier_1_max_miles numeric,delivery_tier_1_fee numeric,delivery_tier_2_max_miles numeric,delivery_tier_2_fee numeric,delivery_tier_3_max_miles numeric,delivery_tier_3_fee numeric,delivery_overage_base_fee numeric,delivery_overage_per_mile numeric,tax_enabled boolean,tax_rate numeric,tax_applies_to_delivery boolean);
 insert into app_settings values(1,'7653 S FM 148','Kaufman TX 75142',2,0,5,60,10,100,100,10,false,0,false);`)
 for(const table of ['customers','leads','quotes','quote_items','jobs','invoices','payments','activity_history','control_center_settings','automation_rules','lead_messages'])await db.exec(base.match(new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`))![0])
 await db.exec(`alter table customers add sms_consent_at timestamptz,add sms_consent_source text,add sms_opted_out_at timestamptz;create table contact_submissions(id uuid primary key,customer_id uuid,lead_id uuid,phone text,project_type text,message text,sms_consent boolean,sms_consent_at timestamptz,submitted_at timestamptz,consent_source text);insert into control_center_settings(id) values(1);`)
 await db.exec(base.match(/insert into public\.automation_rules[\s\S]*?on conflict \(id\) do nothing;/)![0])
 for(const file of ['20260913090000_sent_dm_sms_transport','20260913170000_durable_sms_pipeline','20260913171000_sms_consent_and_inbox','20260913172000_communication_worker','20260914190000_initial_response_and_reschedule_intake','20260915010000_ai_material_and_route_intelligence'])await db.exec(read(file))
 await db.exec(`create table ai_audit_logs(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),status text);`)
 for(const file of ['20260915120000_ai_control_audit','20260915193000_followup_completion','20260915201500_outbound_receipt_reconciliation','20260915220000_ai_lifecycle_actions'])await db.exec(read(file))
},30000)
afterAll(async()=>{await db?.close()})
async function fixture(body='my name is Mike'){
 const [c]=await query("insert into customers(name,phone,sms_consent_at,sms_double_opt_in_at) values('Unknown SMS +12145550000','+12145550000',now(),now()) returning *")
 const [l]=await query("insert into leads(customer_id,source,need,conversation_revision) values($1,'Other','Material request',1) returning *",[c.id])
 const [m]=await query("insert into lead_messages(lead_id,customer_id,sender_type,body,delivery_status,message_kind) values($1,$2,'CUSTOMER',$3,'RECEIVED','INBOUND') returning *",[l.id,c.id,body])
 return {c,l,m,apply:(plan:any)=>rpc('apply_ai_lifecycle',[l.id,1,m.id,{write_allowed:true,actions:[],...plan}])}
}
async function transaction(fn:()=>Promise<void>){await db.exec('begin');try{await fn()}finally{await db.exec('rollback')}}
describe.sequential('executed lifecycle write transactions',()=>{
 it('updates by customer ID, does not merge first names and audits once',()=>transaction(async()=>{
   const a=await fixture(),b=await fixture();await a.apply({name:'Mike'});await b.apply({name:'Mike'});await a.apply({name:'Mike'})
   expect((await query("select count(*)::int n from customers where name='Mike'"))[0].n).toBe(2)
   const audits=await query("select metadata from activity_history where event_type='AI_LIFECYCLE_APPLIED'")
   expect(audits).toHaveLength(2);expect(audits[0].metadata.before.customer.name).toContain('Unknown');expect(audits[0].metadata.after.customer.name).toBe('Mike')
 }))
 it('rejects stale revisions, fabricated names and unauthenticated writes',()=>transaction(async()=>{
   const a=await fixture();await db.exec('savepoint invalid_name');await expect(a.apply({name:'Not In Message'})).rejects.toThrow('current customer');await db.exec('rollback to savepoint invalid_name')
   expect(await rpc('apply_ai_lifecycle',[a.l.id,0,a.m.id,{write_allowed:true,name:'Mike'}])).toMatchObject({status:'STALE'})
   expect((await query("select has_function_privilege('authenticated','public.apply_ai_lifecycle(uuid,bigint,uuid,jsonb)','EXECUTE') allowed"))[0].allowed).toBe(false)
 }))
 it('prepares an untouched quote with real calculation, email and date; never sends',()=>transaction(async()=>{
   const a=await fixture('send the quote to mike@example.com tomorrow at noon')
   const [material]=await query("insert into materials(name,price_per_yard,full_load_price,full_load_yards,is_active) values('Flexbase',38,720,20,true) returning id")
   const date=(await query("select ((now() at time zone 'America/Chicago')::date+1)::text value"))[0].value
   const p={email:'mike@example.com',confirmed_email:'mike@example.com',quote_requested:true,requested_date:date,requested_time:'12:00',requested_text:'tomorrow at noon',ready:true,context:{pricing:{material_id:material.id,yards:20,quantity:{status:'RESOLVED'},route:{status:'ROUTE_CALCULATED',destination:'123 Oak Road, Kaufman TX',origin:'7653 S FM 148',distance_miles:10}}}}
   expect(await a.apply(p)).toMatchObject({status:'APPLIED',ready:true})
   const [q]=await query('select * from quotes where lead_id=$1',[a.l.id]);expect(q.status).toBe('DRAFT');expect(Number(q.grand_total)).toBe(820);expect(q.confirmed_email).toBe('mike@example.com');expect(q.ai_ready_at).toBeTruthy()
   expect(await query('select * from open_ai_staff_actions()')).toHaveLength(1)
   await query("update quotes set status='SENT' where id=$1",[q.id]);expect(await query('select * from open_ai_staff_actions()')).toHaveLength(0)
   expect(await query('select * from sms_outbox')).toHaveLength(0)
 }))
 it('does not edit accepted financial terms or calendar, but adds job instructions and requests',()=>transaction(async()=>{
   const a=await fixture('gate code is 5521')
   const [q]=await query("insert into quotes(quote_number,customer_id,lead_id,status,grand_total) values('SAFE', $1,$2,'ACCEPTED',900) returning *",[a.c.id,a.l.id])
   const [j]=await query("insert into jobs(customer_id,quote_id,category,scheduled_date,address,description,agreed_amount) values($1,$2,'MATERIAL_DELIVERY',current_date+2,'123 Oak','Delivery',900) returning *",[a.c.id,q.id])
   await a.apply({job_note:'gate code is 5521',actions:['ORDER_CHANGE','SCHEDULE_CHANGE'],requested_date:new Date().toISOString().slice(0,10),context:{quote_id:q.id,job_id:j.id,request:'change requested'}})
   expect((await query('select grand_total from quotes where id=$1',[q.id]))[0].grand_total).toBe(q.grand_total)
   const [updated]=await query('select * from jobs where id=$1',[j.id]);expect(updated.scheduled_date).toEqual(j.scheduled_date);expect(updated.notes).toContain('5521')
   const actions=await query('select * from open_ai_staff_actions()');expect(actions).toHaveLength(2)
   await rpc('resolve_ai_staff_action',[actions[0].id,'Reviewed with customer']);await rpc('resolve_ai_staff_action',[actions[0].id,'Already handled']);expect(await query('select * from open_ai_staff_actions()')).toHaveLength(1)
 }))
 it('reserves one acknowledgment and pauses atomically while preserving final consent checks',()=>transaction(async()=>{
   const a=await fixture('I want Salvador')
   await db.exec("update control_center_settings set sms_status='READY',business_number='+19453750877';update communication_runtime set ai_sending_enabled=true")
   const [job]=await query("insert into communication_jobs(operation_key,kind,lead_id,trigger_message_id,context,state,lease_token,lease_until) values('ack-test','AI_REPLY',$1,$2,$3,'WORKING',gen_random_uuid(),now()+interval '1 minute') returning *",[a.l.id,a.m.id,{conversation_revision:1}])
   const result=await rpc('finish_ai_handoff',[job.id,job.lease_token,false,null]);expect(result.body).toContain('Salvador');expect((await query('select human_takeover from leads where id=$1',[a.l.id]))[0].human_takeover).toBe(true)
   expect(await rpc('finish_ai_handoff',[job.id,job.lease_token,false,null])).toBeNull();expect(await query('select * from sms_outbox')).toHaveLength(1)
   const claimed=await rpc('claim_sms',[result.id]);expect(await rpc('authorize_sms_dispatch',[result.id,claimed.lease_token])).toBeTruthy()
 }))
 it('does not merge an email collision or partially update the name',()=>transaction(async()=>{
   const a=await fixture('my name is Mike. use shared@example.com'),b=await fixture()
   await query("update customers set email='shared@example.com',normalized_email='shared@example.com' where id=$1",[b.c.id])
   expect(await a.apply({name:'Mike',email:'shared@example.com'})).toMatchObject({status:'CONTACT_REVIEW'})
   expect((await query('select name,email from customers where id=$1',[a.c.id]))[0]).toMatchObject({name:a.c.name,email:null})
   expect(await query('select * from open_ai_staff_actions()')).toHaveLength(1)
 }))
 it('captures a payment claim without recording payment or marking paid',()=>transaction(async()=>{
   const a=await fixture('I already paid')
   const [q]=await query("insert into quotes(quote_number,customer_id,lead_id,status,grand_total) values('CLAIM',$1,$2,'ACCEPTED',300) returning id",[a.c.id,a.l.id])
   const [i]=await query("insert into invoices(invoice_number,customer_id,quote_id,amount_source,description,amount,status) values('CLAIM-I',$1,$2,'QUOTE','Material',300,'SENT') returning id",[a.c.id,q.id])
   await a.apply({write_allowed:false,actions:['PAYMENT_CLAIM'],context:{invoice_id:i.id}})
   expect((await query('select status,payment_claimed_at from invoices where id=$1',[i.id]))[0]).toMatchObject({status:'SENT',payment_claimed_at:expect.any(Date)})
   expect(await query('select * from payments')).toHaveLength(0)
   expect(await query('select * from open_ai_staff_actions()')).toHaveLength(1)
   const audit=(await query("select metadata from activity_history where event_type='AI_LIFECYCLE_APPLIED'"))[0].metadata
   expect(audit.before.invoice.payment_claimed_at).toBeNull();expect(audit.after.invoice.payment_claimed_at).toBeTruthy()
   await query("update invoices set status='PAID' where id=$1",[i.id])
   expect(await query('select * from open_ai_staff_actions()')).toHaveLength(0)
 }))
 it('keeps manual draft financial values protected',()=>transaction(async()=>{
   const a=await fixture('send the quote to mike@example.com')
   const [material]=await query("insert into materials(name,price_per_yard,full_load_price,full_load_yards) values('Flexbase',38,720,20) returning id")
   const [q]=await query("insert into quotes(quote_number,customer_id,lead_id,status,grand_total,delivery_distance_source,delivery_fee_per_load) values('MANUAL',$1,$2,'DRAFT',777,'MANUAL',77) returning id",[a.c.id,a.l.id])
   await query("insert into quote_items(quote_id,kind,description,line_total) values($1,'CUSTOM_WORK','Protected scope',700)",[q.id])
   const result=await a.apply({ready:true,context:{pricing:{material_id:material.id,yards:20,quantity:{status:'RESOLVED'},route:{status:'ROUTE_CALCULATED',destination:'New destination',origin:'Yard',distance_miles:20}}}})
   expect(result.ready).toBe(false);expect(Number((await query('select grand_total from quotes where id=$1',[q.id]))[0].grand_total)).toBe(777)
 }))
 it('denies a stale handoff and blocks an acknowledged handoff after STOP',()=>transaction(async()=>{
   const a=await fixture('Salvador please')
   await db.exec("update control_center_settings set sms_status='READY',business_number='+19453750877';update communication_runtime set ai_sending_enabled=true")
   const [job]=await query("insert into communication_jobs(operation_key,kind,lead_id,trigger_message_id,context,state,lease_token,lease_until) values('ack-stop','AI_REPLY',$1,$2,$3,'WORKING',gen_random_uuid(),now()+interval '1 minute') returning *",[a.l.id,a.m.id,{conversation_revision:0}])
   expect(await rpc('finish_ai_handoff',[job.id,job.lease_token,false,null])).toBeNull()
   expect((await query('select human_takeover from leads where id=$1',[a.l.id]))[0].human_takeover).toBe(false)
   await query("update communication_jobs set state='WORKING',context=$2 where id=$1",[job.id,{conversation_revision:1}])
   const result=await rpc('finish_ai_handoff',[job.id,job.lease_token,false,null])
   await query('update customers set sms_opted_out_at=now() where id=$1',[a.c.id])
   const claimed=await rpc('claim_sms',[result.id]);expect(await rpc('authorize_sms_dispatch',[result.id,claimed.lease_token])).toBeNull()
 }))
 it('creates a fresh lead for returning work without a second customer or altered history',()=>transaction(async()=>{
   const a=await fixture('I want another load of gravel')
   const [q]=await query("insert into quotes(quote_number,customer_id,lead_id,status,grand_total) values('HISTORY',$1,$2,'ACCEPTED',900) returning id",[a.c.id,a.l.id])
   await query("insert into jobs(customer_id,quote_id,category,status,scheduled_date,address,description,agreed_amount) values($1,$2,'MATERIAL_DELIVERY','COMPLETED',current_date-60,'Old site','Old delivery',900)",[a.c.id,q.id])
   const result=await a.apply({actions:['NEW_WORK'],context:{request:a.m.body}});expect(result.new_lead_id).toBeTruthy()
   await a.apply({actions:['NEW_WORK']});expect(await query('select * from customers')).toHaveLength(1);expect(await query('select * from leads')).toHaveLength(2)
   expect((await query('select status,grand_total from quotes where id=$1',[q.id]))[0]).toMatchObject({status:'ACCEPTED',grand_total:'900'})
 }))
})
