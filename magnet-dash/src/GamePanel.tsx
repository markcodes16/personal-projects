import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, CircleHelp, Pause, Play, RotateCcw, Shield, Trophy, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { createRun, dailySeed, difficultyAt, distanceMeters, flip, rescue, score, SECTORS, startRun, stepRun, togglePause } from './game';
import type { GameState, Phase } from './game';
import { drawScene } from './render';
import { polarityCue } from './polarityCue';
import { track } from './analytics';
import { tone } from './sound';
import type { RunResult } from './storage';

export type LiveStats = { phase: Phase; distance: number; sector: number; score: number; coins: number; combo: number; nearMisses: number; gravity: number; shield: number; rescued: boolean; isRecord: boolean };
function snapshot(state: GameState, previousBest: number): LiveStats {
  return { phase: state.phase, distance: distanceMeters(state), sector: difficultyAt(state.distance).sector, score: score(state), coins: state.coins,
    combo: state.combo, nearMisses: state.nearMisses, gravity: state.gravity, shield: state.shield, rescued: state.rescued, isRecord: score(state) > previousBest };
}
function seedFor(mode: 'endless' | 'daily') {
  const date = new Date();
  return mode === 'daily' ? dailySeed(`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`) : crypto.getRandomValues(new Uint32Array(1))[0];
}

export default function GamePanel({ mode, visible, sound, best, onRun, onLive, onHelp, focused, onFocus, skin, onSound, onGarage, milestone }: {
  mode: 'endless' | 'daily'; visible: boolean; sound: boolean; best: number;
  onRun: (run: RunResult) => void; onLive: (stats: LiveStats) => void; onHelp: () => void;
  focused: boolean; onFocus: (value: boolean) => void; skin: { body: string; trail: string }; onSound: () => void; onGarage: () => void; milestone: string;
}) {
  const [initial] = useState(() => createRun(seedFor(mode)));
  const run = useRef(initial);
  const id = useRef(crypto.randomUUID());
  const previousBest = useRef(best);
  const [stats, setStats] = useState(() => snapshot(initial, best));
  const canvas = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ sound, onRun, onLive, mode, visible, onFocus, skin });
  const action = useRef<() => void>(() => {});
  const pause = useRef<() => void>(() => {});
  const sync = useRef<() => void>(() => {});
  const lastActionAt = useRef(0);
  const overlayButton = useRef<HTMLButtonElement>(null);
  const polarityLearned = useRef(false);
  callbacks.current = { sound, onRun, onLive, mode, visible, onFocus, skin };

  useEffect(() => {
    const update = () => {
      const value = snapshot(run.current, previousBest.current);
      setStats(value); callbacks.current.onLive(value);
    };
    sync.current = update;
    const begin = () => {
      const current = run.current;
      if (current.phase === 'over') {
        previousBest.current = Math.max(previousBest.current, score(current));
        run.current = createRun(seedFor(callbacks.current.mode));
        id.current = crypto.randomUUID();
        lastEffect = 0;
      }
      run.current = startRun(run.current);
      callbacks.current.onFocus(true);
      tone('start', callbacks.current.sound);
      track('round_started', { mode: callbacks.current.mode, seed: run.current.seed, rulesVersion: 5 }, id.current);
      update(); canvas.current?.focus({ preventScroll: true });
    };
    action.current = () => {
      const now = performance.now();
      if (now - lastActionAt.current < 90) return;
      lastActionAt.current = now;
      if (run.current.phase === 'ready' || run.current.phase === 'over') { begin(); return; }
      if (run.current.phase === 'paused') { run.current = togglePause(run.current); callbacks.current.onFocus(true); update(); return; }
      run.current = flip(run.current);
      tone('flip', callbacks.current.sound, run.current.combo);
      try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(8); } catch { /* Optional haptics never block a flip. */ }
      // Aggregate flip count in end events; no storage write on every animation frame.
      update();
    };
    pause.current = () => { run.current = togglePause(run.current); if (run.current.phase === 'playing') callbacks.current.onFocus(true); update(); };
    const keydown = (event: KeyboardEvent) => {
      if (!callbacks.current.visible) return;
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const element = event.target as HTMLElement;
      if (element.closest('input, textarea, select, button, a, [contenteditable=true]')) return;
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault(); action.current();
      }
      if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); pause.current(); }
    };
    const hidden = () => {
      if (document.hidden && run.current.phase === 'playing') { run.current = togglePause(run.current); update(); }
    };
    window.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', hidden);

    let lastEffect = 0;
    let raf = 0;
    let previousTime = 0;
    let previousHud = 0;
    let width = 800, height = 480, dpr = 1;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      if (!canvas.current) return;
      const box = canvas.current.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return;
      width = box.width; height = box.height; dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.current.width = Math.round(width * dpr); canvas.current.height = Math.round(height * dpr);
    };
    const observer = new ResizeObserver(resize);
    if (canvas.current) observer.observe(canvas.current);
    resize(); update();
    const frame = (now: number) => {
      const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.06) : 0;
      previousTime = now;
      const old = run.current;
      const next = stepRun(old, dt);
      run.current = next;
      if (next.polarityPasses > 0) polarityLearned.current = true;
      if (next.elapsed < old.elapsed) lastEffect = 0;
      const fresh = next.effects.filter(effect => effect.id > lastEffect);
      if (fresh.length) lastEffect = Math.max(...fresh.map(effect => effect.id));
      const audible = fresh.filter(effect => effect.kind !== 'flip' && effect.kind !== 'crash');
      const cue = (['break', 'shield', 'risk', 'combo', 'perfect', 'near', 'coin', 'land'] as const).find(kind => audible.some(effect => effect.kind === kind));
      if (cue) tone(cue, callbacks.current.sound, next.combo);
      if (old.phase !== 'playing' && next.phase === 'playing') lastEffect = 0;
      if (old.phase === 'playing' && next.phase === 'over') {
        tone('crash', callbacks.current.sound);
        const result: RunResult = { id: id.current, distance: distanceMeters(next), score: score(next), coins: next.coins,
          flips: next.flips, seconds: Math.round(next.elapsed), mode: callbacks.current.mode, rescued: next.rescued, at: new Date().toISOString(),
          perfects: next.perfects, polarityPasses: next.polarityPasses, riskyPasses: next.riskyPasses };
        callbacks.current.onRun(result);
        track('run_crashed', { distance: result.distance, score: result.score, rescued: result.rescued }, id.current);
        track('round_ended', { ...result, attempt: next.rescued ? 2 : 1 }, id.current);
        if (!next.rescued) track('reward_offered', { source: 'demo', placement: 'rescue' }, id.current);
        update();
      } else if (next.phase === 'playing' && now - previousHud > 90) { update(); previousHud = now; }
      const context = canvas.current?.getContext('2d');
      if (context) { context.setTransform(dpr, 0, 0, dpr, 0, 0); drawScene(context, width, height, run.current, now / 1000, reducedMotion, callbacks.current.skin); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  useEffect(() => {
    if (!visible && run.current.phase === 'playing') { run.current = togglePause(run.current); sync.current(); }
  }, [visible]);
  useEffect(() => {
    if (stats.phase === 'over' || stats.phase === 'paused') overlayButton.current?.focus({ preventScroll: true });
  }, [stats.phase]);

  const recover = () => {
    if (run.current.phase !== 'over' || run.current.rescued) return;
    track('reward_requested', { source: 'demo', placement: 'rescue' }, id.current);
    run.current = rescue(run.current);
    track('reward_granted', { source: 'demo', placement: 'rescue', liveAd: false }, id.current);
    sync.current(); canvas.current?.focus({ preventScroll: true });
  };
  const leave = () => { if (run.current.phase === 'playing') { run.current = togglePause(run.current); sync.current(); } onFocus(false); };
  const upcoming = run.current.obstacles.find(o => !o.passed && !o.broken);
  const gateCue = polarityCue(run.current);
  const gateLead = upcoming ? (upcoming.x + upcoming.width / 2 - run.current.distance) / run.current.speed : 0;
  const sector = SECTORS[(stats.sector - 1) % SECTORS.length];

  return <section className={`game-card ${focused ? 'is-focused' : ''}`} aria-label="Magnet Dash game">
    <div className="game-toolbar"><div className="circuit-label"><span className="status-dot" /><span>{mode === 'daily' ? 'DAILY · V5' : 'ENDLESS · V5'}</span><span className="toolbar-divider">/</span><span className="sector-label">{sector.name}</span></div><div className="game-tools"><button className="icon-button" aria-label="How to play" onClick={onHelp}><CircleHelp size={17} /></button>{focused && <button className="icon-button" aria-label={sound ? 'Mute game sound' : 'Enable game sound'} onClick={onSound}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>}<button className="icon-button" aria-label={stats.phase === 'paused' ? 'Resume game' : 'Pause game'} disabled={stats.phase === 'ready' || stats.phase === 'over'} onClick={() => pause.current()}>{stats.phase === 'paused' ? <Play size={16} /> : <Pause size={16} />}</button>{focused && <button className="icon-button" aria-label="Leave play view" onClick={leave}><X size={17} /></button>}</div></div>
    <div className={`game-viewport phase-${stats.phase}`}>
      <canvas ref={canvas} tabIndex={0} role="button" aria-label="Game tunnel. Press Space or tap to switch polarity. P pauses." onPointerDown={event => { event.preventDefault(); canvas.current?.focus({ preventScroll: true }); action.current(); }} />
      <div className="game-hud" aria-hidden="true"><div><span>SCORE</span><strong>{stats.score.toLocaleString()}</strong><small className="score-distance">{stats.distance}m · {upcoming?.pattern ?? 'CLIMB'}</small></div><div className="hud-charge"><span>FLOW</span><strong className="combo-value">×{stats.combo}</strong><div>{Array.from({ length: 5 }, (_, index) => <i className={index < stats.combo ? 'filled' : ''} key={index} />)}</div></div><div className="hud-energy"><Zap size={15} /><strong key={stats.coins}>{stats.coins.toString().padStart(2, '0')}</strong></div></div>
      {stats.phase === 'ready' && <div className="game-overlay ready-overlay"><div className="start-panel"><span className="start-symbol"><ArrowUpDown size={27} /></span><span className="eyebrow">A NEW DIRECTION AWAITS</span><h2>Ready to<br /><em>switch it up?</em></h2><p>Tap to reverse gravity. Stay afloat.<br />Flip early — momentum carries you.</p><button className="primary-button start-button" onClick={() => action.current()}><Play size={17} fill="currentColor" /> Let's dash <ArrowUpRight className="start-arrow" size={15} /></button><span className="start-hint">TAP ANYWHERE OR PRESS <kbd>SPACE</kbd></span></div></div>}
      {stats.phase === 'paused' && <div className="game-overlay"><div className="end-panel" role="dialog" aria-modal="true" aria-label="Game paused"><span className="start-symbol"><Pause size={24} /></span><span className="eyebrow">TAKE A BREATHER</span><h2>Right where<br />you left off.</h2><p>Your run is paused. Ready when you are.</p><button className="primary-button" ref={overlayButton} onClick={() => { pause.current(); canvas.current?.focus({ preventScroll: true }); }}><Play size={17} fill="currentColor" /> Resume run</button></div></div>}
      {stats.phase === 'over' && <div className="game-overlay"><div className="end-panel" role="dialog" aria-modal="true" aria-label="Run complete"><span className="eyebrow">{stats.isRecord ? <><Trophy size={14} /> NEW BEST SCORE</> : 'ANOTHER RUN. MORE PROGRESS.'}</span><div className="end-distance">{stats.score.toLocaleString()}<span>PTS</span></div><p>{run.current.crashReason}</p><div className="end-stats"><span>{stats.distance}m</span><span><Zap size={14} /> {stats.coins} energy</span><span>{run.current.perfects} perfect</span><span>{run.current.riskyPasses} bonus routes</span></div><button className="primary-button" ref={overlayButton} onClick={() => action.current()}><RotateCcw size={17} /> Dash again</button>{!stats.rescued && <><button className="rescue-button" onClick={recover}><Shield size={15} /> Try a free rescue</button><span className="reward-note">Ad-reward preview · no ad plays · once per run</span></>}<p className="progress-note">{milestone}</p><button className="garage-link" onClick={onGarage}>Missions &amp; garage →</button></div></div>}
      {stats.shield > 0 && stats.phase === 'playing' && <div className="surge-banner"><Shield size={15} /> SHIELD READY <span>1 HIT</span></div>}
      {stats.phase === 'playing' && stats.distance < 160 && <div className="first-tip">{stats.distance < 65 ? 'Tap to reverse gravity. Keep yourself afloat.' : 'Flip before a turn. Momentum carries you.'}</div>}
      {gateCue?.firstGate && !polarityLearned.current && gateLead > 0.8 && <div className="polarity-lesson"><ArrowUpDown size={13} /><span>Match your pull to the gate arrows.</span></div>}
    </div>
    <div className="game-bottom"><div className="pull-status"><div className={`polarity-readout ${stats.gravity === -1 ? 'up' : ''}`}><span className="polarity-icon">{stats.gravity === 1 ? <ArrowDown size={15} /> : <ArrowUp size={15} />}</span><span>PULLING {stats.gravity === 1 ? 'DOWN' : 'UP'}</span></div>{gateCue && <span className={`polarity-target ${gateCue.required === -1 ? 'up' : 'down'} ${gateCue.matched ? 'matched' : ''}`} aria-label={`Gate requires ${gateCue.required === -1 ? 'up' : 'down'} pull${gateCue.matched ? ', matched' : ''}`}><small>GATE</small>{gateCue.required === -1 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{gateCue.matched && <i />}</span>}</div><button className="tap-button" onClick={() => action.current()}><ArrowUpDown size={15} /><span>{stats.phase === 'ready' ? 'Start run' : stats.phase === 'over' ? 'Try again' : stats.phase === 'paused' ? 'Resume' : 'Flip polarity'}</span><kbd>SPACE</kbd></button></div>
    <span className="sr-only" role="status" aria-live="polite">{stats.phase === 'over' ? `Run complete. ${stats.distance} meters, ${stats.coins} energy.` : stats.phase === 'paused' ? 'Game paused' : stats.phase === 'playing' ? 'Run started. Tap or press Space to flip.' : 'Ready to play.'}</span>
  </section>;
}
