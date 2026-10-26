export function searchBriefs(ideas,country,topic,query='') {
 const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return (Array.isArray(ideas)?ideas:[]).filter(i=>i.country===country&&(topic==='all'||i.topic===topic)&&terms.every(term=>[i.title,i.problem,i.customer,i.solution,i.topic,...(i.keywords||[]),...(i.sources||[]).map(s=>s.title)].join(' ').toLocaleLowerCase().includes(term)));
}
