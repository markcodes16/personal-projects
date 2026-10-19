import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpDown, ArrowUpRight, CalendarDays, Check, ChevronRight, CircleHelp, FlaskConical, Infinity as InfinityIcon, Magnet, Radio, Sparkles, Trophy, Volume2, VolumeX, X, Zap } from 'lucide-react';
import GamePanel from './GamePanel';
import type { LiveStats } from './GamePanel';
import MonetizationLab from './MonetizationLab';
import Progression from './Progression';
import { FINISHES, finishFor, missions } from './progression';
import { ensureSession } from './analytics';
import { loadPlayer, recordRun, savePlayer } from './storage';
import type { RunResult } from './storage';

function RobotPortrait() {
  return <svg className="robot-portrait" viewBox="0 0 170 150" aria-label="M-01, your magnetic robot" role="img"><defs><radialGradient id="robotglow"><stop stopColor="#d2ff9b" stopOpacity=".2" /><stop offset="1" stopColor="#d2ff9b" stopOpacity="0" /></radialGradient></defs><circle cx="85" cy="78" r="71" fill="url(#robotglow)" /><g transform="rotate(-10 85 75)"><rect x="51" y="49" width="68" height="60" rx="16" fill="#e1eadb" /><rect x="59" y="61" width="52" height="29" rx="10" fill="#253733" /><rect x="68" y="68" width="7" height="12" rx="3" fill="#d0ff8f" /><rect x="94" y="68" width="7" height="12" rx="3" fill="#d0ff8f" /><path d="M81 86h8" stroke="#9faf9d" strokeWidth="2" strokeLinecap="round" /><rect x="39" y="65" width="11" height="24" rx="4" fill="#9bab99" /><rect x="120" y="65" width="11" height="24" rx="4" fill="#9bab99" /><path d="M85 49V37" stroke="#b5c3af" strokeWidth="4" /><circle cx="85" cy="32" r="5" fill="#d0ff8f" /><rect x="61" y="111" width="15" height="7" rx="2" fill="#bded81" /><rect x="94" y="111" width="15" height="7" rx="2" fill="#bded81" /></g><path d="m130 27 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#c7b2ff" /><circle cx="35" cy="102" r="3" fill="#caff94" opacity=".6" /></svg>;
}

export default function App() {
  const [view, setView] = useState(() => new URLSearchParams(location.search).get('view') === 'lab' ? 'lab' : 'play');
  const [mode, setMode] = useState<'endless' | 'daily'>('endless');
  const [player, setPlayer] = useState(loadPlayer);
  const [help, setHelp] = useState(false);
  const [focused, setFocused] = useState(false);
  const [milestone, setMilestone] = useState('');
  const [live, setLive] = useState<LiveStats>({ phase: 'ready', distance: 0, sector: 1, score: 0, coins: 0, combo: 1, nearMisses: 0, gravity: 1, shield: 0, rescued: false, isRecord: false });
  const closeHelp = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { ensureSession(); }, []);
  useEffect(() => { savePlayer(player); }, [player]);
  useEffect(() => {
    const update = () => setView(new URLSearchParams(location.search).get('view') === 'lab' ? 'lab' : 'play');
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const go = (next: string) => {
    setFocused(false); setView(next);
    const url = new URL(location.href);
    if (next === 'lab') url.searchParams.set('view', 'lab'); else url.searchParams.delete('view');
    try { history.pushState({}, '', url); } catch { /* Standalone file previews may restrict history. */ }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const record = useCallback((run: RunResult) => {
    const next = recordRun(player, run);
    const unlocked = FINISHES.find(finish => player.totalCoins < finish.energy && next.totalCoins >= finish.energy);
    const after = missions(next);
    const completed = missions(player).find((mission, index) => after[index].value >= mission.target);
    setMilestone(unlocked ? `${unlocked.name} unlocked! Equip it in the garage.` : completed ? `Mission complete: ${completed.title} ${completed.target}.` : `${run.coins} energy saved toward your next finish.`);
    setPlayer(next);
  }, [player]);
  useEffect(() => {
    if (!focused) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [focused]);
  const garage = () => { setFocused(false); requestAnimationFrame(() => document.getElementById('progression')?.scrollIntoView({ behavior: 'instant', block: 'start' })); };
  const openHelp = () => { previousFocus.current = document.activeElement as HTMLElement; setHelp(true); };
  useEffect(() => {
    if (!help) return;
    closeHelp.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); setHelp(false); previousFocus.current?.focus(); }
      if (event.key === 'Tab') { event.preventDefault(); closeHelp.current?.focus(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [help]);
  const running = live.phase === 'playing' || live.phase === 'paused';
  const goal = Math.max(1000, Math.ceil((player.bestScore + 1) / 1000) * 1000);

  return <div className="site-shell">
    <header className="site-header"><button className="brand" aria-label="Magnet Dash home" onClick={() => go('play')}><span className="brand-icon"><Magnet size={25} strokeWidth={2.3} /></span><span>magnet<span className="brand-dash">dash<span className="brand-dot">.</span></span></span></button><nav aria-label="Main navigation"><button className={view === 'play' ? 'active' : ''} onClick={() => go('play')}>Play</button><button onClick={openHelp}>How to play</button></nav><div className="header-right"><span className="online-status"><span className="status-dot" />ALL SYSTEMS GO</span><button className="sound-button icon-button" aria-label={player.sound ? 'Mute sound' : 'Enable sound'} aria-pressed={player.sound} onClick={() => setPlayer(p => ({ ...p, sound: !p.sound }))}>{player.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}<span className="sound-label">{player.sound ? 'Sound on' : 'Sound off'}</span></button></div></header>
    <div hidden={view !== 'play'}>
      <main className="play-page"><section className="hero"><div><div className="hero-eyebrow"><span className="tiny-magnet">↕</span> SMALL ROBOT. BIG POSSIBILITIES.</div><h1>Flip the pull.<br /><em>Find your flow.</em><span className="hero-asterisk">✳</span></h1></div><div className="hero-description"><span className="number-label">001 / THE MAGNETIC RUNNER</span><p>A tiny robot. An endless tunnel.<br /> One tap to change everything.</p><span className="hero-tags"><span>ONE TAP</span><i /> <span>ENDLESS POSSIBILITIES</span></span></div></section>
      <div className="play-layout"><div className="game-column"><div className="above-game"><div className="mode-tabs" aria-label="Game mode"><button aria-pressed={mode === 'endless'} disabled={running} className={mode === 'endless' ? 'active' : ''} onClick={() => setMode('endless')}><InfinityIcon size={15} /> Endless</button><button aria-pressed={mode === 'daily'} disabled={running} className={mode === 'daily' ? 'active' : ''} onClick={() => setMode('daily')}><CalendarDays size={14} /> Daily circuit</button></div><span className="personal-best"><Trophy size={13} /> BEST <strong>{player.bestScore.toLocaleString()} PTS</strong></span></div>
        <GamePanel key={mode} mode={mode} visible={view === 'play' && !help} sound={player.sound} best={player.bestScore} onRun={record} onLive={setLive} onHelp={openHelp} focused={focused} onFocus={setFocused} skin={finishFor(player)} onSound={() => setPlayer(p => ({ ...p, sound: !p.sound }))} onGarage={garage} milestone={milestone} />
        <div className="under-game"><span><Radio size={13} /> {mode === 'daily' ? 'Same circuit. A fresh chance every attempt.' : 'No finish line. Just your next best.'}</span><button className="text-button" onClick={openHelp}>The basics <ArrowRight size={13} /></button></div>
      </div><aside className="game-sidebar"><section className="pilot-card"><div className="section-heading"><span className="eyebrow">YOUR LITTLE CO-PILOT</span><span className="pilot-id">M—01</span></div><RobotPortrait /><h2>Built to keep going.</h2><p>A little magnetic. A little ambitious.<br />A lot like you.</p><div className="pilot-status"><span className="status-dot" />{live.phase === 'playing' ? 'IN THE FLOW' : live.phase === 'paused' ? 'TAKING A BREATHER' : 'READY FOR A GOOD RUN'}</div></section><section className="goal-card"><div className="goal-icon"><Trophy size={18} /></div><span className="eyebrow">YOUR NEXT MILESTONE</span><h2>Score {goal.toLocaleString()}<ArrowUpRight size={18} /></h2><div className="goal-progress" role="progressbar" aria-label="Best score toward next milestone" aria-valuenow={Math.min(player.bestScore, goal)} aria-valuemin={0} aria-valuemax={goal}><span style={{ width: `${Math.min(100, player.bestScore / goal * 100)}%` }} /></div><div className="goal-label"><span>{player.bestScore.toLocaleString()} best score</span><span>{goal.toLocaleString()} PTS</span></div><p>Small flips. Big progress.</p></section></aside></div>
      <div id="progression"><Progression player={player} onFinish={id => { if (FINISHES.some(finish => finish.id === id && player.totalCoins >= finish.energy)) setPlayer(p => ({ ...p, skin: id })); }} /></div>
      <section className="how-cards" aria-label="The three essentials"><article><span className="how-icon purple"><ArrowUpDown size={21} /></span><div><span className="step-number">01 / SWITCH</span><h3>One tap. New direction.</h3><p>Tap or press Space to reverse gravity. Keep yourself afloat.</p></div></article><article><span className="how-icon peach"><ChevronRight size={23} /></span><div><span className="step-number">02 / FLOW</span><h3>Read the room.</h3><p>Flip before the turn. Your momentum carries you through the gaps.</p></div></article><article><span className="how-icon lime"><Zap size={22} /></span><div><span className="step-number">03 / FLOW</span><h3>Catch a little energy.</h3><p>Clean passes build score. Gold bonus routes offer a tighter challenge.</p></div></article></section>
      {player.recent.length > 0 && <section className="recent-runs"><span className="eyebrow">YOUR RECENT RUNS</span><div>{player.recent.slice(0, 5).map(run => <div className="recent-run" key={run.id}><span>{run.mode === 'daily' ? <CalendarDays size={14} /> : <InfinityIcon size={15} />}</span><strong>{run.score.toLocaleString()} PTS</strong><small><Zap size={11} /> {run.coins}{run.rescued ? ' · rescued' : ''}</small></div>)}</div></section>}
      </main>
    </div>
    {view === 'lab' && <MonetizationLab onBack={() => go('play')} />}
    <footer className="site-footer"><span>A LITTLE GAME WITH A LOT OF PULL.</span><div><span className="prototype-note">PROTOTYPE · NO LIVE ADS</span><button className="text-button" onClick={() => go(view === 'lab' ? 'play' : 'lab')}><FlaskConical size={14} /> {view === 'lab' ? 'Back to play' : 'Creator lab'} <ArrowRight size={13} /></button></div></footer>
    {help && <div className="modal-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) { setHelp(false); previousFocus.current?.focus(); } }}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button ref={closeHelp} className="icon-button close-button" aria-label="Close instructions" onClick={() => { setHelp(false); previousFocus.current?.focus(); }}><X size={19} /></button><span className="eyebrow"><CircleHelp size={14} /> A QUICK FIELD GUIDE</span><h2 id="help-title">It's all in<br /><em>the little flips.</em></h2><ol><li><span><ArrowUpDown size={20} /></span><div><strong>Switch your pull</strong><p>Tap the tunnel, use the flip button, or press Space / ↑ / ↓. Each tap reverses gravity. Your current motion eases into the new direction, so flip before you need to turn.</p></div></li><li><span><Magnet size={20} /></span><div><strong>Give yourself some room</strong><p>Follow climbs, dives and squeezes. Match your pull to the small arrows on a magnetic gate. Violet points up; lime points down. The target also appears beside your current pull. Momentum still carries through a flip.</p></div></li><li><span><Sparkles size={20} /></span><div><strong>Build flow. Grab protection.</strong><p>Energy builds your multiplier and unlocks robot finishes. Controlled passes near the center earn PERFECT bonuses. Gold upper passages offer extra points. They are optional: skipping their energy never breaks your chain. Cyan capsules absorb one hit.</p></div></li><li><span><Check size={20} /></span><div><strong>Keep it on your terms</strong><p>Press P or Escape to pause. Leaving the tab pauses automatically. Sound starts muted. Best runs stay in this browser.</p></div></li></ol><p className="help-note">Daily circuit repeats today's layout. Endless gives you a fresh one. One optional demo rescue is available per run; no ad plays.</p></section></div>}
  </div>;
}
