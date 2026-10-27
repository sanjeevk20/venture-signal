import importlib.util,unittest
spec=importlib.util.spec_from_file_location('reddit','scripts/refresh-reddit.py');reddit=importlib.util.module_from_spec(spec);spec.loader.exec_module(reddit)
class RedditTest(unittest.TestCase):
 def payload(self,**changes):
  data={'id':'abc','title':'Delivery problem','permalink':'/r/india/comments/abc/delivery/','subreddit':'india','num_comments':120,'created_utc':1000,'author':'not-collected','selftext':'not-collected'};data.update(changes);return {'data':{'children':[{'data':data}]}}
 def test_public_metadata_and_real_counts_only(self):
  result=reddit.parse_posts(self.payload())[0];self.assertEqual(result['num_comments'],120);self.assertNotIn('author',result);self.assertNotIn('selftext',result);self.assertEqual(result['url'],'https://www.reddit.com/r/india/comments/abc/delivery/')
 def test_missing_count_is_not_fabricated(self):self.assertIsNone(reddit.parse_posts(self.payload(num_comments=None))[0]['num_comments'])
 def test_unsafe_removed_and_adult_posts_excluded(self):
  self.assertEqual(reddit.parse_posts(self.payload(permalink='https://evil.example')),[]);self.assertEqual(reddit.parse_posts(self.payload(over_18=True)),[]);self.assertEqual(reddit.parse_posts(self.payload(removed_by_category='deleted')),[])
if __name__=='__main__':unittest.main()
