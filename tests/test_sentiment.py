import importlib.util,unittest
spec=importlib.util.spec_from_file_location('sentiment','scripts/refresh-sentiment.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class SentimentTest(unittest.TestCase):
 def test_keyword_rules_are_explicit_and_not_claimed_as_sentiment(self):
  self.assertEqual(module.matches('This is BROKEN and frustrating.'),['frustrating','broken']);self.assertEqual(module.matches('hatefully'),[])
  self.assertEqual(module.matches('not broken'),['broken'])  # Deliberate limitation disclosed in the product.
 def test_hn_comments_are_short_source_linked_and_without_author_fields(self):
  items=module.hn_items({'hits':[{'objectID':'123','story_title':'Checkout','comment_text':'<p>'+('prefix '*70)+'frustrated with checkout '+('suffix '*70)+'</p>','author':'not-collected'}]})
  self.assertEqual(items[0]['source'],'Hacker News');self.assertLessEqual(len(items[0]['excerpt']),182);self.assertIn('frustrated',items[0]['excerpt']);self.assertNotIn('author',items[0]);self.assertNotIn('<p>',items[0]['excerpt']);self.assertEqual(items[0]['url'],'https://news.ycombinator.com/item?id=123')
 def test_unmatched_and_unsafe_items_are_dropped(self):
  self.assertEqual(module.hn_items({'hits':[{'objectID':'123','comment_text':'everything works well'}]}),[])
  self.assertEqual(module.github_items({'items':[{'title':'broken','body':'frustrated','html_url':'https://evil.example'}]}),[])
 def test_github_items_identify_issue_reports_not_comments(self):
  item=module.github_items({'items':[{'id':1,'title':'Broken feature','body':'Frustrated by this issue','html_url':'https://github.com/org/repo/issues/1'}]})[0]
  self.assertEqual(item['kind'],'Issue report');self.assertEqual(item['source'],'GitHub')
if __name__=='__main__':unittest.main()
