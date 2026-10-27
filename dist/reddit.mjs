export function redditSearchURL(query,community='all') {
 const clean=String(query).trim().slice(0,100),complaint='(rant OR frustrated OR annoying OR "wish there was" OR problem)';
 const url=new URL(community==='all'?'https://www.reddit.com/search/':`https://www.reddit.com/r/${encodeURIComponent(community)}/search/`);
 url.search=new URLSearchParams({q:clean?`(${clean}) ${complaint}`:complaint,sort:'comments',t:'year',...(community==='all'?{}:{restrict_sr:'on'})});return url.href;
}
export function filterPosts(posts,query='',community='all',minimum=0) {
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return (Array.isArray(posts)?posts:[]).filter(p=>(community==='all'||p.subreddit.toLowerCase()===community.toLowerCase())&&(minimum===0||Number.isInteger(p.num_comments)&&p.num_comments>=minimum)&&terms.every(t=>(p.title+' '+p.subreddit).toLowerCase().includes(t))).sort((a,b)=>(b.num_comments??-1)-(a.num_comments??-1));
}
if(typeof document!=='undefined') {
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let snapshot=null;
 function render(){
  const query=$('#redditQuery').value.trim(),community=$('#redditCommunity').value,minimum=Number($('#redditMinimum').value);
  const posts=filterPosts(snapshot?.posts,query,community,minimum);
  $('#redditExternal').href=redditSearchURL(query,community);
  $('#redditStatus').textContent=snapshot?`${posts.length} matching discussion(s) in the snapshot · Updated ${new Date(snapshot.generated_at).toLocaleString()}`:'Reddit snapshot unavailable. You can still open the searches below on Reddit.';
  $('#redditPosts').innerHTML=posts.slice(0,20).flatMap(p=>{
   let url;try{url=new URL(p.url);if(url.protocol!=='https:'||url.hostname!=='www.reddit.com'||!url.pathname.startsWith('/r/'))return []}catch{return []}
   return [`<article class="signal-card"><div class="tag">r/${esc(p.subreddit)}</div><h3><a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(p.title)} ↗</a></h3><p>${Number.isInteger(p.num_comments)?p.num_comments.toLocaleString()+' comments at refresh':'Comment count unavailable'}</p><p class="research-disclaimer">Open the thread to read the conversation and verify context.</p></article>`];
  }).join('')||'<p class="notice">No matching posts were retrieved. Reddit may restrict anonymous API access, or this small snapshot may not cover your query. Open Reddit search to see available threads directly.</p>';
  $('#redditAvailability').textContent=snapshot?.errors?.map(e=>e.message).join(' ')||'';
 }
 $('#redditForm').addEventListener('submit',e=>{e.preventDefault();render()});
 ['redditCommunity','redditMinimum'].forEach(id=>$('#'+id).addEventListener('change',render));
 async function initialize(){try{const response=await fetch(new URL('reddit.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();if(!Array.isArray(data.posts))throw new Error();snapshot=data}catch{}render()}
 initialize();
}
