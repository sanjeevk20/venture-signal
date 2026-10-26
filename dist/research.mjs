export function analyzeCounts(current, previous) {
  const change = previous > 0 ? Math.round((current - previous) / previous * 100) : null;
  let summary;
  if (current === 0 && previous === 0) summary = 'No matching stories in either 30-day period. This is a coverage gap, not evidence that the idea has no demand. Try broader or alternative keywords.';
  else if (previous === 0) summary = `${current} matching stories appeared in the last 30 days, versus none in the prior period. A percentage change cannot be calculated from a zero baseline.`;
  else if (current < 5 || previous < 5) summary = `Discussion volume is sparse (${current} versus ${previous} stories). A small change in story count can produce a large percentage swing; gather more evidence before drawing conclusions.`;
  else summary = `Matching story volume is ${change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged'}${change === 0 ? '' : ` ${Math.abs(change)}%`} compared with the preceding 30 days. This measures discussion attention, not customer willingness to pay.`;
  return { change, summary };
}
export async function requestJson(url, signal, fetcher = fetch) {
  const response = await fetcher(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.json();
}
export async function researchIdea(query, signal, fetcher = fetch, now = Date.now()) {
  const end = Math.floor(now / 1000), start = end - 30 * 86400, prior = start - 30 * 86400;
  const hn = (from, to, count) => {
    const url = new URL('https://hn.algolia.com/api/v1/search_by_date');
    url.search = new URLSearchParams({ query, tags: 'story', numericFilters: `created_at_i>=${from},created_at_i<${to}`, hitsPerPage: String(count) });
    return requestJson(url, signal, fetcher).then(data => {
      if (!Number.isFinite(data.nbHits) || !Array.isArray(data.hits)) throw new Error('Unexpected discussion data');
      return data;
    });
  };
  const wiki = new URL('https://en.wikipedia.org/w/api.php');
  wiki.search = new URLSearchParams({ action: 'opensearch', search: query, limit: '5', namespace: '0', format: 'json', origin: '*' });
  const [current, previous, background] = await Promise.allSettled([hn(start,end,12),hn(prior,start,0),requestJson(wiki,signal,fetcher)]);
  return { current, previous, background, start, end, prior, query, checkedAt: now };
}
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeExternal(raw) { try {const url=new URL(raw);return ['https:','http:'].includes(url.protocol)?url.href:null;} catch{return null;} }
export function resultMarkup(result) {
  const {current, previous, background} = result;
  const currentOK=current.status==='fulfilled', previousOK=previous.status==='fulfilled';
  const analysis=currentOK&&previousOK?analyzeCounts(current.value.nbHits,previous.value.nbHits):null;
  const number=value=>Number(value).toLocaleString();
  let html=`<div class="live-stats"><div class="live-stat"><small>Matching stories · latest 30 days</small><strong>${currentOK?number(current.value.nbHits):'Unavailable'}</strong></div><div class="live-stat"><small>Matching stories · preceding 30 days</small><strong>${previousOK?number(previous.value.nbHits):'Unavailable'}</strong></div><div class="live-stat"><small>Change in story volume</small><strong>${analysis&&analysis.change!==null?`${analysis.change>0?'+':''}${analysis.change}%`:'N/A'}</strong></div></div>`;
  if(analysis)html+=`<div class="live-summary">${esc(analysis.summary)}</div>`;
  if(!currentOK||!previousOK)html+='<div class="research-warning">Discussion data could not be fully retrieved. No estimate has been substituted. Check your internet connection and try refreshing.</div>';
  html+='<div class="research-columns"><div><h3>Recent matching discussions</h3>';
  if(currentOK){const hits=current.value.hits;html+=hits.length?hits.map(hit=>{
    const id=String(hit.objectID);if(!/^\d+$/.test(id))return '';
    const date=new Date(hit.created_at);const dateLabel=Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
    const source=safeExternal(hit.url);
    return `<div class="source-row"><a target="_blank" rel="noopener noreferrer" href="https://news.ycombinator.com/item?id=${id}">${esc(hit.title||'Untitled discussion')} ↗</a><div class="source-meta">${esc(dateLabel)} · ${number(hit.points||0)} points · ${number(hit.num_comments||0)} comments${source?` · <a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Original source ↗</a>`:''}</div></div>`;
  }).join(''):'<p>No matching stories in this period. Try fewer keywords.</p>';}else html+='<p>Source unavailable.</p>';
  html+='</div><div><h3>Background reading · Wikipedia</h3>';
  if(background.status==='fulfilled'&&Array.isArray(background.value)&&Array.isArray(background.value[1])&&Array.isArray(background.value[3])){
    const titles=background.value[1],urls=background.value[3];html+=titles.length?titles.map((title,index)=>{const url=safeExternal(urls[index]);return url&&new URL(url).hostname==='en.wikipedia.org'?`<div class="source-row"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a></div>`:''}).join(''):'<p>No related background pages found.</p>';
  }else html+='<p>Background source unavailable. Discussion results are independent.</p>';
  html+='<h3>What to validate next</h3><p>Review whether these sources describe your target customer’s problem. Then interview potential buyers, compare alternatives, and test a paid pilot. Internet attention alone does not establish a viable business.</p></div></div>';
  const date=s=>new Date(s*1000).toISOString().slice(0,10);
  return html+`<p class="research-disclaimer">Window boundaries (UTC): ${date(result.start)} → ${date(result.end)}; previous ${date(result.prior)} → ${date(result.start)}. Full-text keyword matches from Algolia’s Hacker News index; latest 12 stories shown. Counts can change as the index updates.</p>`;
}
if(typeof document!=='undefined') {
  const form=document.querySelector('#researchForm'),input=document.querySelector('#researchQuery'),status=document.querySelector('#researchStatus'),output=document.querySelector('#researchResults'),button=form.querySelector('button');
  let controller=null,activeQuery='',busy=false;
  async function run(query){
    if(controller)controller.abort();controller=new AbortController();const owned=controller;busy=true;activeQuery=query;button.disabled=true;button.textContent='Researching…';status.textContent=`Fetching live sources for “${query}”…`;output.replaceChildren();
    const timer=setTimeout(()=>owned.abort(),20000);
    try{
      const result=await researchIdea(query,owned.signal);
      if(controller!==owned)return;
      if(owned.signal.aborted)throw new Error('timeout');
      output.innerHTML=resultMarkup(result);
      const any=result.current.status==='fulfilled'||result.previous.status==='fulfilled'||result.background.status==='fulfilled';
      status.textContent=any?`Results for “${query}” · Retrieved ${new Date(result.checkedAt).toLocaleString()}`:'Live sources unavailable. Check your connection and try again.';
    }catch(error){if(controller===owned)status.textContent=owned.signal.aborted?'Research timed out. Please try again.':'Unable to load sources. Check your connection and try again.';}
    finally{clearTimeout(timer);if(controller===owned){busy=false;button.disabled=false;button.textContent='Analyze idea ↗';}}
  }
  form.addEventListener('submit',e=>{e.preventDefault();const query=input.value.trim();if(query.length<2){input.setCustomValidity('Enter at least two characters.');input.reportValidity();return}input.setCustomValidity('');run(query)});
  input.addEventListener('input',()=>input.setCustomValidity(''));
  const refresh=()=>{if(document.querySelector('#autoRefresh').checked&&activeQuery&&!busy&&!document.hidden)run(activeQuery)};
  setInterval(refresh,300000);
}
