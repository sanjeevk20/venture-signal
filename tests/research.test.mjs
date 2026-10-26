import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCounts,researchIdea,resultMarkup} from '../dist/research.mjs';
test('activity comparisons handle zero baselines and small samples honestly',()=>{
 assert.equal(analyzeCounts(20,10).change,100);
 assert.equal(analyzeCounts(5,10).change,-50);
 assert.equal(analyzeCounts(4,0).change,null);
 assert.match(analyzeCounts(0,0).summary,/coverage gap/);
 assert.match(analyzeCounts(2,1).summary,/sparse/);
});
test('research uses adjacent non-overlapping windows and encoded user keywords',async()=>{
 const calls=[];
 const result=await researchIdea('AI & customer support',undefined,async url=>{
  const u=new URL(url);calls.push(u);const count=calls.length===1?20:10;
  return {ok:true,json:async()=>u.hostname==='hn.algolia.com'?{nbHits:count,hits:[]}:['query',['AI'],[],['https://en.wikipedia.org/wiki/Artificial_intelligence']]};
 },Date.UTC(2026,9,26));
 assert.equal(calls[0].searchParams.get('query'),'AI & customer support');
 assert.equal(calls[0].searchParams.get('numericFilters'),`created_at_i>=${result.start},created_at_i<${result.end}`);
 assert.equal(calls[1].searchParams.get('numericFilters'),`created_at_i>=${result.prior},created_at_i<${result.start}`);
 assert.equal(result.end-result.start,30*86400);
 assert.equal(result.start-result.prior,30*86400);
 assert.match(resultMarkup(result),/100%/);
});
test('a failed source never becomes invented data',async()=>{
 const r=await researchIdea('wellness',undefined,async url=>{
  if(new URL(url).hostname==='hn.algolia.com')throw new Error('offline');
  return {ok:true,json:async()=>['wellness',['Wellness'],[],['https://en.wikipedia.org/wiki/Wellness']]};
 });
 const html=resultMarkup(r);assert.match(html,/Unavailable/);assert.match(html,/No estimate has been substituted/);assert.match(html,/wiki\/Wellness/);
});
test('external text is escaped and unsafe links are excluded',async()=>{
 const r=await researchIdea('test',undefined,async url=>({ok:true,json:async()=>new URL(url).hostname==='hn.algolia.com'?{nbHits:10,hits:[{objectID:'123',title:'<img src=x onerror=alert(1)>',url:'javascript:alert(1)',created_at:'bad'}]}:['x',['unsafe'],[],['javascript:alert(1)']]}));
 const html=resultMarkup(r);assert.ok(!html.includes('<img'));assert.ok(!html.includes('href="javascript:'));assert.match(html,/&lt;img/);
});
test('HTTP errors and malformed source responses are rejected',async()=>{
 const r=await researchIdea('test',undefined,async url=>({ok:false,status:429}));
 assert.equal(r.current.status,'rejected');assert.equal(r.background.status,'rejected');
 const malformed=await researchIdea('test',undefined,async()=>({ok:true,json:async()=>({})}));assert.equal(malformed.current.status,'rejected');
});
