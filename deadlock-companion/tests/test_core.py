import sys,tempfile,unittest,json
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from core import account_id,parse_clock,events_from_metadata,Store,Recorder,SCENE

class CoreTests(unittest.TestCase):
    def test_ids(self):
        for value in ('12345','[U:1:12345]','76561197960278073','https://steamcommunity.com/profiles/76561197960278073/'):
            self.assertEqual(account_id(value),12345)
    def test_bad_ids(self):
        for value in ('https://evil.example/12345','0','-1','name','999999999999999999999'):
            with self.assertRaises(ValueError):account_id(value)
    def test_clocks(self):
        self.assertEqual(parse_clock('1:02:03'),3723)
        self.assertEqual(parse_clock('03:10')-parse_clock('02:00'),70)
        with self.assertRaises(ValueError):parse_clock('1:80')
    def test_missing_not_zero_events(self):
        events,msg=events_from_metadata({'match_info':{'players':[]}})
        self.assertEqual(events,[]);self.assertIn('does not mean',msg)
    def test_counter_intervals(self):
        data={'match_info':{'players':[{'account_id':1,'stats':[{'time_stamp_s':0,'kills':0,'deaths':0},{'time_stamp_s':30,'kills':2,'deaths':1}]}]}}
        events,_=events_from_metadata(data)
        self.assertEqual(sum(e['count'] for e in events if e['kind']=='Kill'),2)
        self.assertTrue(all(e['earliest']==0 and e['seconds']==30 for e in events))
    def test_unknown_time_not_guessed(self):
        events,_=events_from_metadata({'players':[{'account_id':1,'stats':[{'time':0,'kills':0},{'time':10,'kills':1}]}]})
        self.assertEqual(events,[])
    def test_initial_nonzero_does_not_fabricate_events(self):
        events,_=events_from_metadata({'players':[{'account_id':1,'stats':[{'time_stamp_s':100,'kills':3}]}]})
        self.assertEqual(events,[])
    def test_death_and_killer_mapping(self):
        events,_=events_from_metadata({'players':[{'account_id':10,'player_slot':0,'death_details':[{'game_time_s':42,'killer_player_slot':1}]},{'account_id':20,'player_slot':1}]})
        self.assertEqual([(e['kind'],e['account_id']) for e in events],[('Death',10),('Kill',20)])
    def test_counter_columns(self):
        events,_=events_from_metadata({'players':[{'account_id':1,'stats':{'time_stamp_s':[0,30],'kills':[0,1],'deaths':[0,0]}}]})
        self.assertEqual(len(events),1)
    def test_database_account_isolation_and_updates(self):
        with tempfile.TemporaryDirectory() as d:
            st=Store(Path(d)/'db.sqlite3')
            st.summaries(1,[{'match_id':8,'account_id':1,'player_kills':2}]);st.summaries(2,[{'match_id':8,'account_id':2,'player_kills':5}])
            st.metadata(1,8,{'players':[]});st.summaries(1,[{'match_id':8,'account_id':1,'player_kills':3}])
            self.assertEqual(st.matches(1)[0]['summary']['player_kills'],3);self.assertEqual(st.matches(2)[0]['summary']['player_kills'],5)
            self.assertIsNotNone(st.matches(1)[0]['metadata'])
            st.save_note(1,8,'review');self.assertEqual(st.note(2,8),'')
            st.backup(Path(d)/'backup.sqlite3');self.assertEqual(Store(Path(d)/'backup.sqlite3').note(1,8),'review')
    def test_recording_link(self):
        with tempfile.TemporaryDirectory() as d:
            st=Store(Path(d)/'db.sqlite3');rid=st.rec_start();st.rec_end(rid,'test.mkv');st.link(1,8,rid,-12)
            self.assertEqual(st.linked(1,8)['offset'],-12);self.assertIsNone(st.linked(2,8))

class FakeOBS:
    def __init__(self,folder,recording=False):self.folder=folder;self.active=recording;self.calls=[];self.scene=SCENE;self.kind='game_capture';self.fail_stop=False
    def send(self,name,data,raw):
        self.calls.append(name)
        if name=='GetStreamStatus':return {'outputActive':False}
        if name=='GetCurrentProgramScene':return {'currentProgramSceneName':self.scene}
        if name=='GetRecordStatus':return {'outputActive':self.active,'outputPaused':False,'outputDuration':10000}
        if name=='GetSceneItemList':return {'sceneItems':[{'sourceName':'Game','sceneItemEnabled':True}]}
        if name=='GetInputSettings':return {'inputKind':self.kind,'inputSettings':{'capture_mode':'window','window':'Deadlock:SDL_app:citadel.exe'}}
        if name=='GetRecordDirectory':return {'recordDirectory':self.folder}
        if name=='StartRecord':self.active=True;return {}
        if name=='StopRecord':
            if self.fail_stop:raise TimeoutError('OBS timeout')
            self.active=False;return {'outputPath':str(Path(self.folder)/'recording.mkv')}
        return {}

class RecordingTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.store=Store(Path(self.temp.name)/'db.sqlite3');self.rec=Recorder(self.store,lambda s:None);self.obs=FakeOBS(self.temp.name);self.rec.client=self.obs
        self.disk=patch('core.shutil.disk_usage',return_value=type('Disk',(),{'free':100*1024**3})());self.disk.start();self.addCleanup(self.disk.stop)
    def test_does_not_stop_other_recording(self):
        self.obs.active=True
        with self.assertRaises(RuntimeError):self.rec.start()
        self.rec.stop();self.assertNotIn('StopRecord',self.obs.calls)
    def test_start_stop_lifecycle(self):
        self.rec.start();self.assertIsNotNone(self.rec.owned);self.rec.mark('Death');self.rec.stop();self.assertIsNone(self.rec.owned);self.assertEqual(self.store.recordings()[0]['status'],'saved')
    def test_reject_desktop_capture(self):
        self.obs.kind='monitor_capture'
        with self.assertRaises(RuntimeError):self.rec.start()
        self.assertNotIn('StartRecord',self.obs.calls)
    def test_stop_failure_retains_ownership(self):
        self.rec.start();self.obs.fail_stop=True
        with self.assertRaises(TimeoutError):self.rec.stop()
        self.assertIsNotNone(self.rec.owned)
    def test_low_space_stops_without_deleting(self):
        self.rec.start()
        with patch('core.shutil.disk_usage',return_value=type('Disk',(),{'free':1})()):
            with self.assertRaises(RuntimeError):self.rec.check()
        self.assertIsNone(self.rec.owned)
    def test_scene_change_stops(self):
        self.rec.start();self.obs.scene='Desktop'
        with self.assertRaises(RuntimeError):self.rec.check()
        self.assertIsNone(self.rec.owned)

if __name__=='__main__':unittest.main()
