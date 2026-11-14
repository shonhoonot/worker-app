import { z } from 'zod';
export const cities=['Токио','Ёкохама','Осака','Сайтама','Чиба','Нагоя'] as const;
export const categories=['Үйлчилгээ','Агуулах','Оффис','Үйлдвэр','Барилга','Нураалт'] as const;
export const types=['Цагийн ажил','Үндсэн ажил','Гэрээт ажил'] as const;
export const levels=['Хэл шаардахгүй','N5–N4','N3','N2+'] as const;
const text=(min:number,max:number)=>z.string().trim().min(min).max(max);

export const DAY_MS=86400000;
export const DAILY_RATE=50;
export const tokyoDate=(now=Date.now())=>new Date(now+9*3600000).toISOString().slice(0,10);
export const dateOffset=(days:number,now=Date.now())=>tokyoDate(now+days*DAY_MS);
const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Огноо буруу.');
const deadline=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine(v=>calendarDate.safeParse(v.slice(0,10)).success&&Number(v.slice(11,13))<24&&Number(v.slice(14,16))<60,'Хугацаа буруу.');
export const deadlineMs=(value:string)=>Date.parse(value+':00+09:00');
export const planInput=z.object({
 mode:z.enum(['single','range','selected']),start:calendarDate,end:calendarDate,
 days:z.array(z.object({date:calendarDate,workers:z.number().int().min(1).max(500)})).max(31),
 workers:z.number().int().min(1).max(500),team:z.enum(['same','flexible']),
 deadline:deadline,listingDays:z.number().int().min(1).max(30)
}).superRefine((p,ctx)=>{
 const issue=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(p.end<p.start)issue('Дуусах өдөр эхлэх өдрөөс өмнө байна.');
 if(p.mode==='single'&&p.start!==p.end)issue('Нэг өдрийн ажлын огноо ижил байна.');
 if(p.mode==='selected'){
  const dates=p.days.map(d=>d.date).sort();
  if(!dates.length||new Set(dates).size!==dates.length)issue('Өдрүүд давхардсан эсвэл хоосон байна.');
  if(dates[0]!==p.start||dates.at(-1)!==p.end)issue('Сонгосон өдрүүдийн хүрээ буруу.');
 }
 if(p.mode!=='selected'&&p.days.length)issue('Өдөр тус бүрийн мэдээлэл зөвхөн сонгосон өдрүүдэд хамаарна.');
 if(p.deadline.slice(0,10)>p.end)issue('Хүсэлт авах хугацаа ажил дуусах өдрөөс хэтэрч болохгүй.');
});
export type SchedulePlan=z.infer<typeof planInput>;
export function validatePlanTime(plan:SchedulePlan|null|undefined,now=Date.now()){
 if(!plan)return;
 if(plan.start<tokyoDate(now)||deadlineMs(plan.deadline)<=now)throw new DomainError(400,'Ажиллах өдөр эсвэл хүсэлт авах хугацаа өнгөрсөн байна. Огноогоо шинэчилнэ үү.');
}
export function expiresAt(plan:SchedulePlan,publishedAt:number){return Math.min(deadlineMs(plan.deadline),publishedAt+plan.listingDays*DAY_MS)}
export function isExpired(job:{expiresAt?:number|null},now=Date.now()){return job.expiresAt!=null&&job.expiresAt<=now}
export function planLabel(p:SchedulePlan){return p.mode==='single'?p.start:p.mode==='selected'?p.days.length+' сонгосон өдөр · '+p.start+' – '+p.end:p.start+' – '+p.end}

export const jobInput=z.object({title:text(3,80),company:text(2,60),city:z.enum(cities),cat:z.enum(categories),type:z.enum(types),level:z.enum(levels),pay:z.number().int().min(1).max(10000000),unit:z.enum(['цаг','өдөр','сар']),schedule:text(3,120),desc:text(10,3000),contact:z.string().trim().email().max(254),plan:planInput.nullable().optional()});
export type JobInput=z.infer<typeof jobInput>;
export type Job=JobInput & {id:string;ownerId:string;status:string;moderationNote:string;revision:number;createdAt:number;updatedAt:number;isDemo?:boolean;publishedAt?:number|null;expiresAt?:number|null};
export type Viewer={userId:string;displayName:string;isAdmin:boolean};
export type Report={id:string;jobId:string;reason:string;createdAt:number;status:string;title:string};
export type State={jobs:Job[];saved:string[];blocks:string[];reports:Report[];applications:Application[];incomingApplications:Application[];user:Viewer|null};
export const statusLabels:Record<string,string>={pending:'Хяналтад',published:'Нийтлэгдсэн',rejected:'Буцаасан',closed:'Хаагдсан',expired:'Хугацаа дууссан'};
export function assertSameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new DomainError(403,'Хүсэлтийн эх үүсвэр зөвшөөрөгдөөгүй.');}
export class DomainError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status}}
export function canManage(user:Viewer|null,job:{ownerId:string}){return !!user&&user.userId===job.ownerId}

export const applicationInput=z.object({
 name:text(2,80),contact:z.string().trim().email().max(254),message:z.string().trim().max(1000).default(''),
 dates:z.array(calendarDate).max(31).default([]),consent:z.literal(true)
});
export type ApplicationSnapshot=Pick<JobInput,'title'|'company'|'city'|'pay'|'unit'|'schedule'|'plan'>;
export type Application={id:string;jobId:string;name:string;contact:string;message:string;dates:string[];snapshot:ApplicationSnapshot;jobRevision:number;currentJobRevision:number;jobStatus:string;status:'submitted'|'reviewed'|'withdrawn';revision:number;createdAt:number;updatedAt:number};
export const applicationLabels={submitted:'Илгээсэн',reviewed:'Ажил олгогч үзсэн',withdrawn:'Цуцалсан'};
export function validateApplicationDates(plan:SchedulePlan|null|undefined,dates:string[],now=Date.now()){
 const fail=(message:string):never=>{throw new DomainError(400,message)};
 if(new Set(dates).size!==dates.length)fail('Сонгосон өдрүүд давхардсан байна.');
 if(plan?.mode==='selected'){
  const offered=plan.days.map(d=>d.date);
  if(!dates.length||dates.some(d=>!offered.includes(d)||d<tokyoDate(now)))fail('Зар дээрх ирээдүйн өдрүүдээс сонгоно уу.');
  if(plan.team==='same'&&dates.length!==offered.length)fail('Ижил багийн ажилд бүх өдрөөр хүсэлт өгнө.');
 }else{
  if(dates.length)fail('Энэ зарын хуваарийг бүхэлд нь зөвшөөрнө үү.');
  if(plan&&plan.start<tokyoDate(now))fail('Энэ ажлын эхлэх өдөр өнгөрсөн байна.');
 }
}
