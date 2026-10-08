"""Local recording and public-data adapters. Python 3.11+, Windows recording."""
from __future__ import annotations
import csv, io, json, math, os, re, shutil, sqlite3, subprocess, threading, time, uuid
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse

BASE_ID = 76561197960265728
API = 'https://api.deadlock-api.com'
HEROES = ('Mina', 'Warden', 'Abrams', 'Pocket')
SCENE = 'Eternus - Deadlock'

def account_id(value):
    value = str(value).strip()
    m = re.fullmatch(r'\[U:1:(\d+)\]', value)
    if m: value = m[1]
    if value.startswith(('http://', 'https://')):
        u = urlparse(value)
        if u.hostname not in ('steamcommunity.com', 'www.steamcommunity.com') or not u.path.startswith('/profiles/'):
            raise ValueError('Use a numeric Steam account ID, SteamID64, or steamcommunity.com/profiles/ URL. Vanity names need a numeric ID.')
        value = u.path.split('/')[2]
    if not value.isdigit(): raise ValueError('Enter your numeric Steam ID. You can leave this blank until you are ready to sync.')
    n = int(value)
    if n >= BASE_ID: n -= BASE_ID
    if not 0 < n < 2**32: raise ValueError('Steam account ID is out of range.')
    return n

def seconds(value):
    if isinstance(value, bool): return None
    try:
        n = float(value)
        return n if math.isfinite(n) and 0 <= n <= 24*3600 else None
    except (TypeError, ValueError): return None

def stamp(s):
    s = max(0, int(s)); return f'{s//3600:02}:{s//60%60:02}:{s%60:02}'

def parse_clock(value):
    value = str(value).strip()
    if ':' not in value:
        n = seconds(value)
        if n is None: raise ValueError('Enter seconds or HH:MM:SS.')
        return n
    bits = value.split(':')
    if len(bits) not in (2,3) or any(not b.isdigit() for b in bits): raise ValueError('Enter MM:SS or HH:MM:SS.')
    ns = list(map(int,bits))
    if any(n >= 60 for n in ns[1:]): raise ValueError('Minutes and seconds must be below 60.')
    return sum(n*60**i for i,n in enumerate(reversed(ns)))

def unpack_info(payload):
    if isinstance(payload,list): payload = payload[0] if payload else {}
    if not isinstance(payload,dict): return {}
    info = payload.get('match_info', payload)
    return info if isinstance(info,dict) else {}

def events_from_metadata(payload):
    """Only explicitly seconds-labelled fields are accepted; no tick/time guessing.
    Schemas must be calibrated on a real match. Sampled counts are intervals,
    never presented as exact kill times. Missing data remains missing.
    """
    info = unpack_info(payload)
    players = info.get('players', [])
    if not isinstance(players,list): return [], 'Unsupported metadata: players list unavailable.'
    events=[]; represented=set(); slots={p.get('player_slot'):p.get('account_id') for p in players if isinstance(p,dict) and p.get('player_slot') is not None}
    for p in players:
        if not isinstance(p,dict): continue
        aid=p.get('account_id'); details=p.get('death_details')
        if not isinstance(details,list): continue
        found=False
        for d in details:
            if not isinstance(d,dict): continue
            t=next((seconds(d[k]) for k in ('game_time_s','death_time_s','time_stamp_s') if k in d and seconds(d[k]) is not None),None)
            if t is None: continue
            found=True
            events.append({'kind':'Death','account_id':aid,'seconds':t,'earliest':t,'count':1,'source':'metadata death; verify alignment','other':slots.get(d.get('killer_player_slot'))})
            killer=slots.get(d.get('killer_player_slot'))
            if killer is not None and killer != aid:
                events.append({'kind':'Kill','account_id':killer,'seconds':t,'earliest':t,'count':1,'source':'metadata killer; verify alignment','other':aid})
        if found: represented.add((aid,'Death'))
    # Avoid mixing partially available exact kill rows with sampled kill counts.
    for e in events: represented.add((e['account_id'],e['kind']))
    for p in players:
        if not isinstance(p,dict): continue
        stats=p.get('stats');aid=p.get('account_id')
        if isinstance(stats,dict):
            ts=stats.get('time_stamp_s', stats.get('game_time_s', []))
            if isinstance(ts,list):
                stats=[dict(time_stamp_s=t, **{k:v[i] for k,v in stats.items() if k not in ('time_stamp_s','game_time_s') and isinstance(v,list) and len(v)>i}) for i,t in enumerate(ts)]
        if not isinstance(stats,list): continue
        rows=[]
        for row in stats:
            if not isinstance(row,dict): continue
            t=next((seconds(row[k]) for k in ('time_stamp_s','game_time_s') if k in row and seconds(row[k]) is not None),None)
            if t is not None: rows.append((t,row))
        rows.sort(key=lambda x:x[0])
        for key,kind in (('kills','Kill'),('deaths','Death')):
            if (aid,kind) in represented: continue
            previous=None
            for t,row in rows:
                n=row.get(key)
                if not isinstance(n,int) or isinstance(n,bool) or n<0: continue
                if previous and n>previous[1]:
                    events.append({'kind':kind,'account_id':aid,'seconds':t,'earliest':previous[0],'count':n-previous[1],'source':'sampled counter interval','other':None})
                previous=(t,n)
    unique={json.dumps(e,sort_keys=True):e for e in events}
    out=sorted(unique.values(),key=lambda e:(e['seconds'],str(e['account_id']),e['kind']))
    return out, (f'{len(out)} recognized event rows. Confirm against one real replay; intervals are approximate.' if out else 'No supported event timeline found. This does not mean there were no kills or deaths.')

class Store:
    def __init__(self,path):
        self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as c:
            c.executescript('''CREATE TABLE IF NOT EXISTS matches(account INTEGER, id TEXT, summary TEXT, metadata TEXT, fetched REAL, PRIMARY KEY(account,id));
            CREATE TABLE IF NOT EXISTS recordings(id TEXT PRIMARY KEY, start REAL, end REAL, path TEXT, status TEXT);
            CREATE TABLE IF NOT EXISTS links(account INTEGER, match_id TEXT, recording TEXT, offset REAL, PRIMARY KEY(account,match_id));
            CREATE TABLE IF NOT EXISTS notes(account INTEGER, match_id TEXT, body TEXT, PRIMARY KEY(account,match_id));
            CREATE TABLE IF NOT EXISTS lessons(id INTEGER PRIMARY KEY, status TEXT, notes TEXT);
            CREATE TABLE IF NOT EXISTS markers(id TEXT PRIMARY KEY, recording TEXT, seconds REAL, kind TEXT);''')
    def connect(self):
        c=sqlite3.connect(self.path,timeout=15);c.row_factory=sqlite3.Row;return c
    def summaries(self,account,rows):
        with self.connect() as c:
            for r in rows:
                if not isinstance(r,dict) or not str(r.get('match_id','')).isdigit(): continue
                if r.get('account_id') is not None and int(r['account_id'])!=account: continue
                c.execute('INSERT INTO matches(account,id,summary) VALUES(?,?,?) ON CONFLICT(account,id) DO UPDATE SET summary=excluded.summary',(account,str(r['match_id']),json.dumps(r)))
    def matches(self,account):
        with self.connect() as c: rows=c.execute('SELECT id,summary,metadata FROM matches WHERE account=?',(account,)).fetchall()
        return sorted([{'id':r['id'],'summary':json.loads(r['summary']),'metadata':json.loads(r['metadata']) if r['metadata'] else None} for r in rows],key=lambda r:r['summary'].get('start_time',0),reverse=True)
    def metadata(self,account,mid,payload):
        with self.connect() as c:c.execute('UPDATE matches SET metadata=?, fetched=? WHERE account=? AND id=?',(json.dumps(payload),time.time(),account,str(mid)))
    def rec_start(self):
        rid=str(uuid.uuid4())
        with self.connect() as c:c.execute('INSERT INTO recordings VALUES(?,?,NULL,NULL,?)',(rid,time.time(),'recording'))
        return rid
    def rec_end(self,rid,path,status='saved'):
        with self.connect() as c:c.execute('UPDATE recordings SET end=?,path=?,status=? WHERE id=?',(time.time(),path,status,rid))
    def recordings(self):
        with self.connect() as c:return [dict(r) for r in c.execute('SELECT * FROM recordings ORDER BY start DESC')]
    def link(self,account,mid,rid,offset):
        with self.connect() as c:c.execute('INSERT INTO links VALUES(?,?,?,?) ON CONFLICT(account,match_id) DO UPDATE SET recording=excluded.recording,offset=excluded.offset',(account,str(mid),rid,offset))
    def linked(self,account,mid):
        with self.connect() as c:
            r=c.execute('SELECT recordings.*,links.offset FROM links JOIN recordings ON recordings.id=links.recording WHERE links.account=? AND links.match_id=?',(account,str(mid))).fetchone()
            return dict(r) if r else None
    def save_note(self,account,mid,body):
        with self.connect() as c:c.execute('INSERT INTO notes VALUES(?,?,?) ON CONFLICT(account,match_id) DO UPDATE SET body=excluded.body',(account,str(mid),body))
    def note(self,account,mid):
        with self.connect() as c:
            r=c.execute('SELECT body FROM notes WHERE account=? AND match_id=?',(account,str(mid))).fetchone();return r[0] if r else ''
    def save_lesson(self,lid,status,notes):
        with self.connect() as c:c.execute('INSERT INTO lessons VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,notes=excluded.notes',(lid,status,notes))
    def lesson(self,lid):
        with self.connect() as c:
            r=c.execute('SELECT status,notes FROM lessons WHERE id=?',(lid,)).fetchone();return tuple(r) if r else ('Not started','')
    def mark(self,rid,when,kind):
        with self.connect() as c:c.execute('INSERT INTO markers VALUES(?,?,?,?)',(str(uuid.uuid4()),rid,when,kind))
    def backup(self,dest):
        with self.connect() as source, sqlite3.connect(dest) as target:source.backup(target)

class Api:
    def __init__(self): self.backoff_until=0
    def get(self,path):
        if time.time()<self.backoff_until:raise RuntimeError('Data provider requested a pause. Try again later.')
        req=Request(API+path,headers={'User-Agent':'EternusCompanion/0.1 personal-training','Accept':'application/json'})
        try:
            with urlopen(req,timeout=18) as r:
                raw=r.read(40*1024*1024+1)
                if len(raw)>40*1024*1024:raise RuntimeError('Response exceeds the local import size limit.')
                return json.loads(raw)
        except HTTPError as e:
            if e.code==429:
                try:delay=min(3600,max(60,int(e.headers.get('Retry-After','600'))))
                except ValueError:delay=600
                self.backoff_until=time.time()+delay
                raise RuntimeError(f'Provider rate limit. Waiting at least {delay//60} minutes before another request.') from e
            if e.code in (403,404):raise RuntimeError('Data is unavailable or access is restricted. Your existing records are unchanged.') from e
            raise RuntimeError(f'Data service returned HTTP {e.code}. Try later.') from e
    def history(self,account):
        result=self.get(f'/v1/players/{account}/match-history')
        if not isinstance(result,list):raise RuntimeError('Unexpected match-history format. No records replaced.')
        return result
    def detail(self,mid):return self.get(f'/v1/matches/{int(mid)}/metadata?disable_steam=true')
    def heroes(self):
        raw=self.get('/v1/assets/heroes');raw=raw if isinstance(raw,list) else list(raw.values()) if isinstance(raw,dict) else []
        return {str(h['id']):h['name'] for h in raw if isinstance(h,dict) and 'id' in h and isinstance(h.get('name'),str)}

def game_running(names):
    if os.name!='nt':raise RuntimeError('Automatic game detection is available on Windows.')
    r=subprocess.run(['tasklist','/FO','CSV','/NH'],capture_output=True,text=True,timeout=8,creationflags=0x08000000)
    if r.returncode:raise RuntimeError('Windows process list could not be read.')
    wanted={n.strip().lower() for n in names.split(',') if n.strip()}
    return any(row and row[0].lower() in wanted for row in csv.reader(io.StringIO(r.stdout)))

class Recorder:
    """Never adopts or stops an existing recording. One socket, serialized use."""
    def __init__(self,store,notify):
        self.store=store;self.notify=notify;self.client=None;self.lock=threading.RLock();self.owned=None;self.started=0;self.output_dir=None;self.prior_scene=None
    def connect(self,port,password):
        with self.lock:
            if self.owned:raise RuntimeError('Stop the current app recording before reconnecting.')
            import obsws_python as obs
            self.close_socket(); self.client=obs.ReqClient(host='127.0.0.1',port=int(port),password=password,timeout=5)
            return self.call('GetVersion').get('obsVersion','Connected')
    def close_socket(self):
        if self.client:
            try:self.client.base_client.ws.close()
            except Exception:pass
            self.client=None
    def call(self,name,data=None):
        if not self.client:raise RuntimeError('Connect to OBS first.')
        return self.client.send(name,data or {},raw=True) or {}
    def validate(self):
        if self.call('GetStreamStatus').get('outputActive'):raise RuntimeError('OBS is streaming. Stop streaming before using automatic recording.')
        scene=self.call('GetCurrentProgramScene').get('currentProgramSceneName')
        if scene!=SCENE:raise RuntimeError(f'Select the OBS scene "{SCENE}" before arming recording.')
        items=self.call('GetSceneItemList',{'sceneName':SCENE}).get('sceneItems',[])
        visible=[i for i in items if i.get('sceneItemEnabled')]
        if not visible:raise RuntimeError('The recording scene has no enabled capture source.')
        for item in visible:
            inp=self.call('GetInputSettings',{'inputName':item['sourceName']})
            if inp.get('inputKind')!='game_capture':raise RuntimeError('Use only Game Capture sources in this scene; no desktop/window/browser sources.')
            settings=inp.get('inputSettings',{})
            if settings.get('capture_mode')!='window' or not re.search(r':(?:citadel|deadlock)\.exe$',settings.get('window',''),re.I):
                raise RuntimeError('Set Game Capture to Capture specific window and choose Deadlock (citadel.exe).')
        if self.call('GetRecordStatus').get('outputActive') and not self.owned:raise RuntimeError('OBS already has a recording. This app will not take it over.')
        directory=self.call('GetRecordDirectory').get('recordDirectory')
        if not directory or not Path(directory).is_dir():raise RuntimeError('Choose an existing recording folder in OBS settings.')
        self.output_dir=directory
    def start(self):
        with self.lock:
            if self.owned:return
            self.validate()
            if shutil.disk_usage(self.output_dir).free<10*1024**3:raise RuntimeError('Less than 10 GB free in the OBS recording drive. Free space before recording.')
            self.call('StartRecord')
            # If this response or DB write fails, leave OBS visible for manual recovery.
            self.started=time.time()
            try:self.owned=self.store.rec_start()
            except Exception:
                self.call('StopRecord');raise
            self.notify('Recording Deadlock session. OBS audio follows your selected profile.')
    def stop(self):
        with self.lock:
            if not self.owned:return None
            rid=self.owned
            result=self.call('StopRecord') # retain ownership on failure so it can be retried
            path=result.get('outputPath')
            self.store.rec_end(rid,path,'saved' if path else 'path unavailable')
            self.owned=None
            self.notify('Recording saved: '+str(path or 'check OBS recording folder'))
            return path
    def check(self):
        with self.lock:
            if not self.owned:return
            state=self.call('GetRecordStatus')
            if not state.get('outputActive'):
                self.store.rec_end(self.owned,None,'Stopped outside app; locate file in OBS folder');self.owned=None
                raise RuntimeError('Recording was stopped in OBS. Monitoring disarmed to avoid restarting it.')
            if state.get('outputPaused'):raise RuntimeError('Recording paused in OBS. Resume or stop there; alignment may be discontinuous.')
            if shutil.disk_usage(self.output_dir).free<5*1024**3:
                self.stop();raise RuntimeError('Recording stopped because less than 5 GB remains. No files were deleted.')
            if self.call('GetCurrentProgramScene').get('currentProgramSceneName')!=SCENE:
                self.stop();raise RuntimeError('Scene changed. App recording stopped.')
    def mark(self,kind):
        with self.lock:
            if not self.owned:raise RuntimeError('No app-owned recording is running.')
            # OBS duration follows the file timeline more closely than wall time.
            t=self.call('GetRecordStatus').get('outputDuration',0)/1000
            self.store.mark(self.owned,t,kind)
            return t
