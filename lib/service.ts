import { jobInput, DomainError, canManage, validatePlanTime, expiresAt, isExpired, applicationInput, validateApplicationDates } from './domain';
import type { Viewer, Job, State, Application } from './domain';
type Statement={bind:(...args:any[])=>Statement;first:<T=any>()=>Promise<T|null>;all:<T=any>()=>Promise<{results:T[]}>;run:()=>Promise<{meta:{changes?:number}}>};
export type Database={prepare:(sql:string)=>Statement;batch:(statements:Statement[])=>Promise<any[]>};
const select=`SELECT id,owner_id AS ownerId,title,company,city,cat,type,level,pay,unit,schedule,description AS desc,contact,status,moderation_note AS moderationNote,revision,created_at AS createdAt,updated_at AS updatedAt,plan,published_at AS publishedAt,expires_at AS expiresAt FROM jobs`;
const applicationSelect=`SELECT a.id,a.job_id AS jobId,a.name,a.contact,a.message,a.dates,a.snapshot,a.job_revision AS jobRevision,j.revision AS currentJobRevision,j.status AS jobStatus,a.status,a.revision,a.created_at AS createdAt,a.updated_at AS updatedAt FROM applications a JOIN jobs j ON j.id=a.job_id`;
function decodeApplication(a:any):Application{return {...a,dates:JSON.parse(a.dates),snapshot:JSON.parse(a.snapshot)}}
function decode(j:any):Job{return {...j,plan:j.plan?JSON.parse(j.plan):null}}
export function service(db:Database,user:Viewer|null){
 const fail=(code:number,message:string):never=>{throw new DomainError(code,message)};
 const auth=()=>user||fail(401,'Үргэлжлүүлэхийн тулд нэвтэрнэ үү.');
 const admin=()=>{const u=auth();if(!u.isAdmin)fail(403,'Админы эрх шаардлагатай.');return u};
 const job=async(id:unknown)=>{if(typeof id!=='string'||id.length>100)fail(400,'Зарын дугаар буруу.');const j=await db.prepare(select+' WHERE id = ?').bind(id).first<Job>();return j?decode(j):fail(404,'Зар олдсонгүй.')};
 const requirePublished=(j:Job)=>{if(j.status!=='published'||isExpired(j))fail(404,'Зар нийтлэгдээгүй эсвэл хаагдсан.')};
 const owner=(j:Job)=>{if(!canManage(auth(),j))fail(403,'Зөвхөн өөрийн зарыг өөрчилж болно.')};
 const revision=(p:any,j:Job)=>{if(!Number.isInteger(p.revision)||p.revision!==j.revision)fail(409,'Зар өөрчлөгдсөн байна. Дахин ачаалаад оролдоно уу.')};
 const note=(v:unknown)=>{if(typeof v!=='string'||v.trim().length<3||v.trim().length>1000)fail(400,'Шалтгаанаа 3–1000 тэмдэгтээр бичнэ үү.');return (v as string).trim()};
 const audit=(id:string,action:string,n='')=>db.prepare('INSERT INTO audit (id,actor_id,job_id,action,note,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),auth().userId,id,action,n,Date.now());
 async function state():Promise<State>{
 const uid=user?.userId||'';
 const j=await db.prepare(select+` WHERE (status='published' AND (expires_at IS NULL OR expires_at>?) AND NOT EXISTS (SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=jobs.owner_id)) OR owner_id=? ${user?.isAdmin?"OR status IN ('pending','rejected')":''} ORDER BY created_at DESC LIMIT 500`).bind(Date.now(),uid,uid).all<Job>();
 const s=user?await db.prepare('SELECT job_id FROM saved WHERE user_id=?').bind(uid).all<{job_id:string}>():{results:[]};
 const b=user?await db.prepare('SELECT blocked_id FROM blocks WHERE user_id=?').bind(uid).all<{blocked_id:string}>():{results:[]};
 const r=user?.isAdmin?await db.prepare("SELECT r.id,r.job_id AS jobId,r.reason,r.status,r.created_at AS createdAt,j.title FROM reports r JOIN jobs j ON j.id=r.job_id WHERE r.status='open' ORDER BY r.created_at DESC LIMIT 200").all<any>():{results:[]};
 const own=user?await db.prepare(applicationSelect+' WHERE a.applicant_id=? ORDER BY a.updated_at DESC LIMIT 500').bind(uid).all():{results:[]};
 const incoming=user?await db.prepare(applicationSelect+" WHERE j.owner_id=? ORDER BY (a.status='submitted') DESC,a.updated_at DESC LIMIT 500").bind(uid).all():{results:[]};
 return {applications:own.results.map(decodeApplication),incomingApplications:incoming.results.map(decodeApplication),jobs:j.results.map(decode).map(j=>({...j,status:j.status==='published'&&isExpired(j)?'expired':j.status})).map(j=>user?.isAdmin||j.ownerId===uid?j:{...j,moderationNote:''}),saved:s.results.map(s=>s.job_id),blocks:b.results.map(b=>b.blocked_id),reports:r.results,user};
 }
 async function mutate(action:unknown,p:any){
 const u=auth();p=p&&typeof p==='object'?p:{};
 if (action === 'deleteMyData') {
   if (p.confirmation !== 'УСТГАХ') {
     fail(400, 'Устгахын тулд УСТГАХ гэж бичнэ үү.');
   }

   // Use only the authenticated identity. Job deletion also removes
   // bookmarks and reports attached to those jobs through foreign keys.
   await db.batch([
     db.prepare('DELETE FROM audit WHERE actor_id = ? OR job_id IN (SELECT id FROM jobs WHERE owner_id = ?)').bind(u.userId, u.userId),
     db.prepare('DELETE FROM applications WHERE applicant_id = ?').bind(u.userId),
     db.prepare('DELETE FROM reports WHERE user_id = ?').bind(u.userId),
     db.prepare('DELETE FROM saved WHERE user_id = ?').bind(u.userId),
     db.prepare('DELETE FROM blocks WHERE user_id = ? OR blocked_id = ?').bind(u.userId, u.userId),
     db.prepare('DELETE FROM jobs WHERE owner_id = ?').bind(u.userId),
   ]);
   return {};
 }
 if(action==='apply'){
 const j=await job(p.id);requirePublished(j);revision({revision:p.jobRevision},j);
 if(j.ownerId===u.userId)fail(400,'Өөрийн зар руу хүсэлт илгээх боломжгүй.');
 const parsed=applicationInput.safeParse(p);if(!parsed.success)fail(400,'Нэр, имэйл, ажиллах өдрүүд болон зөвшөөрлөө шалгана уу.');const d=parsed.data!;
 validateApplicationDates(j.plan,d.dates);
 const n=await db.prepare('SELECT count(*) AS count FROM applications WHERE applicant_id=? AND updated_at>?').bind(u.userId,Date.now()-3600000).first<{count:number}>();if((n?.count||0)>=20)fail(429,'Нэг цагт 20 хүртэл хүсэлт илгээх боломжтой.');
 const snapshot={title:j.title,company:j.company,city:j.city,pay:j.pay,unit:j.unit,schedule:j.schedule,plan:j.plan??null};
 const now=Date.now();
 // Conditional insert and unique key prevent duplicate requests, stale job applications,
 // and writes after a concurrent close/edit. A withdrawn request may be explicitly resubmitted.
 const result=await db.prepare(`INSERT INTO applications (id,job_id,applicant_id,name,contact,message,dates,snapshot,job_revision,status,revision,created_at,updated_at)
 SELECT ?,id,?,?,?,?,?,?,revision,'submitted',1,?,? FROM jobs WHERE id=? AND revision=? AND status='published' AND (expires_at IS NULL OR expires_at>?)
 AND NOT EXISTS (SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=jobs.owner_id) OR (user_id=jobs.owner_id AND blocked_id=?))
 ON CONFLICT(job_id,applicant_id) DO UPDATE SET name=excluded.name,contact=excluded.contact,message=excluded.message,dates=excluded.dates,snapshot=excluded.snapshot,job_revision=excluded.job_revision,status='submitted',revision=applications.revision+1,created_at=excluded.created_at,updated_at=excluded.updated_at
 WHERE applications.status='withdrawn' AND applications.revision=?`).bind(crypto.randomUUID(),u.userId,d.name,d.contact,d.message,JSON.stringify([...d.dates].sort()),JSON.stringify(snapshot),now,now,j.id,j.revision,now,u.userId,u.userId,Number.isInteger(p.applicationRevision)?p.applicationRevision:0).run();
 if(!result.meta.changes)fail(409,'Хүсэлт өмнө нь илгээгдсэн эсвэл зар өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.');return {};
 }
 if(action==='withdrawApplication'||action==='reviewApplication'){
 if(typeof p.id!=='string'||!Number.isInteger(p.revision))fail(400,'Хүсэлтийн дугаар эсвэл хувилбар буруу.');
 const withdrawing=action==='withdrawApplication';
 const result=withdrawing?await db.prepare("UPDATE applications SET status='withdrawn',name='',contact='',message='',revision=revision+1,updated_at=? WHERE id=? AND applicant_id=? AND revision=? AND status IN ('submitted','reviewed')").bind(Date.now(),p.id,u.userId,p.revision).run():await db.prepare("UPDATE applications SET status='reviewed',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status='submitted' AND EXISTS (SELECT 1 FROM jobs WHERE jobs.id=applications.job_id AND jobs.owner_id=?)").bind(Date.now(),p.id,p.revision,u.userId).run();
 if(!result.meta.changes)fail(409,'Хүсэлт өөрчлөгдсөн эсвэл энэ үйлдлийн эрхгүй байна. Дахин шинэчилнэ үү.');return {};
 }
 if(action==='create'){
 const parsed=jobInput.safeParse(p);if(!parsed.success)fail(400,parsed.error?.issues[0]?.message||'Зарын мэдээлэл дутуу эсвэл буруу байна.');const d=parsed.data!;validatePlanTime(d.plan);if(!d.plan)fail(400,'Ажиллах огноо, хүсэлт авах хугацаагаа оруулна уу.');
 const n=await db.prepare('SELECT COUNT(*) AS count FROM jobs WHERE owner_id=? AND created_at>?').bind(u.userId,Date.now()-3600000).first<{count:number}>();if((n?.count||0)>=10)fail(429,'Нэг цагт 10 хүртэл зар нэмэх боломжтой.');
 const id=crypto.randomUUID(),now=Date.now();await db.prepare(`INSERT INTO jobs (id,owner_id,title,company,city,cat,type,level,pay,unit,schedule,description,contact,plan,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)`).bind(id,u.userId,d.title,d.company,d.city,d.cat,d.type,d.level,d.pay,d.unit,d.schedule,d.desc,d.contact,JSON.stringify(d.plan),now,now).run();return {id};
 }
 if(action==='edit'){
 const j=await job(p.id);owner(j);revision(p,j);const parsed=jobInput.safeParse(p);if(!parsed.success)fail(400,parsed.error?.issues[0]?.message||'Зарын мэдээлэл дутуу эсвэл буруу байна.');const d=parsed.data!;validatePlanTime(d.plan);if(!d.plan)fail(400,'Ажиллах огноо, хүсэлт авах хугацаагаа оруулна уу.');
 const result=await db.prepare("UPDATE jobs SET title=?,company=?,city=?,cat=?,type=?,level=?,pay=?,unit=?,schedule=?,description=?,contact=?,plan=?,published_at=NULL,expires_at=NULL,status='pending',moderation_note='',revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?").bind(d.title,d.company,d.city,d.cat,d.type,d.level,d.pay,d.unit,d.schedule,d.desc,d.contact,JSON.stringify(d.plan),Date.now(),j.id,u.userId,j.revision).run();if(!result.meta.changes)fail(409,'Зар өөрчлөгдсөн. Дахин ачаална уу.');return {};
 }
 if(action==='close'){
 const j=await job(p.id);owner(j);revision(p,j);const r=await db.prepare("UPDATE jobs SET status='closed',revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?").bind(Date.now(),j.id,u.userId,j.revision).run();if(!r.meta.changes)fail(409,'Зар өөрчлөгдсөн. Дахин ачаална уу.');return {};
 }
 if(action==='save'){
 const j=await job(p.id);if(typeof p.saved!=='boolean')fail(400,'Утга буруу.');if(p.saved){requirePublished(j);await db.prepare('INSERT OR IGNORE INTO saved (user_id,job_id) VALUES (?,?)').bind(u.userId,j.id).run()}else await db.prepare('DELETE FROM saved WHERE user_id=? AND job_id=?').bind(u.userId,j.id).run();return {};
 }
 if(action==='report'){
 const j=await job(p.id);requirePublished(j);const reason=note(p.reason);const existing=await db.prepare("SELECT id FROM reports WHERE user_id=? AND job_id=? AND status='open'").bind(u.userId,j.id).first();if(existing)fail(409,'Энэ зарын талаар өмнө нь мэдээлсэн байна.');await db.prepare('INSERT INTO reports (id,user_id,job_id,reason,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,j.id,reason,Date.now()).run();return {};
 }
 if(action==='block'){
 const j=await job(p.id);requirePublished(j);if(j.ownerId===u.userId)fail(400,'Өөрийгөө блоклох боломжгүй.');await db.prepare('INSERT OR IGNORE INTO blocks (user_id,blocked_id) VALUES (?,?)').bind(u.userId,j.ownerId).run();return {};
 }
 if(action==='unblockAll'){await db.prepare('DELETE FROM blocks WHERE user_id=?').bind(u.userId).run();return {}}
 if(action==='review'){
 admin();const j=await job(p.id);revision(p,j);if(!['published','rejected'].includes(p.status))fail(400,'Төлөв буруу.');if(p.status==='published'&&j.status!=='pending')fail(409,'Зөвхөн хяналтад байгаа зарыг батална.');if(p.status==='rejected'&&!['pending','published'].includes(j.status))fail(409,'Энэ төлөвтэй зарыг буцаах боломжгүй.');const reason=p.status==='rejected'?note(p.reason):'';if(p.status==='published')validatePlanTime(j.plan);const publishedAt=p.status==='published'?Date.now():j.publishedAt??null;const expiry=p.status==='published'&&j.plan?expiresAt(j.plan,publishedAt!):j.expiresAt??null;
 // D1 batches are transactional. Audit only if the conditional update succeeded.
 const results=await db.batch([db.prepare('UPDATE jobs SET status=?,moderation_note=?,published_at=?,expires_at=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(p.status,reason,publishedAt,expiry,Date.now(),j.id,j.revision),db.prepare('INSERT INTO audit (id,actor_id,job_id,action,note,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),u.userId,j.id,p.status,reason,Date.now())]);if(!results[0].meta.changes)fail(409,'Зар өөрчлөгдсөн. Дахин ачаална уу.');return {};
 }
 if(action==='resolveReport'){
 admin();if(typeof p.id!=='string')fail(400,'Дугаар буруу.');const r=await db.prepare("UPDATE reports SET status='resolved' WHERE id=? AND status='open'").bind(p.id).run();if(!r.meta.changes)fail(404,'Мэдээлэл олдсонгүй.');return {};
 }
 fail(400,'Үйлдэл танигдсангүй.');
 }
 return {state,mutate};
}
