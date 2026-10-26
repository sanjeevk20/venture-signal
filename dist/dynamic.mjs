import {searchBriefs} from './idea-index.mjs';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=raw=>{try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
const dateLabel=raw=>{const d=new Date(raw);return raw&&!Number.isNaN(d.getTime())?d.toLocaleString():'Date unavailable'};
let feed=null,briefs=null;
function renderSignals(){
 const country=$('#dynamicCountry').value,topic=$('#signalTopic').value;
 const rows=feed?.signals?.filter(s=>s.country===country&&(topic==='all'||s.topic===topic))||[];
 $('#signalStatus').textContent=feed?`Updated ${dateLabel(feed.generated_at)} · ${rows.length} matching headlines for ${country}`:'News feed unavailable.';
 $('#newsSignals').innerHTML=rows.slice(0,9).map(s=>{const url=safeURL(s.url);return url?`<article class="signal-card"><div class="tag">${esc(s.topic)}</div><h3><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></h3><p>${esc(s.publisher)} · ${esc(dateLabel(s.published_at))}</p></article>`:''}).join('')||'<p class="notice">No headlines are available for these filters. Try another topic or country. Refreshes run approximately every six hours; delays and source failures can occur.</p>';
 const warnings=feed?.errors?.filter(x=>x.country===country)||[];
 $('#signalWarnings').textContent=warnings.length?`${warnings.length} topic feed(s) could not be retrieved for this country.`:'';
}
function renderIdeas(){
 const country=$('#dynamicCountry').value,topic=$('#signalTopic').value,query=$('#aiQuery').value.trim();
 const ideas=searchBriefs(briefs?.ideas,country,topic,query);
 $('#aiStatus').textContent=briefs?`${ideas.length} matching brief(s) for ${country} · Snapshot updated ${dateLabel(briefs.generated_at)}. Search filters this snapshot; it does not start a new web search.`:'Idea briefs unavailable. Please try again later; news and live discussion research are independent.';
 const paragraph=(label,text)=>text?`<h4>${label}</h4><p>${esc(text)}</p>`:'';
 $('#aiResults').innerHTML=ideas.map(i=>{
 const sources=(i.sources||[]).flatMap(s=>{const url=safeURL(s.url);return url?[`<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p>${esc(s.publisher)} · ${esc(dateLabel(s.published_at))}</p></li>`]:[]}).join('');
 return `<article class="generated-idea"><div class="eyebrow">${esc(i.country)} · ${esc(i.evidence_status)}</div><h3>${esc(i.title)}</h3>${paragraph('Customer problem to validate',i.problem)}${paragraph('Target customer',i.customer)}${paragraph('Suggested pilot',i.solution)}${paragraph('Country coverage',i.country_evidence)}${paragraph('First validation experiment',i.validation)}${paragraph('Risks',(i.risks||[]).join(' '))}<h4>Related headlines</h4><ul class="idea-sources">${sources}</ul><p class="source-meta">${esc(i.method)}. Headlines are topic context, not evidence that this business will succeed.</p></article>`;
 }).join('');
 if(!ideas.length&&briefs){const url='https://news.google.com/search?'+new URLSearchParams({q:(query||(topic==='all'?'business':topic))+' '+country});$('#aiResults').innerHTML=`<p class="notice">No matching briefs in this snapshot. Try broader keywords, change the topic, or <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">search Google News for your market ↗</a>. The live discussion research below is also available.</p>`}
}
$('#dynamicCountry').addEventListener('change',()=>{renderSignals();renderIdeas()});
$('#signalTopic').addEventListener('change',()=>{renderSignals();renderIdeas()});
$('#aiForm').addEventListener('submit',event=>{event.preventDefault();renderIdeas()});
async function initialize(){
 const results=await Promise.allSettled(['signals.json','ideas.json'].map(path=>fetch(new URL(path,import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()})));
 if(results[0].status==='fulfilled'&&Array.isArray(results[0].value.signals))feed=results[0].value;
 if(results[1].status==='fulfilled'&&Array.isArray(results[1].value.ideas))briefs=results[1].value;
 renderSignals();renderIdeas();$('#generateIdeas').disabled=!briefs;
}
initialize();
