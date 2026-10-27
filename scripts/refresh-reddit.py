"""Retrieve a small public Reddit discussion snapshot when anonymous access is allowed."""
import datetime,json,os,pathlib,re,urllib.error,urllib.parse,urllib.request
QUERIES=[('Business complaints','(rant OR frustrated OR annoying OR "wish there") (business OR shop OR software)'),('Small business','subreddit:smallbusiness (rant OR frustrated OR problem)'),('India communities','(subreddit:india OR subreddit:indianstartups) (rant OR frustrated OR problem)'),('Software pain points','subreddit:SaaS (frustrated OR annoying OR problem)')]
def parse_posts(payload):
    result=[]
    for row in payload.get('data',{}).get('children',[]):
        data=row.get('data',{})
        path=data.get('permalink','');community=data.get('subreddit','');title=data.get('title','')
        if data.get('over_18') or data.get('removed_by_category') or not isinstance(title,str) or title in ['[removed]','[deleted]']:continue
        if not re.fullmatch(r'[A-Za-z0-9_]{2,24}',community) or not re.fullmatch(r'/r/[A-Za-z0-9_]+/comments/[a-z0-9]+/[^\s?#]*',path):continue
        count=data.get('num_comments');count=count if isinstance(count,int) and not isinstance(count,bool) and count>=0 else None
        created=data.get('created_utc')
        try:date=datetime.datetime.fromtimestamp(created,datetime.timezone.utc).isoformat() if isinstance(created,(float,int)) else None
        except (ValueError,OverflowError,OSError):date=None
        result.append({'id':str(data.get('id','')),'title':title[:500],'url':'https://www.reddit.com'+path,'subreddit':community,'num_comments':count,'created_at':date})
    return result

def main():
    posts={};errors=[];sources=[]
    for topic,query in QUERIES:
        url='https://www.reddit.com/search.json?'+urllib.parse.urlencode({'q':query,'sort':'comments','t':'month','limit':15,'raw_json':1})
        sources.append({'topic':topic,'url':url})
        request=urllib.request.Request(url,headers={'User-Agent':'VentureSignalResearch/1.0 (public discussion links; github.com/sanjeevk20/venture-signal)','Accept':'application/json'})
        try:
            with urllib.request.urlopen(request,timeout=12) as response:payload=json.loads(response.read(2_000_000))
            for post in parse_posts(payload):posts.setdefault(post['url'],post)
        except urllib.error.HTTPError as error:
            errors.append({'topic':topic,'message':f'Reddit API unavailable (HTTP {error.code}). Use direct Reddit search links.'})
            if error.code in (401,403,429):break  # Respect access restrictions and rate limits; no host/proxy fallbacks.
        except Exception:errors.append({'topic':topic,'message':'Reddit data unavailable. Use direct Reddit search links.'})
    output={'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ok' if posts else 'unavailable','posts':sorted(posts.values(),key=lambda p:p['num_comments'] if p['num_comments'] is not None else -1,reverse=True),'errors':errors,'sources':sources,'limitations':['This is a small keyword-matched snapshot, not millions of comments or a sentiment analysis.','Only post titles, links, community names and available comment counts are stored; comments and usernames are not collected.','Complaints are clues for interviews, not proof of willingness to pay or country-level demand.']}
    pathlib.Path('dist/reddit.json').write_text(json.dumps(output,ensure_ascii=False),encoding='utf-8')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as output_file:output_file.write(f"reddit_status={output['status']}\nreddit_count={len(posts)}\n")
    print(f"Reddit snapshot: {len(posts)} discussion links; {len(errors)} unavailable request(s).")
if __name__=='__main__':main()
