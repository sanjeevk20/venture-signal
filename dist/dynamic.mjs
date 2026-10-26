const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=raw=>{try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
const dateLabel=raw=>{const d=new Date(raw);return raw&&!Number.isNaN(d.getTime())?d.toLocaleString():'Date unavailable'};
let feed=null,apiBase='',requestController=null;
function renderSignals(){
 const country=$('#dynamicCountry').value,topic=$('#signalTopic').value;
 const rows=feed?.signals?.filter(s=>s.country===country&&(topic==='all'||s.topic===topic))||[];
 $('#signalStatus').textContent=feed?`Updated ${dateLabel(feed.generated_at)} · ${rows.length} matching headlines for ${country}`:'Loading public news…';
 $('#newsSignals').innerHTML=rows.slice(0,9).map(s=>{const url=safeURL(s.url);return url?`<article class="signal-card"><div class="tag">${esc(s.topic)}</div><h3><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></h3><p>${esc(s.publisher)} · ${esc(dateLabel(s.published_at))}</p></article>`:''}).join('')||'<p class="notice">No headlines are available for these filters. Try another topic or country. The feed refreshes on deployment and approximately every six hours; delays and source failures can occur.</p>';
 const warnings=feed?.errors?.filter(x=>x.country===country)||[];
 $('#signalWarnings').textContent=warnings.length?`${warnings.length} topic feed(s) could not be retrieved for this country.`:'';
}
function renderIdeas(data){
 const ideas=Array.isArray(data.ideas)?data.ideas:[];
 const limitations=Array.isArray(data.limitations)?data.limitations:[];
 const paragraph=(label,text)=>text?`<h4>${label}</h4><p>${esc(text)}</p>`:'';
 $('#aiResults').innerHTML=`<p class="notice">${esc(data.interpretation||'')}<br>Researched ${esc(dateLabel(data.researched_at))}${data.cached?' · Reused research from the last six hours':''}</p>`+(ideas.length?ideas.map(i=>{
  const sources=(Array.isArray(i.sources)?i.sources:[]).flatMap(s=>{const url=safeURL(s.url);return url?[`<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.publisher||url)} ↗</a><p>${esc(s.supports)}${s.published_at?' · '+esc(dateLabel(s.published_at)):''}</p></li>`]:[]}).join('');
  const budget=i.pilot_budget;const estimate=budget&&Number.isFinite(budget.minimum)&&Number.isFinite(budget.maximum)?`${budget.currency} ${budget.minimum.toLocaleString()}–${budget.maximum.toLocaleString()} (estimate)`:'Not estimated';
  return `<article class="generated-idea"><div class="eyebrow">${esc(data.country)} · ${esc(String(i.trend_status||'insufficient_evidence').replaceAll('_',' '))}</div><h3>${esc(i.title)}</h3>${paragraph('Customer problem',i.problem)}${paragraph('Target customer',i.customer)}${paragraph('Proposed solution',i.solution)}${paragraph('Country evidence',i.country_evidence)}${paragraph('Why now',i.why_now)}${paragraph('Alternatives',Array.isArray(i.competitors)?i.competitors.join(' · '):'')}${paragraph('Differentiation',i.differentiation)}${paragraph('Business model',i.business_model)}${paragraph('Pilot budget',estimate)}${paragraph('Budget assumptions',Array.isArray(budget?.assumptions)?budget.assumptions.join(' '):'')}${paragraph('First validation experiment',i.validation)}${paragraph('Risks',Array.isArray(i.risks)?i.risks.join(' '):'')}<h4>Sources</h4><ul class="idea-sources">${sources}</ul><p class="source-meta">Evidence confidence: ${esc(i.confidence||'low')} · AI synthesis; verify claims with the sources.</p></article>`;
 }).join(''):'<p class="notice">No ideas with verifiable source links were returned. Try more specific keywords or a broader topic.</p>')+`<div class="research-disclaimer">${limitations.map(esc).join('<br>')}</div>`;
}
$('#dynamicCountry').addEventListener('change',()=>{renderSignals();$('#aiResults').replaceChildren();$('#aiStatus').textContent=apiBase?'Ready to research in '+$('#dynamicCountry').value: 'AI idea generation is pending backend setup. Live news and the discussion search below remain available.';});
$('#signalTopic').addEventListener('change',renderSignals);
$('#aiForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!apiBase)return;
 const query=$('#aiQuery').value.trim();if(query.length<2)return;
 if(requestController)requestController.abort();const controller=new AbortController();requestController=controller;
 const timer=setTimeout(()=>controller.abort(),65000),button=$('#generateIdeas');button.disabled=true;button.textContent='Researching the web…';$('#aiResults').replaceChildren();$('#aiStatus').textContent='Searching sources and preparing country-specific ideas. This can take up to a minute.';
 try{
  const response=await fetch(apiBase+'/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,country:$('#dynamicCountry').value}),signal:controller.signal});
  const data=await response.json();if(!response.ok)throw new Error(data.message||'Research service unavailable. Please try later.');
  renderIdeas(data);$('#aiStatus').textContent=`Research completed for “${query}” in ${data.country}.`;
 }catch(error){$('#aiStatus').textContent=controller.signal.aborted?'Research timed out. Try a narrower query.':error.message||'Unable to contact the research service.';}
 finally{clearTimeout(timer);button.disabled=false;button.textContent='Generate sourced ideas ↗';}
});
async function initialize(){
 const results=await Promise.allSettled([
  fetch(new URL('signals.json',import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()}),
  fetch(new URL('config.json',import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()})
 ]);
 if(results[0].status==='fulfilled'&&Array.isArray(results[0].value.signals)){feed=results[0].value;renderSignals()}else{$('#signalStatus').textContent='The news feed is unavailable. The discussion research below remains available.';}
 if(results[1].status==='fulfilled'){
  const raw=results[1].value.apiBaseUrl;
  if(raw){try{const url=new URL(raw);if(url.protocol==='https:'&&/^venture-signal-api\.[a-z0-9.-]+\.workers\.dev$/.test(url.hostname)){apiBase=url.origin}}catch{}}
 }
 $('#generateIdeas').disabled=!apiBase;
 $('#aiStatus').textContent=apiBase?'Ready for country-specific web research. Research is cached for up to six hours.':'AI idea generation is pending backend setup. Live news and the discussion search below remain available.';
}
initialize();
