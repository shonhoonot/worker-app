'use client';
import {useState} from 'react';
import {applicationLabels,statusLabels,planLabel,tokyoDate} from '../lib/domain';
import type {Application,Job,State} from '../lib/domain';
type Mutate=(action:string,payload:unknown,success:string)=>Promise<boolean>;
export function ApplyForm({job,previous,busy,error,onSubmit}:{job:Job;previous?:Application;busy:boolean;error:string;onSubmit:(payload:unknown)=>Promise<void>}){
 const plan=job.plan;
 const [dates,setDates]=useState<string[]>(plan?.mode==='selected'?plan.days.filter(d=>d.date>=tokyoDate()).map(d=>d.date):[]);
 return <><h2>Ажилд хүсэлт өгөх</h2><p>{job.company} · {job.title}</p>{plan&&<div className="info-note">{planLabel(plan)} · {plan.team==='same'?'Бүх хугацаанд ижил хүмүүс ажиллана':'Өдөр бүр өөр хүмүүс байж болно'}</div>}
 <form onSubmit={async e=>{e.preventDefault();const d=new FormData(e.currentTarget);await onSubmit({id:job.id,jobRevision:job.revision,applicationRevision:previous?.revision??0,name:d.get('name'),contact:d.get('contact'),message:d.get('message'),dates,consent:d.get('consent')==='on'})}}><fieldset disabled={busy}><div className="formgrid">
 <label className="full">Таны нэр<input name="name" required minLength={2} maxLength={80} autoComplete="name"/></label>
 <label className="full">Холбоо барих имэйл<input name="contact" type="email" required maxLength={254} autoComplete="email"/></label>
 {plan?.mode==='selected'&&<div className="full application-dates"><strong>Ажиллах өдрүүд</strong>{plan.days.map(d=><label className="checkbox-label" key={d.date}><input type="checkbox" checked={dates.includes(d.date)} disabled={plan.team==='same'||d.date<tokyoDate()} onChange={e=>setDates(e.target.checked?[...dates,d.date]:dates.filter(v=>v!==d.date))}/>{d.date} · {d.workers} хүн хэрэгтэй</label>)}<p className="detail-hint">{plan.team==='same'?'Бүх өдрөөр ажиллах нөхцөлтэй.':'Ажиллаж чадах өдрүүдээ сонгоно уу.'}</p></div>}
 <label className="full">Нэмэлт тайлбар · заавал биш<textarea name="message" maxLength={1000} placeholder="Туршлага, ажиллах боломжийн талаар товч бичээрэй."/></label>
 <p className="full detail-hint">Паспорт, оршин суух карт, банкны мэдээллээ энд бүү оруулаарай.</p>
 <label className="full checkbox-label"><input name="consent" type="checkbox" required/>Зарын нөхцөл, сонгосон хуваарийг уншсан. Нэр, имэйл, тайлбараа энэ ажил олгогчид харуулахыг зөвшөөрч байна.</label>
 <div className="info-note full">Хүсэлт илгээх нь ажилд авсан баталгаа биш. Ажил олгогчтой нөхцөлөө тусад нь тохиролцоно. Имэйл мэдэгдэл автоматаар илгээхгүй.</div>
 {error&&<div className="error-banner full" role="alert">{error}</div>}<button className="primary full" disabled={busy||(plan?.mode==='selected'&&!dates.length)}>{busy?'Илгээж байна…':'Хүсэлт илгээх'}</button>
 </div></fieldset></form></>
}
export function ApplicationsPanel({state,busy,mutate}:{state:State;busy:boolean;mutate:Mutate}){
 const [incoming,setIncoming]=useState(false),[jobId,setJobId]=useState(''),[withdraw,setWithdraw]=useState<Application|null>(null);
 const all=incoming?state.incomingApplications:state.applications;
 const list=all.filter(a=>!jobId||a.jobId===jobId);
 const jobOptions=Array.from(new Map(all.map(a=>[a.jobId,a.snapshot.title])).entries());
 return <section className="applications-panel"><div className="results-head"><div><h2>Ажлын хүсэлтүүд</h2><p>Хүсэлт нь ажилд авсан баталгаа биш.</p></div></div>
 <div className="chips"><button className={'chip '+(!incoming?'active':'')} onClick={()=>{setIncoming(false);setJobId('');setWithdraw(null)}}>Миний хүсэлт · {state.applications.length}</button><button className={'chip '+(incoming?'active':'')} onClick={()=>{setIncoming(true);setJobId('');setWithdraw(null)}}>Ирсэн хүсэлт · {state.incomingApplications.filter(a=>a.status==='submitted').length} шинэ</button></div>
 {!state.user?<div className="info-note">Хүсэлтүүдээ харахын тулд бүртгэлээрээ нэвтэрнэ үү.</div>:<><label className="application-filter">Зараар шүүх<select value={jobId} onChange={e=>setJobId(e.target.value)}><option value="">Бүх зар</option>{jobOptions.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
 <div className="info-note">{incoming?'Илгээсэн хүний мэдээлэл зөвхөн танд харагдана. «Үзсэн» тэмдэг нь ажилд авсан шийдвэр биш.':'Хүсэлт илгээх үеийн зарын нөхцөл энд хадгалагдана. Ажилд гарахаасаа өмнө ажил олгогчтой холбогдож баталгаажуулаарай.'}</div>
 {!list.length?<div className="empty"><h3>Одоогоор хүсэлт алга</h3><p>{incoming?'Таны нийтэлсэн зарт ирсэн хүсэлтүүд энд харагдана.':'Ажлын дэлгэрэнгүйгээс «Хүсэлт өгөх» товчийг дараарай.'}</p></div>:<div className="application-cards">{list.map(a=><article className="card" key={a.id}><div className="application-heading"><h3>{a.snapshot.title}</h3><span className={'status '+(a.status==='withdrawn'?'closed':a.status==='reviewed'?'published':'pending')}>{applicationLabels[a.status]}</span></div><p className="meta">{a.snapshot.company} · {a.snapshot.city}</p><p>¥{a.snapshot.pay.toLocaleString()} / {a.snapshot.unit} · {a.snapshot.schedule}</p>{a.snapshot.plan&&<p>{planLabel(a.snapshot.plan)}</p>}{a.dates.length>0&&<p>Сонгосон: {a.dates.join(', ')}</p>}<p className="detail-hint">Илгээсэн: {new Date(a.createdAt).toLocaleString('mn-MN',{timeZone:'Asia/Tokyo'})} JST</p>
 {a.jobRevision!==a.currentJobRevision&&<div className="rejection-note">Зар эсвэл төлөв нь хүсэлт илгээснээс хойш өөрчлөгдсөн. Одоогийн төлөв: {statusLabels[a.jobStatus]||a.jobStatus}. Нөхцөлийг дахин нягтлаарай.</div>}
 {a.status!=='withdrawn'&&<><strong>{a.name}</strong><a className="contact-link" href={'mailto:'+a.contact}>{a.contact}</a>{a.message&&<div className="detail-box">{a.message}</div>}</>}
 <div className="row-actions">{incoming?a.status==='submitted'&&<button disabled={busy} onClick={()=>void mutate('reviewApplication',{id:a.id,revision:a.revision},'Хүсэлтийг үзсэн гэж тэмдэглэлээ.')}>Үзсэн гэж тэмдэглэх</button>:a.status!=='withdrawn'&&<button disabled={busy} onClick={()=>setWithdraw(a)}>Хүсэлтээ цуцлах</button>}</div>
 {withdraw?.id===a.id&&!incoming&&<div className="withdraw-confirm"><p>Хүсэлтээ цуцлах уу? Таны нэр, имэйл, тайлбар ажил олгогчид харагдахаа болино.</p><button className="secondary" disabled={busy} onClick={()=>setWithdraw(null)}>Болих</button> <button className="primary" disabled={busy} onClick={async()=>{if(await mutate('withdrawApplication',{id:a.id,revision:a.revision},'Хүсэлтээ цуцаллаа.'))setWithdraw(null)}}>Цуцлах</button></div>}
 </article>)}</div>}{all.length>=500&&<p className="info-note">Сүүлийн 500 хүсэлтийг харуулж байна.</p>}</>}
 </section>
}
