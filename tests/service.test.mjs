import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {service} from '../.sites-runtime/tests/service.mjs';
import {assertSameOrigin, dateOffset, tokyoDate, DAY_MS, deadlineMs} from '../.sites-runtime/tests/domain.mjs';
const owner={userId:'owner',displayName:'Owner',isAdmin:false};
const viewer={userId:'viewer',displayName:'Viewer',isAdmin:false};
const admin={userId:'admin',displayName:'Admin',isAdmin:true};
const input={title:'Кафены ажилтан',company:'Demo Café',city:'Токио',cat:'Үйлчилгээ',type:'Цагийн ажил',level:'N5–N4',pay:1500,unit:'цаг',schedule:'09:00–15:00',desc:'Туршилтын кафены үйлчилгээний ажил.',contact:'demo@example.com',plan:{mode:'range',start:dateOffset(7),end:dateOffset(20),days:[],workers:5,team:'same',deadline:dateOffset(6)+'T21:00',listingDays:7}};
function setup(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));const db={prepare(query){const make=(args=[])=>({bind(...values){return make(values)},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}});return make()},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};return {sql,as:u=>service(db,u)}}
const status=n=>e=>e.status===n;
async function publish(f){const {id}=await f.as(owner).mutate('create',input);await f.as(admin).mutate('review',{id,revision:1,status:'published'});return id}
test('new jobs are private pending, ignores client owner and approval fields',async()=>{const f=setup();const {id}=await f.as(owner).mutate('create',{...input,ownerId:'admin',status:'published'});const own=(await f.as(owner).state()).jobs[0];assert.equal(own.ownerId,'owner');assert.equal(own.status,'pending');assert.equal((await f.as(viewer).state()).jobs.length,0);assert.equal((await f.as(null).state()).jobs.length,0);assert.equal((await f.as(admin).state()).jobs[0].id,id)});
test('anonymous writes and forged reviewer action are denied',async()=>{const f=setup();await assert.rejects(f.as(null).mutate('create',input),status(401));const {id}=await f.as(owner).mutate('create',input);await assert.rejects(f.as(owner).mutate('review',{id,revision:1,status:'published'}),status(403))});
test('other users cannot edit or close another user job',async()=>{const f=setup(),id=await publish(f);for(const action of ['edit','close'])await assert.rejects(f.as(viewer).mutate(action,{...input,id,revision:2}),status(403))});
test('approval is public, edit unpublishes and requires a new review',async()=>{const f=setup(),id=await publish(f);assert.equal((await f.as(viewer).state()).jobs.length,1);await f.as(owner).mutate('edit',{...input,id,revision:2,title:'Шинэ нэртэй ажил'});assert.equal((await f.as(viewer).state()).jobs.length,0);assert.equal((await f.as(owner).state()).jobs[0].status,'pending');assert.equal(f.sql.prepare('SELECT count(*) n FROM audit').get().n,1)});
test('stale edit and moderation revisions cannot overwrite current data',async()=>{const f=setup();const {id}=await f.as(owner).mutate('create',input);await f.as(owner).mutate('edit',{...input,id,revision:1,pay:1600});await assert.rejects(f.as(admin).mutate('review',{id,revision:1,status:'published'}),status(409));await assert.rejects(f.as(owner).mutate('edit',{...input,id,revision:1}),status(409));assert.equal(f.sql.prepare('SELECT count(*) n FROM audit').get().n,0)});
test('saved jobs isolated by identity and closed jobs unavailable to readers',async()=>{const f=setup(),id=await publish(f);await f.as(viewer).mutate('save',{id,saved:true});await f.as(viewer).mutate('save',{id,saved:true});assert.deepEqual((await f.as(viewer).state()).saved,[id]);assert.equal((await f.as(owner).state()).saved.length,0);await f.as(owner).mutate('close',{id,revision:2});assert.equal((await f.as(viewer).state()).jobs.length,0);await f.as(viewer).mutate('save',{id,saved:false});assert.equal((await f.as(viewer).state()).saved.length,0)});
test('pending jobs cannot be saved, reported or blocked by guessing ids',async()=>{const f=setup();const {id}=await f.as(owner).mutate('create',input);for(const action of ['save','report','block'])await assert.rejects(f.as(viewer).mutate(action,{id,saved:true,reason:'Хуурамч зар'}),status(404))});
test('report queue admin-only, duplicate reports rejected, resolution authorized',async()=>{const f=setup(),id=await publish(f);await f.as(viewer).mutate('report',{id,reason:'Цалин буруу бичсэн байна'});await assert.rejects(f.as(viewer).mutate('report',{id,reason:'Цалин буруу байна'}),status(409));assert.equal((await f.as(owner).state()).reports.length,0);const report=(await f.as(admin).state()).reports[0];await assert.rejects(f.as(viewer).mutate('resolveReport',{id:report.id}),status(403));await f.as(admin).mutate('resolveReport',{id:report.id});assert.equal((await f.as(admin).state()).reports.length,0)});
test('block hides all publisher listings and can be reversed by blocker only',async()=>{const f=setup(),id=await publish(f);await f.as(viewer).mutate('block',{id});assert.equal((await f.as(viewer).state()).jobs.length,0);assert.equal((await f.as(null).state()).jobs.length,1);await f.as(owner).mutate('unblockAll',{});assert.equal((await f.as(viewer).state()).jobs.length,0);await f.as(viewer).mutate('unblockAll',{});assert.equal((await f.as(viewer).state()).jobs.length,1)});
test('invalid input, negative salary and oversized descriptions rejected',async()=>{const f=setup();for(const bad of [{pay:-1},{contact:'javascript:alert(1)'},{city:'Unknown'},{desc:'a'.repeat(3001)},{title:' '}])await assert.rejects(f.as(owner).mutate('create',{...input,...bad}),status(400));assert.equal((await f.as(owner).state()).jobs.length,0)});
test('reject requires explanation and records a moderation audit',async()=>{const f=setup(),id=await publish(f);await assert.rejects(f.as(admin).mutate('review',{id,revision:2,status:'rejected',reason:''}),status(400));await f.as(admin).mutate('review',{id,revision:2,status:'rejected',reason:'Цалингийн мэдээллийг засна уу'});const j=(await f.as(owner).state()).jobs[0];assert.equal(j.status,'rejected');assert.ok(j.moderationNote);assert.equal(f.sql.prepare('SELECT count(*) n FROM audit').get().n,2)});
test('cross-origin and absent-origin mutation requests denied',()=>{assertSameOrigin(new Request('https://ajil.test/api/board',{headers:{origin:'https://ajil.test'}}));for(const origin of ['https://evil.test','null',''])assert.throws(()=>assertSameOrigin(new Request('https://ajil.test/api/board',{headers:origin?{origin}:{}})),status(403))});
test('create rate limits repeated submissions',async()=>{const f=setup();for(let i=0;i<10;i++)await f.as(owner).mutate('create',input);await assert.rejects(f.as(owner).mutate('create',input),status(429))});

test('deletion removes only the signed-in user data and dependent job references; retry is safe', async () => {
  const f = setup();
  const ownJob = await publish(f);
  const { id: otherJob } = await f.as(viewer).mutate('create', input);
  await f.as(admin).mutate('review', { id: otherJob, revision: 1, status: 'published' });
  await f.as(viewer).mutate('save', { id: ownJob, saved: true });
  await f.as(viewer).mutate('save', { id: otherJob, saved: true });
  await f.as(owner).mutate('save', { id: otherJob, saved: true });
  await f.as(owner).mutate('report', { id: otherJob, reason: 'Туршилтын мэдээлэл' });
  await f.as(viewer).mutate('block', { id: ownJob });

  for (let attempt = 0; attempt < 2; attempt++) {
    await f.as(owner).mutate('deleteMyData', { confirmation: 'УСТГАХ', userId: viewer.userId });
  }
  const remaining = await f.as(viewer).state();
  assert.deepEqual(remaining.jobs.map(job => job.id), [otherJob]);
  assert.deepEqual(remaining.saved, [otherJob]);
  assert.deepEqual(remaining.blocks, []);
  assert.deepEqual((await f.as(owner).state()).saved, []);
  assert.deepEqual((await f.as(admin).state()).reports, []);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM audit WHERE job_id = ?').get(ownJob).n, 0);
});

test('deletion requires login and explicit confirmation; a failed batch rolls back', async () => {
  const f = setup();
  const id = await publish(f);
  await f.as(owner).mutate('save', { id, saved: true });
  await assert.rejects(f.as(null).mutate('deleteMyData', { confirmation: 'УСТГАХ' }), status(401));
  await assert.rejects(f.as(owner).mutate('deleteMyData', {}), status(400));
  f.sql.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON jobs BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
  await assert.rejects(f.as(owner).mutate('deleteMyData', { confirmation: 'УСТГАХ' }));
  const unchanged = await f.as(owner).state();
  assert.deepEqual(unchanged.saved, [id]);
  assert.equal(unchanged.jobs[0].id, id);
});


test('Tokyo dates roll over at JST midnight',()=>{
 assert.equal(tokyoDate(Date.parse('2026-11-11T14:59:59Z')),'2026-11-11');
 assert.equal(tokyoDate(Date.parse('2026-11-11T15:00:00Z')),'2026-11-12');
 assert.equal(deadlineMs('2026-11-12T09:00'),Date.parse('2026-11-12T00:00:00Z'));
});
test('work dates persist separately from visibility; approval starts the clock',async()=>{
 const f=setup(); const {id}=await f.as(owner).mutate('create',{...input,cat:'Нураалт',unit:'өдөр',plan:{...input.plan,listingDays:2}});
 let j=(await f.as(owner).state()).jobs[0];assert.equal(j.publishedAt,null);assert.equal(j.expiresAt,null);assert.equal(j.plan.workers,5);
 const before=Date.now();await f.as(admin).mutate('review',{id,revision:1,status:'published'});
 j=(await f.as(viewer).state()).jobs[0];assert.ok(j.publishedAt>=before);assert.equal(j.expiresAt-j.publishedAt,2*DAY_MS);assert.equal(j.plan.end,input.plan.end);
});
test('deadline caps visibility and expired jobs disappear server-side',async()=>{
 const f=setup();const {id}=await f.as(owner).mutate('create',input);await f.as(admin).mutate('review',{id,revision:1,status:'published'});
 let j=(await f.as(viewer).state()).jobs[0];assert.equal(j.expiresAt,deadlineMs(input.plan.deadline));
 f.sql.prepare('UPDATE jobs SET expires_at=? WHERE id=?').run(Date.now()-1,id);
 assert.equal((await f.as(null).state()).jobs.length,0);assert.equal((await f.as(owner).state()).jobs[0].status,'expired');
 for(const action of ['save','report','block'])await assert.rejects(f.as(viewer).mutate(action,{id,saved:true,reason:'Test report'}),status(404));
});
test('invalid dates, past deadlines, reversed ranges and duplicate selected days rejected',async()=>{
 const f=setup();const bad=[{start:'2026-02-30'},{start:dateOffset(-1)},{end:dateOffset(1)},{deadline:dateOffset(-1)+'T21:00'},{deadline:dateOffset(6)+'T25:00'},{listingDays:0},{listingDays:31},{workers:0},{mode:'single'},{mode:'selected',days:[]},{mode:'selected',days:[{date:input.plan.start,workers:2},{date:input.plan.start,workers:3}]}];
 for(const patch of bad)await assert.rejects(f.as(owner).mutate('create',{...input,plan:{...input.plan,...patch}}),status(400));
 await assert.rejects(f.as(owner).mutate('create',{...input,plan:null}),status(400));
});
test('selected dates preserve daily headcount and flexible teams',async()=>{
 const f=setup();const plan={...input.plan,mode:'selected',team:'flexible',days:[{date:input.plan.start,workers:5},{date:input.plan.end,workers:8}]};
 await f.as(owner).mutate('create',{...input,plan});assert.deepEqual((await f.as(owner).state()).jobs[0].plan,plan);
});
test('editing resets visibility and expired pending jobs cannot be approved',async()=>{
 const f=setup(),id=await publish(f);await f.as(owner).mutate('edit',{...input,id,revision:2});
 const j=(await f.as(owner).state()).jobs[0];assert.equal(j.publishedAt,null);assert.equal(j.expiresAt,null);
 f.sql.prepare('UPDATE jobs SET plan=? WHERE id=?').run(JSON.stringify({...input.plan,deadline:dateOffset(-1)+'T21:00'}),id);
 await assert.rejects(f.as(admin).mutate('review',{id,revision:3,status:'published'}),status(400));
});
test('schema migration preserves legacy records with null scheduling fields',async()=>{
 const f=setup(),id=await publish(f);f.sql.prepare('UPDATE jobs SET plan=NULL,published_at=NULL,expires_at=NULL WHERE id=?').run(id);
 const j=(await f.as(viewer).state()).jobs[0];assert.equal(j.id,id);assert.equal(j.plan,null);
});
test('copy creates a separate pending job; early close removes a long-range listing',async()=>{
 const f=setup(),id=await publish(f);const original=(await f.as(owner).state()).jobs[0];
 const copy=await f.as(owner).mutate('create',{...original,plan:{...input.plan,start:dateOffset(8)}});
 assert.notEqual(copy.id,id);assert.equal((await f.as(owner).state()).jobs.find(j=>j.id===copy.id).status,'pending');
 await f.as(owner).mutate('close',{id,revision:2});assert.equal((await f.as(viewer).state()).jobs.length,0);
});

const requestInput={name:'Туршилтын ажилтан',contact:'worker@example.com',message:'Ажиллах боломжтой.',dates:[],consent:true};
async function apply(f,id,who=viewer,extra={}){await f.as(who).mutate('apply',{...requestInput,id,jobRevision:2,...extra});return (await f.as(who).state()).applications[0]}
test('applications persist privately for applicant and employer, not other users or admins',async()=>{
 const f=setup(),id=await publish(f);const a=await apply(f,id,viewer,{applicantId:'owner'});
 assert.equal(a.name,requestInput.name);assert.equal(a.snapshot.title,input.title);assert.equal(a.jobRevision,2);
 assert.equal((await f.as(owner).state()).incomingApplications[0].id,a.id);
 assert.equal((await f.as(admin).state()).incomingApplications.length,0);
 assert.equal((await f.as(admin).state()).applications.length,0);
 assert.equal((await f.as(null).state()).incomingApplications.length,0);
 assert.equal((await f.as(null).state()).applications.length,0);
});
test('application requires login, valid contact, consent, current job and a different owner',async()=>{
 const f=setup(),id=await publish(f);
 await assert.rejects(f.as(null).mutate('apply',{...requestInput,id,jobRevision:2}),status(401));
 await assert.rejects(f.as(owner).mutate('apply',{...requestInput,id,jobRevision:2}),status(400));
 for(const patch of [{consent:false},{contact:'bad'},{name:''},{message:'x'.repeat(1001)}])await assert.rejects(apply(f,id,viewer,patch),status(400));
 await assert.rejects(apply(f,id,viewer,{jobRevision:1}),status(409));
 await f.as(owner).mutate('close',{id,revision:2});await assert.rejects(apply(f,id),status(404));
});
test('only owner can acknowledge; applicant can withdraw and erase contact; revisions prevent stale actions',async()=>{
 const f=setup(),id=await publish(f),a=await apply(f,id);
 await assert.rejects(f.as(admin).mutate('reviewApplication',{id:a.id,revision:1}),status(409));
 await assert.rejects(f.as(owner).mutate('withdrawApplication',{id:a.id,revision:1}),status(409));
 await f.as(owner).mutate('reviewApplication',{id:a.id,revision:1});
 await assert.rejects(f.as(viewer).mutate('withdrawApplication',{id:a.id,revision:1}),status(409));
 await f.as(viewer).mutate('withdrawApplication',{id:a.id,revision:2});
 const withdrawn=(await f.as(owner).state()).incomingApplications[0];
 assert.equal(withdrawn.status,'withdrawn');assert.equal(withdrawn.contact,'');assert.equal(withdrawn.name,'');assert.equal(withdrawn.message,'');
 await assert.rejects(f.as(owner).mutate('reviewApplication',{id:a.id,revision:3}),status(409));
 await apply(f,id,viewer,{applicationRevision:3});
 assert.equal((await f.as(viewer).state()).applications.length,1);assert.equal((await f.as(viewer).state()).applications[0].revision,4);
});
test('duplicate concurrent submissions have one winner and preserve original request',async()=>{
 const f=setup(),id=await publish(f);const results=await Promise.allSettled([apply(f,id),apply(f,id)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM applications').get().n,1);
});
test('expired and blocked jobs reject applications',async()=>{
 const f=setup(),id=await publish(f);await f.as(viewer).mutate('block',{id});await assert.rejects(apply(f,id),status(409));
 await f.as(viewer).mutate('unblockAll',{});f.sql.prepare('UPDATE jobs SET expires_at=? WHERE id=?').run(Date.now()-1,id);await assert.rejects(apply(f,id),status(404));
});
test('selected days must belong to the job and same team requires all offered days',async()=>{
 const f=setup();const dates=[dateOffset(7),dateOffset(9)];const plan={...input.plan,mode:'selected',start:dates[0],end:dates[1],days:dates.map(date=>({date,workers:3}))};
 const {id}=await f.as(owner).mutate('create',{...input,plan});await f.as(admin).mutate('review',{id,revision:1,status:'published'});
 for(const selected of [[],[dates[0]],[dates[0],dates[0]],[dates[0],dateOffset(8)]])await assert.rejects(apply(f,id,viewer,{dates:selected}),status(400));
 await apply(f,id,viewer,{dates});assert.deepEqual((await f.as(viewer).state()).applications[0].dates,dates);
});
test('flexible selected-day request can choose a subset; snapshot survives edits',async()=>{
 const f=setup();const dates=[dateOffset(7),dateOffset(9)],plan={...input.plan,mode:'selected',team:'flexible',start:dates[0],end:dates[1],days:dates.map(date=>({date,workers:3}))};
 const {id}=await f.as(owner).mutate('create',{...input,plan});await f.as(admin).mutate('review',{id,revision:1,status:'published'});await apply(f,id,viewer,{dates:[dates[1]]});
 await f.as(owner).mutate('edit',{...input,id,revision:2,pay:2200});
 const a=(await f.as(viewer).state()).applications[0];assert.equal(a.snapshot.pay,1500);assert.equal(a.jobRevision,2);assert.equal(a.currentJobRevision,3);assert.equal(a.jobStatus,'pending');
});
test('applicant deletion removes their requests; employer deletion cascades requests',async()=>{
 const f=setup(),id=await publish(f);await apply(f,id);
 await f.as(viewer).mutate('deleteMyData',{confirmation:'УСТГАХ'});assert.equal((await f.as(owner).state()).incomingApplications.length,0);
 await apply(f,id);await f.as(owner).mutate('deleteMyData',{confirmation:'УСТГАХ'});assert.equal((await f.as(viewer).state()).applications.length,0);
});
test('withdraw remains available after a job closes',async()=>{
 const f=setup(),id=await publish(f),a=await apply(f,id);await f.as(owner).mutate('close',{id,revision:2});
 await f.as(viewer).mutate('withdrawApplication',{id:a.id,revision:1});assert.equal((await f.as(viewer).state()).applications[0].status,'withdrawn');
});
