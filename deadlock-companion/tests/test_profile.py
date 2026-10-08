import unittest
from profile_stats import analyze

def games(n=20):
    return [{'summary':dict(hero_id=1,game_mode=1,match_mode=1,player_match_outcome=1,start_time=i,match_duration_s=600,player_kills=2,player_deaths=2,player_assists=3,net_worth=1000,denies=0)} for i in range(n)]

class ProfileTests(unittest.TestCase):
    def test_empty(self):
        r=analyze([],('1','1','1'));self.assertEqual(r['total'],0);self.assertIsNone(r['metrics'][0]['recent'])
    def test_separation_and_order(self):
        rows=games();rows[0]['summary']['hero_id']=2;rows[1]['summary']['game_mode']=2;rows[2]['summary']['player_match_outcome']=5
        r=analyze(rows,('1','1','1'));self.assertEqual(r['total'],17);self.assertEqual(r['recent'][0]['start_time'],19);self.assertEqual(r['previous'][0]['start_time'],9)
    def test_missing_is_not_zero(self):
        rows=games()
        for m in rows[10:]:m['summary'].pop('net_worth')
        r=analyze(rows,('1','1','1'));self.assertIsNone(r['metrics'][0]['recent']);self.assertEqual(r['metrics'][0]['n'],0)
    def test_small_samples(self):
        r=analyze(games(14),('1','1','1'));self.assertEqual(r['priorities'],[]);self.assertIsNone(r['metrics'][1]['delta'])
    def test_survival_direction(self):
        rows=games()
        for m in rows[10:]:m['summary']['player_deaths']=4
        r=analyze(rows,('1','1','1'));self.assertEqual(r['priorities'][0]['label'],'Survival');self.assertEqual(r['priorities'][0]['pct'],100)
    def test_zero_baseline_and_bad_values(self):
        rows=games()
        for m in rows[10:]:m['summary']['denies']=1;m['summary']['net_worth']=float('nan')
        r=analyze(rows,('1','1','1'));self.assertIsNone(r['metrics'][4]['pct']);self.assertEqual(r['metrics'][4]['delta'],1);self.assertIsNone(r['metrics'][0]['recent'])
    def test_rate_normalization(self):
        rows=games()
        for m in rows[10:]:m['summary']['match_duration_s']=1200;m['summary']['player_deaths']=4
        r=analyze(rows,('1','1','1'));self.assertEqual(r['metrics'][1]['pct'],0)
