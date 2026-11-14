import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { service, type Database } from '../../../lib/service';
import { assertSameOrigin, DomainError } from '../../../lib/domain';
export const dynamic='force-dynamic';
async function context(){const u=await getChatGPTUser();const adminEmail=(env as unknown as Record<string,string>).AJIL_ADMIN_EMAIL;return service(env.DB as unknown as Database,u?{userId:u.userId,displayName:u.displayName,isAdmin:!!adminEmail&&u.email.toLowerCase()===adminEmail.toLowerCase()}:null)}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
const error=(e:unknown)=>{if(e instanceof DomainError)return json({error:e.message},e.status);console.error('AJIL request failed',e instanceof Error?e.message:'unknown');return json({error:'Сервертэй холбогдоход алдаа гарлаа. Дахин оролдоно уу.'},500)};
export async function GET(){try{return json(await (await context()).state())}catch(e){return error(e)}}
export async function POST(request:Request){try{assertSameOrigin(request);if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON хүсэлт шаардлагатай.'},415);const text=await request.text();if(text.length>16000)return json({error:'Хүсэлт хэт том байна.'},413);let body;try{body=JSON.parse(text)}catch{return json({error:'JSON буруу байна.'},400)}const s=await context();return json(await s.mutate(body?.action,body?.payload))}catch(e){return error(e)}}
