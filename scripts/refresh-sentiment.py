"""Collect short public complaint-language excerpts, without claiming sentiment certainty."""
import datetime,html,json,os,pathlib,re,urllib.parse,urllib.request
WORDS=['frustrated','frustrating','annoying','broken','unreliable','disappointed','terrible','hate','complaint','painful']
def plain(text):return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',str(text or '')))).strip()
def matches(text):return [word for word in WORDS if re.search(r'\b'+re.escape(word)+r'\b',text,re.I)]
def excerpt(text):
    text=plain(text);first=min((m.start() for word in WORDS for m in re.finditer(r'\b'+word+r'\b',text,re.I)),default=0)
    start=max(0,first-55);return ('…' if start else '')+text[start:start+180]+('…' if len(text)>start+180 else '')
def hn_items(payload):
    items=[]
    for hit in payload.get('hits',[]):
        raw=plain(hit.get('comment_text'));signals=matches(raw);identifier=str(hit.get('objectID',''))
        if not signals or not identifier.isdigit():continue
        items.append({'id':'hn-'+identifier,'source':'Hacker News','kind':'Comment','title':plain(hit.get('story_title'))[:200] or 'Discussion comment','excerpt':excerpt(raw),'url':'https://news.ycombinator.com/item?id='+identifier,'published_at':hit.get('created_at'),'matched_keywords':signals,'label':'Possible negative language · keyword rule'})
    return items

def github_items(payload):
    items=[]
    for issue in payload.get('items',[]):
        title=plain(issue.get('title'));body=plain(issue.get('body'));signals=matches(title+' '+body)
        url=issue.get('html_url','');parsed=urllib.parse.urlparse(url)
        if not signals or parsed.scheme!='https' or parsed.hostname!='github.com' or not re.fullmatch(r'/[^/]+/[^/]+/issues/\d+',parsed.path):continue
        items.append({'id':'gh-'+str(issue.get('id')),'source':'GitHub','kind':'Issue report','title':title[:200],'excerpt':excerpt(body if matches(body) else title),'url':url,'published_at':issue.get('created_at'),'matched_keywords':signals,'label':'Possible negative language · keyword rule'})
    return items

def main():
    now=datetime.datetime.now(datetime.timezone.utc);since=now-datetime.timedelta(days=30);items=[];errors=[]
    def get(url):
        req=urllib.request.Request(url,headers={'User-Agent':'VentureSignalResearch/1.0 (github.com/sanjeevk20/venture-signal)','Accept':'application/json'})
        with urllib.request.urlopen(req,timeout=15) as r:return json.loads(r.read(3_000_000))
    for word in ['frustrated','annoying','broken']:
        url='https://hn.algolia.com/api/v1/search_by_date?'+urllib.parse.urlencode({'query':word,'tags':'comment','numericFilters':'created_at_i>='+str(int(since.timestamp())),'hitsPerPage':15})
        try:items.extend(hn_items(get(url)))
        except Exception:errors.append({'source':'Hacker News','message':'Comment retrieval unavailable for one search.'})
    url='https://api.github.com/search/issues?'+urllib.parse.urlencode({'q':'is:issue is:open frustrated created:>='+since.date().isoformat(),'sort':'updated','order':'desc','per_page':20})
    try:items.extend(github_items(get(url)))
    except Exception:errors.append({'source':'GitHub','message':'Public issue retrieval unavailable.'})
    try:
        reddit=json.loads(pathlib.Path('dist/reddit.json').read_text())
        for post in reddit.get('posts',[]):
            signals=matches(post['title'])
            if signals:items.append({'id':'reddit-'+post['id'],'source':'Reddit','kind':'Post title','title':post['title'],'excerpt':post['title'][:180],'url':post['url'],'published_at':post['created_at'],'matched_keywords':signals,'label':'Possible negative language · keyword rule'})
        if reddit.get('status')!='ok':errors.append({'source':'Reddit','message':'Reddit snapshot unavailable; direct Reddit searches remain available.'})
    except Exception:errors.append({'source':'Reddit','message':'Reddit snapshot unavailable.'})
    unique={item['url']:item for item in items};items=sorted(unique.values(),key=lambda i:i.get('published_at') or '',reverse=True)[:70]
    output={'generated_at':now.isoformat(),'status':'ok' if items else 'unavailable','items':items,'errors':errors,'method':'English complaint-keyword matching, not AI sentiment analysis','limitations':['Keywords may occur in praise, quotations, negation, technical descriptions or sarcasm. Read the source before interpreting sentiment.','This is a small scheduled sample of public comments, issue reports and available post titles. It is not representative of all users or sites.','Excerpts are shortened and may omit context. No author names, profiles, ratings or complete comment bodies are stored.','No country-level sentiment, severity ranking or willingness to pay is inferred.']}
    pathlib.Path('dist/sentiment.json').write_text(json.dumps(output,ensure_ascii=False),encoding='utf-8')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('sentiment_count='+str(len(items))+'\n')
    print(f"Collected {len(items)} source-linked language signals; {len(errors)} source/search errors.")
if __name__=='__main__':main()
