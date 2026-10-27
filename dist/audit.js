(() => {
 'use strict';
 const MAX_ACTIONS=100,MAX_REQUESTS=25;
 let enabled=false;
 try{enabled=sessionStorage.getItem('venture-audit-enabled')==='true'}catch{}
 let actions=[],activeAction=null,nextId=1;
 const nativeFetch=window.fetch.bind(window);
 const panel=document.createElement('section');panel.id='requestAudit';panel.className='request-audit';panel.hidden=true;panel.setAttribute('aria-labelledby','auditTitle');
 panel.innerHTML='<div class="audit-heading"><h2 id="auditTitle">API request audit</h2><div><button type="button" id="auditClear">Clear log</button><button type="button" id="auditClose" aria-label="Disable and close API audit">×</button></div></div><details class="audit-info"><summary>Endpoints and logging details</summary><p class="audit-help">Records button clicks, form submissions, filter changes and fetch requests while enabled. Local-only actions make no API request. Background refreshes appear separately. Logs stay in this tab’s memory; request bodies, headers and response content are not recorded. URLs can contain your search terms. Fonts, scripts and navigation are not included.</p><div class="audit-endpoints"><strong>App data:</strong> <code>./signals.json</code> · <code>./ideas.json</code><br><strong>Reddit snapshot:</strong> <code>./reddit.json</code><br><strong>Live research:</strong> <code>https://hn.algolia.com/api/v1/search_by_date</code> · <code>https://en.wikipedia.org/w/api.php</code></div></details><p id="auditSummary" class="audit-summary" role="status" aria-live="polite"></p><ol id="auditEntries" class="audit-entries"></ol>';
 document.body.append(panel);
 panel.querySelectorAll(".audit-endpoints code").forEach((code,index)=>{if(index<3)code.textContent=new URL(["signals.json","ideas.json","reddit.json"][index],location.href).href});
 const toggle=document.createElement('button');toggle.type='button';toggle.id='auditToggle';toggle.className='outline';toggle.setAttribute('aria-controls',panel.id);
 (document.querySelector('.top-right')||document.body).append(toggle);
 const list=panel.querySelector('#auditEntries'),summary=panel.querySelector('#auditSummary');
 function safeURL(raw){try{const url=new URL(String(raw),location.href);url.username='';url.password='';for(const key of [...url.searchParams.keys()])if(/token|secret|password|authorization|api[_-]?key|signature|^sig$/i.test(key))url.searchParams.set(key,'[redacted]');return url.href}catch{return '(URL unavailable)'}}
 function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}
 function render(){
  if(!enabled)return;
  list.replaceChildren();
  for(const action of [...actions].reverse()){
   const row=node('li','audit-action');row.append(node('strong','',action.label),node('time','audit-time',new Date(action.at).toLocaleTimeString()));
   if(!action.requests.length)row.append(node('p','audit-local',action.automatic?'No fetch requests recorded yet.':'Local UI action · No API request recorded.'));
   for(const request of action.requests){
    const block=node('div','audit-request');
    const state=request.error?'Network error':request.status===null?'Pending':`HTTP ${request.status}${request.ok?'':' · failed'}`;
    block.append(node('div','audit-result',`${request.method} · ${state}${request.duration===null?'':` · ${Math.round(request.duration)} ms`}`),node('code','audit-url',request.url));
    if(request.error)block.append(node('p','audit-error',request.error));
    row.append(block);
   }
   if(action.truncated)row.append(node('p','audit-local','Additional requests for this action are omitted.'));
   list.append(row);
  }
  const count=actions.reduce((n,a)=>n+a.requests.length,0);
  summary.textContent=actions.length?`${actions.length} action/group(s) · ${count} fetch request(s) · latest ${MAX_ACTIONS} groups retained`:'Logging enabled. Click an app button or change a filter. Reload the page to capture initial JSON requests.';
 }
 function setEnabled(value){enabled=value;panel.hidden=!value;toggle.textContent=`API audit: ${value?'On':'Off'}`;toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-pressed',String(value));try{sessionStorage.setItem('venture-audit-enabled',String(value))}catch{}if(value)render()}
 function addAction(label,automatic=false){const action={id:nextId++,label,at:Date.now(),automatic,requests:[]};actions.push(action);if(actions.length>MAX_ACTIONS)actions.shift();render();return action}
 function context(label){activeAction=addAction(label);const owned=activeAction;queueMicrotask(()=>{if(activeAction===owned)activeAction=null})}
 document.addEventListener('click',event=>{
  if(!enabled||event.target.closest('#requestAudit,#auditToggle'))return;
  const button=event.target.closest('button,input[type="button"],input[type="submit"]');if(!button)return;
  context('Click: '+(button.getAttribute('aria-label')||button.textContent||button.value||button.id||'Button').replace(/\s+/g,' ').trim().slice(0,160));
 },true);
 document.addEventListener('submit',event=>{if(enabled&&!activeAction&&!event.target.closest('#requestAudit'))context('Submit: '+(event.target.id||'form'))},true);
 document.addEventListener('change',event=>{if(!enabled||event.target.closest('#requestAudit'))return;const target=event.target;if(!target.matches('select,input[type="checkbox"]'))return;const label=target.getAttribute('aria-label')||target.id||'Control';context('Change: '+label+' → '+(target.type==='checkbox'?(target.checked?'On':'Off'):target.value))},true);
 window.fetch=function(input,options){
  if(!enabled)return nativeFetch(input,options);
  const action=activeAction||addAction('Automatic/background request',true);
  if(action.requests.length>=MAX_REQUESTS){action.truncated=true;render();return nativeFetch(input,options)}
  const entry={method:String(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase(),url:safeURL(input instanceof Request?input.url:input),status:null,ok:false,duration:null,error:null};
  const start=performance.now();action.requests.push(entry);render();
  // Observe a separate promise branch and return the original fetch promise unchanged.
  let result;
  try{result=nativeFetch(input,options)}catch(error){entry.error='Request could not start';entry.duration=performance.now()-start;render();throw error}
  result.then(response=>{entry.status=response.status;entry.ok=response.ok;entry.duration=performance.now()-start;render()},()=>{entry.error='Fetch failed, was blocked, or was cancelled. See browser network details if needed.';entry.duration=performance.now()-start;render()});
  return result;
 };
 toggle.addEventListener('click',()=>setEnabled(!enabled));
 panel.querySelector('#auditClose').addEventListener('click',()=>{setEnabled(false);toggle.focus()});
 panel.querySelector('#auditClear').addEventListener('click',()=>{actions=[];render()});
 setEnabled(enabled);
})();
