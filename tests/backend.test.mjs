import test from 'node:test';
import assert from 'node:assert/strict';
import { handle,normalizeResearch } from '../backend/worker.mjs';
const origin='https://sanjeevk20.github.io';
const env={ALLOWED_ORIGIN:origin,OPENAI_API_KEY:'test-not-a-real-key'};
const request=(body,extra={})=>new Request('https://worker.example/api/research',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
const source='https://example.com/india-report';
const evidence={output:[{type:'web_search_call',action:{sources:[{url:source,title:'India report'}]}}]};
const idea={title:'A focused shop service',country_evidence:'One reported pilot',trend_status:'supported',confidence:'high',pilot_budget:{currency:'INR',minimum:1000,maximum:5000,assumptions:['Manual pilot']},sources:[{url:source,title:'Source',supports:'Pilot evidence'},{url:'https://invented.example/report',title:'Invented'}]};
test('sources must occur in provider evidence; single-publisher claims are downgraded',()=>{
 const result=normalizeResearch({ideas:[idea]},evidence,'India');
 assert.equal(result.ideas[0].sources.length,1);assert.equal(result.ideas[0].trend_status,'emerging');assert.equal(result.ideas[0].confidence,'low');
 assert.equal(normalizeResearch({ideas:[{...idea,sources:[{url:'https://invented.example'}]}]},evidence,'India').ideas.length,0);
});
test('origin, missing configuration, malformed input and quotas stop paid calls',async()=>{
 let calls=0;const fetch=async()=>{calls++;throw new Error('should not call')};
 const badOrigin=request({query:'Dukaan',country:'India'},{Origin:'https://evil.example'});
 assert.equal((await handle(badOrigin,env,{}, {fetch})).status,403);
 assert.equal((await handle(request({query:'Dukaan'}),{}, {},{fetch})).status,503);
 assert.equal((await handle(request({query:'x',country:'India'}),env,{}, {fetch})).status,400);
 assert.equal((await handle(request({query:'Dukaan',country:'Unknown'}),env,{}, {fetch})).status,400);
 assert.equal((await handle(request({query:'Dukaan'}),{...env,RESEARCH_LIMIT:{limit:async()=>({success:false})}}, {},{fetch})).status,429);
 assert.equal(calls,0);
});
test('provider failures never leak credentials or become sample research',async()=>{
 const result=await handle(request({query:'Dukaan',country:'India'}),env,{}, {fetch:async()=>new Response('secret internal error',{status:401})});
 assert.equal(result.status,502);const text=await result.text();assert.ok(!text.includes(env.OPENAI_API_KEY));assert.ok(!text.includes('internal error'));
});
test('successful web research returns cited results and a country-specific budget',async()=>{
 let body;
 const fetch=async(url,options)=>{body=JSON.parse(options.body);return Response.json({...evidence,status:'completed',output:[...evidence.output,{type:'message',content:[{type:'output_text',text:JSON.stringify({interpretation:'Dukaan platform and local shops',ideas:[idea],limitations:[]})}]}]})};
 const result=await handle(request({query:'Dukaan',country:'India'}),env,{}, {fetch});
 assert.equal(result.status,200);assert.equal(result.headers.get('Access-Control-Allow-Origin'),origin);
 const data=await result.json();assert.equal(data.country,'India');assert.equal(data.ideas[0].pilot_budget.currency,'INR');assert.equal(data.ideas.length,1);assert.equal(body.tools[0].type,'web_search');assert.equal(body.store,false);
});
test('cached requests avoid a second paid provider call',async()=>{
 let stored=null,calls=0;
 const cache={match:async()=>stored?.clone(),put:async(k,v)=>{stored=v}};
 const fetch=async()=>{calls++;return Response.json({...evidence,output:[...evidence.output,{content:[{type:'output_text',text:JSON.stringify({ideas:[idea]})}]}]})};
 const first=await handle(request({query:'Dukaan',country:'India'}),env,{}, {fetch,cache});assert.equal(first.status,200);
 const second=await handle(request({query:'Dukaan',country:'India'}),env,{}, {fetch,cache});assert.equal((await second.json()).cached,true);assert.equal(calls,1);
});
test('invalid currency estimates and reversed budget ranges are removed',()=>{
 const result=normalizeResearch({ideas:[{...idea,pilot_budget:{currency:'USD',minimum:1,maximum:10}}]},evidence,'India');assert.equal(result.ideas[0].pilot_budget.minimum,null);
 const result2=normalizeResearch({ideas:[{...idea,pilot_budget:{currency:'INR',minimum:100,maximum:10}}]},evidence,'India');assert.equal(result2.ideas[0].pilot_budget.maximum,null);
});
