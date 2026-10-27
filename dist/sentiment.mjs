export function filterSentiment(items,query='',source='all') {
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return (Array.isArray(items)?items:[]).filter(item=>(source==='all'||item.source===source)&&terms.every(term=>[item.title,item.excerpt,item.source,...(item.matched_keywords||[])].join(' ').toLowerCase().includes(term)));
}
export function sourceURL(raw){try{const u=new URL(raw);if(u.protocol!=='https:')return null;if(u.hostname==='news.ycombinator.com'&&u.pathname==='/item'&&/^\d+$/.test(u.searchParams.get('id')||''))return u.href;if(u.hostname==='github.com'&&/^\/[^/]+\/[^/]+\/issues\/\d+$/.test(u.pathname))return u.href;if(u.hostname==='www.reddit.com'&&/^\/r\/[^/]+\/comments\//.test(u.pathname))return u.href;return null}catch{return null}}
if(typeof document!=='undefined') {
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let snapshot=null;
 const date=raw=>raw&&!Number.isNaN(new Date(raw).getTime())?new Date(raw).toLocaleString():'Date unavailable';
 function render(){
  const query=$('#sentimentQuery').value.trim(),source=$('#sentimentSource').value,items=filterSentiment(snapshot?.items,query,source);
  $('#sentimentStatus').textContent=snapshot?`${items.length} matching excerpt(s) · Snapshot updated ${date(snapshot.generated_at)}`:'Snapshot unavailable. Use the external searches below to read sources directly.';
  $('#sentimentResults').innerHTML=items.slice(0,24).flatMap(item=>{const url=sourceURL(item.url);return url?[`<article class="signal-card"><div class="tag">${esc(item.source)} · ${esc(item.kind)}</div><h3><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a></h3><blockquote class="complaint-excerpt">${esc(item.excerpt)}</blockquote><p class="source-meta">Possible negative language · matched: ${esc((item.matched_keywords||[]).join(', '))}</p><p class="source-meta">${esc(date(item.published_at))} · <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Read full context at ${esc(item.source)} ↗</a></p></article>`]:[]}).join('')||'<p class="notice">No matching excerpts in this snapshot. Try fewer keywords or use the source searches below. No negative rating or sentiment score has been invented.</p>';
  $('#sentimentWarnings').textContent=(snapshot?.errors||[]).map(e=>e.source+': '+e.message).join(' ');
  const topic=query||'customer support';const q='"'+topic.replaceAll('"','')+'" (complaint OR frustrated OR disappointing)';
  const searches=[['Hacker News','https://hn.algolia.com/?'+new URLSearchParams({query:topic+' frustrated',type:'comment',sort:'byDate',dateRange:'all',prefix:'false',page:'0'})],['GitHub issues','https://github.com/search?'+new URLSearchParams({q:topic+' frustrated is:issue',type:'issues'})],['Trustpilot reviews','https://www.google.com/search?'+new URLSearchParams({q:'site:trustpilot.com/review/ '+q})],['G2 reviews','https://www.google.com/search?'+new URLSearchParams({q:'site:g2.com/products/ '+q})],['Capterra reviews','https://www.google.com/search?'+new URLSearchParams({q:'site:capterra.com '+q})]];
  $('#sentimentLinks').innerHTML=searches.map(([name,url])=>`<a class="market-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)} search ↗</a>`).join(' · ');
 }
 $('#sentimentForm').addEventListener('submit',e=>{e.preventDefault();render()});$('#sentimentSource').addEventListener('change',render);
 async function initialize(){try{const r=await fetch(new URL('sentiment.json',import.meta.url),{cache:'no-store'});if(!r.ok)throw new Error();const d=await r.json();if(!Array.isArray(d.items))throw new Error();snapshot=d}catch{}render()}
 initialize();
}
