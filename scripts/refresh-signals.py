"""Build a timestamped public news feed for the static Pages artifact (no AI keys)."""
import concurrent.futures, datetime, email.utils, json, pathlib, urllib.parse, urllib.request, xml.etree.ElementTree as ET
COUNTRIES={"India":("IN","en-IN","IN:en"),"United States":("US","en-US","US:en"),"United Kingdom":("GB","en-GB","GB:en"),"Canada":("CA","en-CA","CA:en"),"Australia":("AU","en-AU","AU:en"),"Germany":("DE","en","DE:en"),"Singapore":("SG","en-SG","SG:en"),"United Arab Emirates":("AE","en","AE:en")}
TOPICS={"Small business & ecommerce":"small business ecommerce", "AI & automation":"AI startup automation", "Local services & sustainability":"local business sustainability"}
def parse_feed(raw,country,topic,feed_url):
    root=ET.fromstring(raw)
    result=[]
    for item in root.findall('./channel/item')[:5]:
        title=item.findtext('title','').strip(); link=item.findtext('link','').strip()
        if not title or urllib.parse.urlparse(link).scheme!='https': continue
        raw_date=item.findtext('pubDate','')
        try: published=email.utils.parsedate_to_datetime(raw_date).isoformat()
        except (ValueError,TypeError,IndexError): published=None
        source=item.find('source')
        result.append({'title':title,'url':link,'publisher':source.text if source is not None else 'Google News index','published_at':published,'country':country,'topic':topic,'feed_url':feed_url})
    return result
def fetch_feed(country,topic,keywords):
    gl,hl,ceid=COUNTRIES[country]
    params=urllib.parse.urlencode({'q':f'{keywords} "{country}" when:30d','gl':gl,'hl':hl,'ceid':ceid})
    url='https://news.google.com/rss/search?'+params
    req=urllib.request.Request(url,headers={'User-Agent':'VentureSignal/1.0 (public news research)'})
    try:
        with urllib.request.urlopen(req,timeout=15) as response: raw=response.read(2_000_000)
        return parse_feed(raw,country,topic,url),None
    except Exception: return [],{'country':country,'topic':topic,'message':'News feed unavailable'}
def main():
    signals=[];errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        tasks=[pool.submit(fetch_feed,country,topic,q) for country in COUNTRIES for topic,q in TOPICS.items()]
        for task in concurrent.futures.as_completed(tasks):
            items,error=task.result();signals.extend(items)
            if error:errors.append(error)
    unique={}
    for item in signals: unique.setdefault((item['country'],item['url']),item)
    signals=sorted(unique.values(),key=lambda item:item['published_at'] or '',reverse=True)
    output={'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ok' if signals else 'unavailable','source':'Google News RSS index','signals':signals,'errors':errors,'limitations':['News mentions are not proof of demand or popularity. Country relevance is keyword-based, not verified geolocation. Headlines link through Google News to publishers. Refreshed on deployment and approximately every six hours; schedules may be delayed.']}
    pathlib.Path('dist').mkdir(exist_ok=True)
    pathlib.Path('dist/signals.json').write_text(json.dumps(output,ensure_ascii=False),encoding='utf-8')
    print(f"Published {len(signals)} news signals; {len(errors)} feeds unavailable.")
if __name__=='__main__': main()
