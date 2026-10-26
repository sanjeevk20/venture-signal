import importlib.util,unittest
spec=importlib.util.spec_from_file_location('signals','scripts/refresh-signals.py');signals=importlib.util.module_from_spec(spec);spec.loader.exec_module(signals)
class SignalsTest(unittest.TestCase):
 def test_feed_parsing_keeps_source_and_country(self):
  raw=b'<rss><channel><item><title>Dukaan &amp; shops</title><link>https://news.google.com/rss/articles/example</link><pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate><source>Publisher</source></item></channel></rss>'
  data=signals.parse_feed(raw,'India','Ecommerce','https://news.google.com/rss/search')
  self.assertEqual(data[0]['title'],'Dukaan & shops');self.assertEqual(data[0]['country'],'India');self.assertEqual(data[0]['publisher'],'Publisher');self.assertIsNotNone(data[0]['published_at'])
 def test_unsafe_links_are_rejected(self):
  raw=b'<rss><channel><item><title>bad</title><link>javascript:alert(1)</link></item></channel></rss>'
  self.assertEqual(signals.parse_feed(raw,'India','topic','https://news.google.com'),[])
if __name__=='__main__':unittest.main()
