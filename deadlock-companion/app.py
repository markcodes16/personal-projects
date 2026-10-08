from __future__ import annotations
import csv, json, os, queue, re, shutil, subprocess, sys, threading, time, traceback, uuid, webbrowser
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
from profile_stats import analyze, cohorts
from core import Store, Api, Recorder, account_id, events_from_metadata, game_running, stamp, parse_clock, unpack_info, HEROES, SCENE

ROOT=Path(__file__).resolve().parent
DATA=Path(os.environ.get('LOCALAPPDATA',Path.home()))/'EternusCompanion'
DATA.mkdir(parents=True,exist_ok=True)
WEB='https://deadlock-training-journal.masmith-g2012.chatgpt.site'

class App(tk.Tk):
    def __init__(self):
        super().__init__();self.title('Road to Eternus • Desktop Companion');self.geometry('1240x840');self.minsize(980,680)
        self.store=Store(DATA/'progress.sqlite3');self.api=Api();self.q=queue.Queue();self.rec=Recorder(self.store,lambda s:self.q.put(('log',s)))
        self.arm=threading.Event();self.quit_event=threading.Event();self.job=False;self.closing=False;self.obs_busy=False;self.settings_lock=threading.Lock()
        try:self.settings=json.loads((DATA/'settings.json').read_text())
        except (FileNotFoundError,json.JSONDecodeError):self.settings={}
        self.settings={'account':'','port':'4455','processes':'citadel.exe,deadlock.exe','tracker':'https://tracklock.gg/','vlc':'','autosync':True,**self.settings}
        try:self.hero_names=json.loads((DATA/'heroes.json').read_text())
        except (FileNotFoundError,json.JSONDecodeError):self.hero_names={}
        self.matches=[];self.events=[];self.mid=None;self.current_account=None
        self.style();self.build();self.protocol('WM_DELETE_WINDOW',self.close)
        self.after(150,self.drain);self.after(1000,self.refresh);self.after(1500,self.auto_sync)
        threading.Thread(target=self.monitor,daemon=True).start()
    def style(self):
        self.configure(bg='#111b20');s=ttk.Style(self);s.theme_use('clam')
        s.configure('.',background='#17262d',foreground='#ecf0e9',font=('Segoe UI',11))
        s.configure('TFrame',background='#111b20');s.configure('TLabel',background='#111b20',padding=3)
        s.configure('Title.TLabel',font=('Georgia',27),foreground='#f4d294')
        s.configure('Sub.TLabel',foreground='#b3c6c7');s.configure('TButton',padding=(12,8),background='#30474f')
        s.map('TButton',background=[('active','#47616b')]);s.configure('Accent.TButton',background='#b9934d',foreground='#10191c')
        s.configure('TNotebook',background='#111b20',borderwidth=0);s.configure('TNotebook.Tab',padding=(16,10));s.map('TNotebook.Tab',background=[('selected','#354c50')],foreground=[('selected','#ffe0a5')])
        s.configure('Treeview',background='#18282f',fieldbackground='#18282f',foreground='#edf0eb',rowheight=31)
        s.configure('Treeview.Heading',background='#2c444c',foreground='#f3d9a4',padding=7)
        s.map('Treeview',background=[('selected','#435f67')]);s.configure('TEntry',fieldbackground='#243b44',foreground='#edf0eb',insertcolor='white')
        s.configure('TCombobox',fieldbackground='#243b44',foreground='#edf0eb');s.map('TCombobox',fieldbackground=[('readonly','#243b44')],foreground=[('readonly','#edf0eb')])
    def text(self,parent,height=8):
        f=ttk.Frame(parent);f.pack(fill='both',expand=True,pady=6)
        t=tk.Text(f,height=height,wrap='word',font=('Segoe UI',11),bg='#17282f',fg='#ecf0e9',insertbackground='white',padx=14,pady=12,relief='flat')
        bar=ttk.Scrollbar(f,command=t.yview);t.configure(yscrollcommand=bar.set);t.pack(side='left',fill='both',expand=True);bar.pack(side='right',fill='y');return t
    def tree(self,parent,columns,widths):
        f=ttk.Frame(parent);f.pack(fill='both',expand=True,pady=8)
        t=ttk.Treeview(f,columns=columns,show='headings',selectmode='browse')
        for col,w in zip(columns,widths):t.heading(col,text=col);t.column(col,width=w,minwidth=60,stretch=True)
        y=ttk.Scrollbar(f,orient='vertical',command=t.yview);x=ttk.Scrollbar(f,orient='horizontal',command=t.xview)
        t.configure(yscrollcommand=y.set,xscrollcommand=x.set);t.grid(row=0,column=0,sticky='nsew');y.grid(row=0,column=1,sticky='ns');x.grid(row=1,column=0,sticky='ew');f.rowconfigure(0,weight=1);f.columnconfigure(0,weight=1);return t
    def button(self,parent,title,cmd,primary=False):return ttk.Button(parent,text=title,command=cmd,style='Accent.TButton' if primary else 'TButton')
    def build(self):
        top=ttk.Frame(self,padding=18);top.pack(fill='x');ttk.Label(top,text='Road to Eternus',style='Title.TLabel').pack(side='left')
        self.button(top,'Open web training app',lambda:webbrowser.open(WEB)).pack(side='right')
        ttk.Label(self,text='DESKTOP COMPANION 0.2  /  MINA · WARDEN · ABRAMS · POCKET',style='Sub.TLabel',padding=(22,0)).pack(anchor='w')
        self.tabs=ttk.Notebook(self);self.tabs.pack(fill='both',expand=True,padx=18,pady=14);self.pages={}
        for name in ('Overview','Profile','Recording','Matches','Event review','Training','Setup'):
            p=ttk.Frame(self.tabs,padding=15);self.pages[name]=p;self.tabs.add(p,text=name)
        p=self.pages['Overview'];self.summary=tk.StringVar(value='Add your Steam ID in Setup, then sync your matches.');ttk.Label(p,textvariable=self.summary,font=('Segoe UI',15),wraplength=1100).pack(anchor='w',pady=12)
        row=ttk.Frame(p);row.pack(fill='x');self.button(row,'Sync matches now',self.sync,True).pack(side='left');self.button(row,'Export match CSV',self.export_matches).pack(side='left',padx=8);self.button(row,'Back up local records',self.backup).pack(side='left')
        ttk.Label(p,text='Summary uses your latest 30 displayed matches. Queue codes and sample counts remain visible.',style='Sub.TLabel').pack(anchor='w',pady=8)
        self.hero_tree=self.tree(p,('Hero','Matches','Wins / scored','Avg K / D / A','Avg souls/min'),(180,90,160,220,150))
        ttk.Label(p,text='No secret MMR estimate. These statistics describe results; they do not diagnose decisions.',style='Sub.TLabel').pack(anchor='w')
        self.logs=self.text(p,5);self.logs.configure(state='disabled')
        p=self.pages['Profile']
        ttk.Label(p,text='Your performance profile',font=('Georgia',22)).pack(anchor='w')
        ttk.Label(p,text='Compare your latest 10 scored games with the previous 10 on the same hero and mode.\nThese are personal trends, not Eternus benchmarks. Unknown fields remain unknown.',style='Sub.TLabel').pack(anchor='w',pady=8)
        row=ttk.Frame(p);row.pack(fill='x')
        self.profile_choice=tk.StringVar();self.profile_combo=ttk.Combobox(row,textvariable=self.profile_choice,state='readonly',width=48);self.profile_combo.pack(side='left');self.profile_combo.bind('<<ComboboxSelected>>',lambda e:self.render_profile())
        self.button(row,'Open suggested lesson',self.profile_lesson,True).pack(side='left',padx=8)
        self.profile_summary=tk.StringVar(value='Sync matches to build your baseline.');ttk.Label(p,textvariable=self.profile_summary,wraplength=1040).pack(anchor='w',pady=10)
        self.profile_tree=self.tree(p,('Measure','Recent mean','Previous mean','Samples new / old','Change'),(260,140,140,170,170))
        self.profile_body=self.text(p,12);self.profile_groups={};self.suggested_lesson=1
        p=self.pages['Recording'];self.rec_status=tk.StringVar(value='Not connected. Complete the OBS setup first.');ttk.Label(p,textvariable=self.rec_status,font=('Segoe UI',15),wraplength=1050).pack(anchor='w',pady=10)
        ttk.Label(p,text='Arm monitoring to record while Deadlock runs. Menus and multiple matches may share one file.\nOBS must remain open. This app only stops recordings it started.',style='Sub.TLabel').pack(anchor='w',pady=8)
        row=ttk.Frame(p);row.pack(fill='x',pady=8)
        for name,cmd in [('Connect OBS',self.connect_obs),('Check scene',self.check_obs),('Arm auto recording',self.arm_recording),('Disarm / stop app recording',self.stop_recording)]:self.button(row,name,cmd).pack(side='left',padx=(0,8))
        row=ttk.Frame(p);row.pack(fill='x')
        self.button(row,'Start recording now',self.start_recording,True).pack(side='left');self.button(row,'Mark kill (manual)',lambda:self.marker('Kill')).pack(side='left',padx=8);self.button(row,'Mark death (manual)',lambda:self.marker('Death')).pack(side='left')
        ttk.Label(p,text='Manual marks use buttons, not in-game hotkeys. Automatic events are processed after sync when metadata supports them.',style='Sub.TLabel',wraplength=1060).pack(anchor='w',pady=10)
        self.record_tree=self.tree(p,('Started','Status','Video path'),(170,230,650))
        row=ttk.Frame(p);row.pack(fill='x');self.button(row,'Open selected recording',self.open_recording).pack(side='left');self.button(row,'Export manual marks',self.export_markers).pack(side='left',padx=8)
        p=self.pages['Matches'];row=ttk.Frame(p);row.pack(fill='x');self.filter=tk.StringVar(value='Focus heroes');combo=ttk.Combobox(row,textvariable=self.filter,values=['Focus heroes','All heroes',*HEROES],state='readonly',width=18);combo.pack(side='left');combo.bind('<<ComboboxSelected>>',lambda e:self.refresh())
        self.button(row,'Sync now',self.sync,True).pack(side='left',padx=8);self.button(row,'Load selected match details',self.details).pack(side='left');self.button(row,'Open Tracklock',self.open_tracker).pack(side='left',padx=8)
        self.match_tree=self.tree(p,('Match','Date','Hero','Result','K / D / A','Souls/min','Denies','Mode'),(100,165,110,100,115,95,70,110));self.match_tree.bind('<<TreeviewSelect>>',self.select_match)
        ttk.Label(p,text='Match notes / next practice correction').pack(anchor='w');self.match_notes=self.text(p,4);row=ttk.Frame(p);row.pack(fill='x');self.button(row,'Save match notes',self.save_note).pack(side='left');self.button(row,'Inspect all received stats',self.inspect_stats).pack(side='left',padx=8);self.button(row,'Import metadata JSON',self.import_metadata).pack(side='left')
        p=self.pages['Event review'];self.event_status=tk.StringVar(value='Select a match and load its details.');ttk.Label(p,textvariable=self.event_status,wraplength=1080).pack(anchor='w',pady=8)
        row=ttk.Frame(p);row.pack(fill='x');self.event_scope=tk.StringVar(value='My events');c=ttk.Combobox(row,textvariable=self.event_scope,values=['My events','All players'],state='readonly',width=16);c.pack(side='left');c.bind('<<ComboboxSelected>>',lambda e:self.render_events())
        self.button(row,'Link video & align clocks',self.link_video,True).pack(side='left',padx=8);self.button(row,'Open event in video',self.open_event).pack(side='left');self.button(row,'Export event CSV',self.export_events).pack(side='left',padx=8)
        self.event_tree=self.tree(p,('Game time / interval','Event','Account','Count','Evidence'),(190,90,120,60,470));self.event_tree.bind('<Double-1>',lambda e:self.open_event())
        self.link_label=tk.StringVar(value='No recording linked. A video file and one clock alignment are required.');ttk.Label(p,textvariable=self.link_label,wraplength=1060,style='Sub.TLabel').pack(anchor='w')
        ttk.Label(p,text='Counter-derived rows describe an interval, not an exact kill frame. Replay video must confirm the event.\nThis version does not read the kill feed with computer vision or provide guaranteed live kill detection.',style='Sub.TLabel').pack(anchor='w',pady=8)
        p=self.pages['Training'];guide=(ROOT/'Study-Guide.md').read_text(encoding='utf-8');self.lesson_content={int(m[1]):(m[2],m[3].strip()) for m in re.finditer(r'### Lesson (\d+) — ([^\n]+)\n(.*?)(?=\n### Lesson|\n## |\Z)',guide,re.S)}
        self.lesson_choice=tk.StringVar(value='1. '+self.lesson_content[1][0]);c=ttk.Combobox(p,textvariable=self.lesson_choice,values=[f'{k}. {v[0]}' for k,v in self.lesson_content.items()],state='readonly',width=80);c.pack(fill='x');c.bind('<<ComboboxSelected>>',lambda e:self.show_lesson());self.lesson_body=self.text(p,12)
        row=ttk.Frame(p);row.pack(fill='x');ttk.Label(row,text='Status').pack(side='left');self.lesson_status=tk.StringVar();ttk.Combobox(row,textvariable=self.lesson_status,values=['Not started','Studying','Practicing','Gate passed'],state='readonly',width=20).pack(side='left',padx=8);self.button(row,'Save local lesson progress',self.save_lesson,True).pack(side='left');self.button(row,'Open full guide',lambda:os.startfile(ROOT/'Study-Guide.md')).pack(side='left',padx=8)
        self.lesson_notes=self.text(p,4);ttk.Label(p,text='Desktop lesson records are local. They do not automatically sync with the web app.',style='Sub.TLabel').pack(anchor='w');self.show_lesson()
        p=self.pages['Setup'];self.vars={}
        for label,key in [('Steam account ID / SteamID64','account'),('OBS WebSocket port (localhost only)','port'),('Game process names, comma separated','processes'),('Tracklock profile URL (optional shortcut)','tracker'),('VLC executable (optional for timestamp playback)','vlc')]:
            row=ttk.Frame(p);row.pack(fill='x',pady=5);ttk.Label(row,text=label,width=43).pack(side='left');v=tk.StringVar(value=str(self.settings[key]));self.vars[key]=v;ttk.Entry(row,textvariable=v).pack(side='left',fill='x',expand=True)
        row=ttk.Frame(p);row.pack(fill='x',pady=5);ttk.Label(row,text='OBS password (memory only; enter each launch)',width=43).pack(side='left');self.password=tk.StringVar();ttk.Entry(row,textvariable=self.password,show='•').pack(side='left',fill='x',expand=True)
        self.autosync=tk.BooleanVar(value=self.settings['autosync']);ttk.Checkbutton(p,text='Sync every 10 minutes while this app is open',variable=self.autosync).pack(anchor='w',pady=8)
        row=ttk.Frame(p);row.pack(fill='x',pady=8);self.button(row,'Save setup',self.save_settings,True).pack(side='left');self.button(row,'Read home setup instructions',lambda:os.startfile(ROOT/'START-HERE.html')).pack(side='left',padx=8);self.button(row,'Open local data folder',lambda:os.startfile(DATA)).pack(side='left')
        instructions=f'''OBS setup (one time)
1. Install OBS Studio from obsproject.com and finish its recording setup.
2. Tools → WebSocket Server Settings: enable the server, keep authentication on, and copy its password above.
3. Create a scene named exactly: {SCENE}
4. Add Game Capture → Capture specific window → Deadlock / citadel.exe. Keep only this capture source enabled in the scene.
5. Settings → Output: choose a recording folder and MKV recording format. Review the audio mixer and mute any microphone you do not want recorded.
6. With Deadlock open, verify the OBS preview, Connect OBS, Check scene, and record a short test before arming automation.

Sync uses public Deadlock API data, not a direct Tracklock scraping feed. Keep OBS and this app open when playing. Monitoring is always off at app launch. Your files are never automatically deleted or uploaded.'''
        ttk.Label(p,text=instructions,wraplength=1080,justify='left').pack(anchor='w',pady=10)
        self.status=tk.StringVar(value='Ready • Local data: '+str(DATA));ttk.Label(self,textvariable=self.status,style='Sub.TLabel',padding=(20,7)).pack(fill='x')
    def log(self,s):
        self.status.set(s);self.logs.configure(state='normal');self.logs.insert('end',datetime.now().strftime('%H:%M:%S')+'  '+s+'\n');self.logs.see('end');self.logs.configure(state='disabled')
    def drain(self):
        while True:
            try:kind,payload=self.q.get_nowait()
            except queue.Empty:break
            if kind=='log':self.log(payload);self.rec_status.set(payload)
            elif kind=='refresh':self.job=False;self.refresh()
            elif kind=='error':self.job=False;self.obs_busy=False;self.log(payload);messagebox.showerror('Companion',payload)
            elif kind=='obsdone':self.obs_busy=False;self.log(payload);self.rec_status.set(payload);self.refresh_recordings()
            elif kind=='heroes':self.hero_names=payload
            elif kind=='events':self.render_events()
            elif kind=='closed':self.quit_event.set();self.destroy();return
        self.after(150,self.drain)
    def config(self):
        with self.settings_lock:return dict(self.settings)
    def save_settings(self):
        try:
            if self.arm.is_set() or self.rec.owned:raise ValueError('Disarm recording before changing setup.')
            d={k:v.get().strip() for k,v in self.vars.items()};port=int(d['port'])
            if not 1<=port<=65535:raise ValueError('Invalid OBS port.')
            if d['account']:account_id(d['account'])
            names=d['processes'].split(',')
            if not names or any(not re.fullmatch(r'[A-Za-z0-9_. -]+\.exe',x.strip()) for x in names):raise ValueError('Enter executable names such as citadel.exe.')
            u=urlparse(d['tracker'])
            if u.scheme!='https' or u.hostname not in ('tracklock.gg','www.tracklock.gg'):raise ValueError('The tracker shortcut must use https://tracklock.gg/.')
            d['autosync']=self.autosync.get()
            with self.settings_lock:self.settings=d
            temp=DATA/'settings.tmp';temp.write_text(json.dumps(d,indent=2),encoding='utf-8');temp.replace(DATA/'settings.json');self.refresh();self.log('Setup saved. OBS password remains in memory only.')
        except Exception as e:messagebox.showerror('Setup',str(e))
    def sync(self,quiet=False):
        if self.job:return
        try:aid=account_id(self.config()['account'])
        except ValueError as e:
            if not quiet:messagebox.showinfo('Steam ID needed',str(e))
            return
        self.job=True;self.log('Syncing public match history…')
        def worker():
            try:
                rows=self.api.history(aid);self.store.summaries(aid,rows)
                if not self.hero_names:
                    try:
                        h=self.api.heroes();(DATA/'heroes.json').write_text(json.dumps(h),encoding='utf-8');self.q.put(('heroes',h))
                    except Exception as e:self.q.put(('log','Hero names unavailable; showing numeric IDs. '+str(e)))
                candidates=[m for m in self.store.matches(aid)[:15] if m['metadata'] is None][:3]
                for m in candidates:
                    try:self.store.metadata(aid,m['id'],self.api.detail(m['id']))
                    except Exception as e:self.q.put(('log','Match details deferred: '+str(e)));break
                self.q.put(('log',f'Synced {len(rows)} match summaries. Missing provider games remain unknown.'));self.q.put(('refresh',None))
            except Exception as e:self.q.put(('log' if quiet else 'error','Sync failed: '+str(e)));self.q.put(('refresh',None))
        threading.Thread(target=worker,daemon=True).start()
    def auto_sync(self):
        if self.config()['autosync']:self.sync(quiet=True)
        self.after(600000,self.auto_sync)
    def filtered(self):
        val=self.filter.get();out=[]
        for m in self.matches:
            name=self.hero_names.get(str(m['summary'].get('hero_id')),'Hero '+str(m['summary'].get('hero_id')))
            if val=='All heroes' or val=='Focus heroes' and (name in HEROES or not self.hero_names) or val==name:out.append(m)
        return out
    def refresh(self):
        try:aid=account_id(self.config()['account'])
        except ValueError:aid=None
        if aid!=self.current_account:self.mid=None;self.current_account=aid;self.match_notes.delete('1.0','end')
        self.matches=self.store.matches(aid) if aid else []
        for t in (self.match_tree,self.hero_tree):t.delete(*t.get_children())
        rows=self.filtered()
        for m in rows:
            s=m['summary'];duration=s.get('match_duration_s') or 0;spm=s.get('net_worth',0)*60/duration if duration else None
            result={0:'Invalid',1:'Win',2:'Loss',3:'Penalized',4:'Party penalty',5:'Unscored'}.get(s.get('player_match_outcome'),'Unknown')
            date=datetime.fromtimestamp(s.get('start_time',0)).strftime('%Y-%m-%d %H:%M')
            self.match_tree.insert('', 'end',iid=m['id'],values=(m['id'],date,self.hero_names.get(str(s.get('hero_id')),'Hero '+str(s.get('hero_id'))),result,f"{s.get('player_kills','?')} / {s.get('player_deaths','?')} / {s.get('player_assists','?')}",round(spm) if spm is not None else 'Unknown',s.get('denies','?'),f"{s.get('game_mode','?')} / {s.get('match_mode','?')}"))
        latest=[m['summary'] for m in rows[:30]];scored=[s for s in latest if s.get('player_match_outcome') in (1,2)];wins=sum(s['player_match_outcome']==1 for s in scored)
        self.summary.set(f"{len(rows)} saved matches in view   •   Latest {len(latest)}: {wins}/{len(scored)} scored wins   •   {len(self.store.recordings())} recording records" if aid else 'Add your Steam ID in Setup when you are home. Recording and lessons can work without it.')
        names=list(HEROES)+sorted(set(self.hero_names.get(str(s.get('hero_id')),'Hero '+str(s.get('hero_id'))) for s in latest)-set(HEROES))
        for name in names:
            ss=[s for s in latest if self.hero_names.get(str(s.get('hero_id')),'Hero '+str(s.get('hero_id')))==name];n=len(ss);sc=[s for s in ss if s.get('player_match_outcome') in (1,2)]
            avg=' / '.join(f'{sum(s.get(k,0) for s in ss)/n:.1f}' for k in ('player_kills','player_deaths','player_assists')) if n else '—'
            rates=[s['net_worth']*60/s['match_duration_s'] for s in ss if s.get('match_duration_s',0)>0 and 'net_worth' in s]
            self.hero_tree.insert('','end',values=(name,n,f"{sum(s['player_match_outcome']==1 for s in sc)} / {len(sc)}",avg,round(sum(rates)/len(rates)) if rates else '—'))
        if self.mid and self.match_tree.exists(self.mid):self.match_tree.selection_set(self.mid)
        self.refresh_recordings();self.render_events();self.refresh_profile()
    def refresh_profile(self):
        self.profile_groups={f"{self.hero_names.get(h, 'Hero '+h)} | modes {g} / {m}":(h,g,m) for h,g,m in cohorts(self.matches)}
        choices=list(self.profile_groups);self.profile_combo.configure(values=choices)
        if self.profile_choice.get() not in self.profile_groups:self.profile_choice.set(choices[0] if choices else '')
        self.render_profile()
    def render_profile(self):
        self.profile_tree.delete(*self.profile_tree.get_children());self.suggested_lesson=1
        cohort=self.profile_groups.get(self.profile_choice.get())
        lines=[]
        if not cohort:
            self.profile_summary.set('No matches yet. Add your account in Setup and sync when you are home.')
            lines=['Start with Lesson 1 while collecting a baseline. The profile fills automatically after match sync.']
        else:
            report=analyze(self.matches,cohort);a,b=report['recent'],report['previous']
            wins=lambda rows:sum(s['player_match_outcome']==1 for s in rows)
            self.profile_summary.set(f"{report['total']} scored games in this cohort | Recent wins {wins(a)}/{len(a)} | Previous wins {wins(b)}/{len(b)}. Invalid, penalized and unscored games excluded.")
            fmt=lambda v:'Unknown' if v is None else f'{v:.2f}'
            for m in report['metrics']:
                change='Need 5 valid games each' if m['delta'] is None else (f"{m['pct']:+.1f}%" if m['pct'] is not None else f"{m['delta']:+.2f} (zero baseline)")
                self.profile_tree.insert('','end',values=(m['title'],fmt(m['recent']),fmt(m['previous']),f"{m['n']} / {m['baseline_n']}",change))
            lines=['POSITIVE TRENDS TO INVESTIGATE']
            lines += [f"• {m['label']}: {m['pct']:+.1f}% relative to your previous sample. Confirm in replay whether this helped your team." for m in report['strengths']] or ['No positive trend crosses the attention threshold yet. This is not a judgment of your skill.']
            lines += ['','NEXT PRACTICE PRIORITY']
            priorities=report['priorities'][:3]
            if priorities:
                self.suggested_lesson=priorities[0]['lesson']
                lines += [f"• {m['label']} — Lesson {m['lesson']}. {m['drill']}" for m in priorities]
            else:
                self.suggested_lesson=14
                lines += ['No decline crosses the attention threshold. Review three deaths with Lesson 14 and write one correction in match notes.']
            lines += ['', 'HOW TO READ THIS', 'At least 5 valid games in each non-overlapping window are required per metric. A 10% change triggers attention; it is a heuristic, not statistical significance or proof of a weakness. The full baseline needs 20 scored games per hero/mode. Missing fields are excluded, never filled with zero.', 'Economy uses final net worth divided by duration, not total souls earned or lane efficiency. These are means of per-match rates. Deaths, kills, assists and denies do not measure positioning, teamwork or decision quality directly. Opponents, patch changes, match length, builds and team compositions can explain changes. No rank prediction or population percentile is calculated.', 'After practicing, sync another block of games and compare again. Lesson completion and notes persist in Training; match-specific evidence belongs in Matches.']
        self.profile_body.configure(state='normal');self.profile_body.delete('1.0','end');self.profile_body.insert('1.0','\n'.join(lines));self.profile_body.configure(state='disabled')
    def profile_lesson(self):
        k=self.suggested_lesson
        self.lesson_choice.set(f'{k}. {self.lesson_content[k][0]}');self.show_lesson();self.tabs.select(self.pages['Training'])
    def select_match(self,event=None):
        sel=self.match_tree.selection()
        if not sel:return
        self.mid=sel[0];self.match_notes.delete('1.0','end');self.match_notes.insert('1.0',self.store.note(self.current_account,self.mid));self.render_events()
    def details(self):
        if self.job:return
        if not self.mid:return messagebox.showinfo('Choose a match','Select a match first.')
        aid=self.current_account;mid=self.mid;self.job=True
        def worker():
            try:self.store.metadata(aid,mid,self.api.detail(mid));self.q.put(('log','Match detail cached. Open Event review.'));self.q.put(('refresh',None))
            except Exception as e:self.q.put(('error',str(e)))
        threading.Thread(target=worker,daemon=True).start()
    def render_events(self):
        self.event_tree.delete(*self.event_tree.get_children());m=next((m for m in self.matches if m['id']==self.mid),None)
        if not m:self.events=[];self.event_status.set('Select a match in Matches.');self.link_label.set('No match selected.');return
        all_events,msg=events_from_metadata(m['metadata']) if m['metadata'] else ([], 'Detailed metadata is not available yet. Load selected match details or sync later.')
        self.events=[e for e in all_events if self.event_scope.get()=='All players' or e['account_id']==self.current_account]
        own=[e for e in all_events if e['account_id']==self.current_account];ks=sum(e['count'] for e in own if e['kind']=='Kill');ds=sum(e['count'] for e in own if e['kind']=='Death');self.event_status.set(f"Match {self.mid} • {msg} My recognized K/D: {ks}/{ds}; summary K/D: {m['summary'].get('player_kills','?')}/{m['summary'].get('player_deaths','?')}. Differences mean incomplete coverage.")
        for i,e in enumerate(self.events):
            clock=stamp(e['seconds']) if e['earliest']==e['seconds'] else f"{stamp(e['earliest'])}–{stamp(e['seconds'])}"
            self.event_tree.insert('','end',iid=str(i),values=(clock,e['kind'],e['account_id'],e['count'],e['source']))
        link=self.store.linked(self.current_account,self.mid);self.link_label.set(f"Video: {link['path']} • offset {link['offset']:+.1f}s (video = match clock + offset)" if link else 'No recording linked. Link a video and align one visible game-clock moment.')
    def save_note(self):
        if not self.mid:return messagebox.showinfo('Choose a match','Select a match first.')
        self.store.save_note(self.current_account,self.mid,self.match_notes.get('1.0','end-1c'));self.log('Match note saved locally.')
    def refresh_recordings(self):
        self.record_tree.delete(*self.record_tree.get_children())
        for r in self.store.recordings():self.record_tree.insert('','end',iid=r['id'],values=(datetime.fromtimestamp(r['start']).strftime('%Y-%m-%d %H:%M'),r['status'],r['path'] or 'Not finalized / locate in OBS'))
    def obs_job(self,fn):
        if self.obs_busy:return
        self.obs_busy=True
        def worker():
            try:msg=fn();self.q.put(('obsdone',msg or 'Recording operation complete.'))
            except Exception as e:self.q.put(('error',str(e)))
        threading.Thread(target=worker,daemon=True).start()
    def connect_obs(self):
        port=self.vars['port'].get();pw=self.password.get()
        self.obs_job(lambda:'Connected to OBS '+str(self.rec.connect(port,pw)))
    def check_obs(self):
        def check():
            with self.rec.lock:self.rec.validate()
            return 'Capture scene checks passed. Verify picture and audio in OBS before recording.'
        self.obs_job(check)
    def arm_recording(self):
        def arm():
            with self.rec.lock:self.rec.validate()
            self.arm.set();return 'Auto recording armed. Waiting for Deadlock, or starting if it is already open.'
        self.obs_job(arm)
    def start_recording(self):self.obs_job(lambda:self.rec.start())
    def stop_recording(self):
        self.arm.clear();self.obs_job(lambda:(self.rec.stop() and 'Recording saved; monitoring disarmed.') or 'Monitoring disarmed.')
    def marker(self,kind):self.obs_job(lambda:f'{kind} manually marked at {stamp(self.rec.mark(kind))}.')
    def monitor(self):
        absent=0
        while not self.quit_event.wait(3):
            try:
                if self.rec.owned:self.rec.check()
                if not self.arm.is_set():continue
                running=game_running(self.config()['processes']);absent=0 if running else absent+1
                if running and not self.rec.owned:
                    with self.rec.lock:
                        if self.arm.is_set() and not self.closing:self.rec.start()
                elif absent>=3 and self.rec.owned:self.rec.stop();self.q.put(('obsdone','Game closed; recording saved. Monitoring remains armed.'))
            except Exception as e:
                self.arm.clear();self.q.put(('log','Monitoring stopped: '+str(e)+' Check OBS if a recording remains active.'))
    def link_video(self):
        if not self.mid:return messagebox.showinfo('Choose a match','Select a match first.')
        path=filedialog.askopenfilename(title='Choose the video containing this match',filetypes=[('Video','*.mkv *.mp4 *.mov *.flv *.ts'),('All files','*.*')])
        if not path:return
        video=simpledialog.askstring('Clock alignment','At a clear moment in the video, what is the VIDEO playback time? (MM:SS or HH:MM:SS)')
        if video is None:return
        clock=simpledialog.askstring('Clock alignment','At that same frame, what is the GAME clock? (MM:SS; choose a nonnegative match time)')
        if clock is None:return
        try:offset=parse_clock(video)-parse_clock(clock)
        except ValueError as e:return messagebox.showerror('Clock alignment',str(e))
        existing=next((r for r in self.store.recordings() if r['path']==path),None)
        rid=existing['id'] if existing else str(uuid.uuid4())
        if not existing:
            with self.store.connect() as c:c.execute('INSERT INTO recordings VALUES(?,?,?,?,?)',(rid,Path(path).stat().st_mtime,None,path,'linked existing video'))
        self.store.link(self.current_account,self.mid,rid,offset);self.render_events();self.refresh_recordings();self.log('Video linked. Verify one event and re-align if it is off.')
    def play(self,path,start=0):
        if not path or not Path(path).is_file():return messagebox.showerror('Video unavailable','Locate the recording in OBS, then link that file to the match.')
        options=[self.config()['vlc'],str(Path(os.environ.get('ProgramFiles','C:/Program Files'))/'VideoLAN/VLC/vlc.exe'),str(Path(os.environ.get('ProgramFiles(x86)','C:/Program Files (x86)'))/'VideoLAN/VLC/vlc.exe')]
        vlc=next((p for p in options if p and Path(p).is_file()),None)
        if vlc:subprocess.Popen([vlc,'--start-time='+str(max(0,int(start))),str(path)])
        else:os.startfile(path);messagebox.showinfo('Review timestamp','Jump to '+stamp(start)+'. Install VLC or set its path for automatic seeking.')
    def open_event(self):
        sel=self.event_tree.selection()
        if not sel:return
        link=self.store.linked(self.current_account,self.mid)
        if not link:return messagebox.showinfo('Link video','Link a recording and align its clock first.')
        e=self.events[int(sel[0])];t=e['earliest']+link['offset']
        if t<0:return messagebox.showinfo('Before this recording','This event predates the recording based on your alignment.')
        self.play(link['path'],max(0,t-20))
    def open_recording(self):
        sel=self.record_tree.selection()
        if sel:
            r=next(r for r in self.store.recordings() if r['id']==sel[0]);self.play(r['path'])
    def open_tracker(self):webbrowser.open(self.config()['tracker'])
    def inspect_stats(self):
        m=next((m for m in self.matches if m['id']==self.mid),None)
        if not m:return
        window=tk.Toplevel(self);window.title('All received match fields');window.geometry('850x650')
        ttk.Label(window,text='Provider fields are preserved as received. Null/missing values are not zero.',wraplength=800).pack(anchor='w')
        t=self.text(window,30);t.insert('1.0',json.dumps(m,indent=2));t.configure(state='disabled')
    def import_metadata(self):
        if not self.mid:return messagebox.showinfo('Choose a match','Select a match first.')
        path=filedialog.askopenfilename(filetypes=[('JSON','*.json')])
        if not path:return
        try:
            if Path(path).stat().st_size>40*1024*1024:raise ValueError('File is larger than 40 MB.')
            payload=json.loads(Path(path).read_text(encoding='utf-8'));info=unpack_info(payload)
            if str(info.get('match_id',''))!=self.mid:raise ValueError('Metadata match_id must match the selected match.')
            if not isinstance(info.get('players'),list):raise ValueError('No recognized players list in this metadata.')
            self.store.metadata(self.current_account,self.mid,payload);self.refresh();self.log('Metadata imported; inspect event coverage against your summary.')
        except Exception as e:messagebox.showerror('Import',str(e))
    def export_markers(self):
        selected=self.record_tree.selection()
        if not selected:return messagebox.showinfo('Choose a recording','Select a recording first.')
        path=filedialog.asksaveasfilename(defaultextension='.csv',initialfile='manual-recording-marks.csv')
        if not path:return
        with self.store.connect() as c:rows=c.execute('SELECT seconds,kind FROM markers WHERE recording=? ORDER BY seconds',(selected[0],)).fetchall()
        with open(path,'w',newline='',encoding='utf-8-sig') as f:
            w=csv.writer(f);w.writerow(['video_seconds','event','source']);w.writerows((r[0],r[1],'manual button') for r in rows)
        self.log('Manual recording markers exported.')
    def export_matches(self):
        path=filedialog.asksaveasfilename(defaultextension='.csv',initialfile='deadlock-matches.csv')
        if not path:return
        rows=[m['summary'] for m in self.filtered()];keys=sorted({k for r in rows for k,v in r.items() if not isinstance(v,(dict,list))})
        with open(path,'w',newline='',encoding='utf-8-sig') as f:
            w=csv.DictWriter(f,fieldnames=keys,extrasaction='ignore');w.writeheader();w.writerows([{k:("'"+str(v) if isinstance(v,str) and v.startswith(('=','+','-','@')) else v) for k,v in r.items() if k in keys} for r in rows])
        self.log('Displayed match data exported.')
    def export_events(self):
        if not self.mid:return
        path=filedialog.asksaveasfilename(defaultextension='.csv',initialfile=f'match-{self.mid}-events.csv')
        if not path:return
        link=self.store.linked(self.current_account,self.mid)
        with open(path,'w',newline='',encoding='utf-8-sig') as f:
            w=csv.writer(f);w.writerow(['match_id','account_id','event','count','game_earliest_s','game_latest_s','video_earliest_s','source'])
            for e in self.events:w.writerow([self.mid,e['account_id'],e['kind'],e['count'],e['earliest'],e['seconds'],e['earliest']+link['offset'] if link else '',e['source']])
        self.log('Event timeline exported. Unaligned video times are blank.')
    def show_lesson(self):
        lid=int(self.lesson_choice.get().split('.')[0]);body=self.lesson_content[lid][1];self.lesson_body.configure(state='normal');self.lesson_body.delete('1.0','end');self.lesson_body.insert('1.0',body.replace('**',''));self.lesson_body.configure(state='disabled');status,notes=self.store.lesson(lid);self.lesson_status.set(status);self.lesson_notes.delete('1.0','end');self.lesson_notes.insert('1.0',notes)
    def save_lesson(self):
        lid=int(self.lesson_choice.get().split('.')[0]);self.store.save_lesson(lid,self.lesson_status.get(),self.lesson_notes.get('1.0','end-1c'));self.log('Lesson evidence saved locally.')
    def backup(self):
        path=filedialog.asksaveasfilename(defaultextension='.sqlite3',initialfile='Eternus-progress-backup.sqlite3')
        if path:
            if Path(path).resolve()==self.store.path.resolve():return messagebox.showerror('Backup','Choose a different file from the active database.')
            self.store.backup(path);self.log('Local records backed up. Videos are separate and are not included.')
    def close(self):
        if self.closing:return
        if self.rec.owned and not messagebox.askyesno('Finish recording?','Stop this app’s recording and close?'):return
        self.closing=True;self.arm.clear()
        def stop():
            try:self.rec.stop();self.rec.close_socket();self.q.put(('closed',None))
            except Exception as e:self.closing=False;self.q.put(('error','Could not confirm recording stopped. Stop it in OBS, then close again. '+str(e)))
        threading.Thread(target=stop,daemon=True).start()

if __name__=='__main__':
    if os.name!='nt':print('Windows is required for the desktop app. Core tests can run on other platforms.');sys.exit(1)
    # Named mutex prevents two companion instances competing for OBS or sync work.
    import ctypes
    handle=ctypes.windll.kernel32.CreateMutexW(None,False,'Local\\EternusCompanion01')
    if ctypes.windll.kernel32.GetLastError()==183:messagebox.showinfo('Already open','Eternus Companion is already running.');sys.exit(0)
    try:App().mainloop()
    except Exception:
        (DATA/'last-error.txt').write_text(traceback.format_exc(),encoding='utf-8');messagebox.showerror('Eternus Companion','The app stopped. Details are in '+str(DATA/'last-error.txt'))
