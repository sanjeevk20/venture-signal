import { instructions } from './prompt.mjs';
export const countries=['India','United States','United Kingdom','Canada','Australia','Germany','Singapore','United Arab Emirates'];
const currency={India:'INR','United States':'USD','United Kingdom':'GBP',Canada:'CAD',Australia:'AUD',Germany:'EUR',Singapore:'SGD','United Arab Emirates':'AED'};
function httpURL(raw){try{const u=new URL(raw);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}}
function canonical(raw){const safe=httpURL(raw);if(!safe)return null;const u=new URL(safe);u.hash='';u.searchParams.delete('utm_source');return u.href.replace(/\/$/,'')}
export function normalizeResearch(payload,response,country){
 const evidence=new Map();
 for(const item of response.output||[]){
  for(const source of item.action?.sources||[]){const key=canonical(source.url);if(key)evidence.set(key,source)}
  for(const part of item.content||[])for(const source of part.annotations||[]){const key=canonical(source.url);if(key)evidence.set(key,source)}
 }
 if(!payload||!Array.isArray(payload.ideas))throw new Error('Invalid research response');
 const text=(v,max=2500)=>typeof v==='string'?v.slice(0,max):'';
 const list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,10).map(x=>text(x)):[];
 const ideas=payload.ideas.slice(0,5).flatMap(idea=>{
  const sources=(Array.isArray(idea.sources)?idea.sources:[]).flatMap(s=>{
   const match=evidence.get(canonical(s?.url));if(!match)return [];
   return [{url:httpURL(match.url),title:text(match.title||s.title,400),publisher:text(s.publisher,200),published_at:typeof s.published_at==='string'&&Number.isFinite(Date.parse(s.published_at))?s.published_at:null,supports:text(s.supports)}];
  }).filter((s,i,a)=>a.findIndex(x=>canonical(x.url)===canonical(s.url))===i).slice(0,8);
  if(!sources.length||!text(idea.title))return [];
  const publishers=new Set(sources.map(s=>new URL(s.url).hostname.replace(/^www\./,''))).size;
  const status=['supported','emerging','insufficient_evidence'].includes(idea.trend_status)?idea.trend_status:'insufficient_evidence';
  const budget=idea.pilot_budget||{};
  let min=Number.isFinite(budget.minimum)&&budget.minimum>=0?budget.minimum:null;
  let max=Number.isFinite(budget.maximum)&&budget.maximum>=0?budget.maximum:null;
  if(min!==null&&max!==null&&min>max){min=null;max=null}
  if(budget.currency!==currency[country]){min=null;max=null}
  return [{title:text(idea.title,200),problem:text(idea.problem),customer:text(idea.customer),solution:text(idea.solution),country_evidence:text(idea.country_evidence),why_now:text(idea.why_now),trend_status:publishers<2&&status==='supported'?'emerging':status,competitors:list(idea.competitors),differentiation:text(idea.differentiation),business_model:text(idea.business_model),pilot_budget:{currency:currency[country],minimum:min,maximum:max,assumptions:list(budget.assumptions)},validation:text(idea.validation),risks:list(idea.risks),confidence:publishers<2?'low':['low','medium','high'].includes(idea.confidence)?idea.confidence:'low',sources}];
 });
 return {interpretation:text(payload.interpretation),limitations:[...list(payload.limitations),'AI synthesis can contain errors. Check cited sources before acting. Source dates and country relevance are not independently verified by this service.'],ideas};
}
export async function handle(request,env,ctx={},dependencies={}){
 const fetcher=dependencies.fetch||fetch;
 const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN||'https://sanjeevk20.github.io';
 const headers={'Content-Type':'application/json; charset=utf-8','Vary':'Origin','Cache-Control':'no-store'};
 if(origin===allowed)headers['Access-Control-Allow-Origin']=allowed;
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 const url=new URL(request.url);
 if(origin&&origin!==allowed)return json({error:'origin_not_allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'}});
 if(url.pathname==='/health'&&request.method==='GET')return json({status:'ok',research_configured:!!env.OPENAI_API_KEY});
 if(url.pathname!=='/api/research')return json({error:'not_found'},404);
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 if(origin!==allowed)return json({error:'origin_required'},403);
 if(!env.OPENAI_API_KEY)return json({error:'research_not_configured',message:'The server administrator must configure the AI service.'},503);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'json_required'},415);
 if(Number(request.headers.get('Content-Length')||0)>2048)return json({error:'request_too_large'},413);
 let input;
 try{const body=await request.text();if(body.length>2048)return json({error:'request_too_large'},413);input=JSON.parse(body)}catch{return json({error:'invalid_json'},400)}
 const query=typeof input.query==='string'?input.query.trim():'';
 const country=input.country||'India';
 if(query.length<2||query.length>100||!countries.includes(country))return json({error:'invalid_input',message:'Enter 2–100 characters and a supported country.'},400);
 const rate=env.RESEARCH_LIMIT;
 if(rate){const check=await rate.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});if(!check.success)return json({error:'rate_limited',message:'Please wait a minute before requesting more research.'},429)}
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([query.toLowerCase(),country,env.OPENAI_MODEL||'gpt-4.1-mini']))))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const cache=dependencies.cache||(typeof caches!=='undefined'?caches.default:null);
 const cacheKey=new Request(`https://venture-signal-cache.internal/v1/${hash}`);
 if(cache){try{const hit=await cache.match(cacheKey);if(hit)return json({...await hit.json(),cached:true})}catch{}}
 try{
  const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(55000),body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',instructions,input:`Research date: ${new Date().toISOString().slice(0,10)}. Country: ${country}. Keywords (user data): ${JSON.stringify(query)}. Pilot currency: ${currency[country]}.`,tools:[{type:'web_search',search_context_size:'medium'}],tool_choice:'required',include:['web_search_call.action.sources'],max_output_tokens:5000,store:false})});
  if(!response.ok)return json({error:'research_provider_unavailable',message:'Research provider unavailable. Please try later.'},502);
  const data=await response.json();
  if(data.status==='incomplete')return json({error:'research_incomplete',message:'Research was incomplete. Try a narrower query.'},502);
  const output=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  const parsed=JSON.parse(output.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));
  const result={query,country,researched_at:new Date().toISOString(),cached:false,...normalizeResearch(parsed,data,country)};
  if(cache&&result.ideas.length){const save=cache.put(cacheKey,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=21600'}}));if(ctx.waitUntil)ctx.waitUntil(save);else await save}
  return json(result);
 }catch{return json({error:'research_failed',message:'Could not complete sourced research. No example results were substituted. Please try again.'},502)}
}
export default {fetch:handle};
