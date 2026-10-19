import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, FlaskConical, Info, ShieldCheck, TrendingUp } from 'lucide-react';
import { adDecision, DEFAULT_INPUTS, estimateRevenue, POLICIES } from './ads';
import type { RevenueInputs } from './ads';
import { exportEvents, readEvents } from './analytics';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

function Slider({ label, name, value, display, min, max, step = 1, onChange }: {
  label: string; name: keyof RevenueInputs; value: number; display: string; min: number; max: number; step?: number;
  onChange: (name: keyof RevenueInputs, value: number) => void;
}) {
  return <label className="model-slider"><span>{label}<strong>{display}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(name, Number(event.target.value))} /></label>;
}

export default function MonetizationLab({ onBack }: { onBack: () => void }) {
  const [inputs, setInputs] = useState<RevenueInputs>(DEFAULT_INPUTS);
  const [policyIndex, setPolicyIndex] = useState(0);
  const [activePlay, setActivePlay] = useState(false);
  const [firstSession, setFirstSession] = useState(false);
  const [events, setEvents] = useState(readEvents);
  useEffect(() => {
    const update = () => setEvents(readEvents());
    window.addEventListener('arcade:metrics', update);
    return () => window.removeEventListener('arcade:metrics', update);
  }, []);
  const policy = POLICIES[policyIndex];
  const estimate = estimateRevenue(inputs, policy);
  const decision = adDecision({ screen: activePlay ? 'playing' : 'round-end', sessionNumber: firstSession ? 1 : 2,
    completedRounds: inputs.roundsPerSession, sessionSeconds: inputs.roundsPerSession * inputs.secondsPerRound,
    secondsSinceAd: 1000, shownThisSession: 0, consentReady: true, adFree: false, rewardJustGranted: false }, policy);
  const change = (name: keyof RevenueInputs, value: number) => setInputs(previous => ({ ...previous, [name]: value }));
  const rounds = new Set(events.filter(event => event.name === 'round_ended').map(event => event.round));
  const sessions = new Set(events.filter(event => event.name === 'session_started').map(event => event.session)).size;
  const observedRewards = events.filter(event => event.name === 'reward_granted').length;
  const maxRevenue = Math.max(1, ...POLICIES.map(p => estimateRevenue(inputs, p).monthly));
  return <main className="lab-page">
    <button className="text-button back-button" onClick={onBack}><ArrowLeft size={16} /> Back to the tunnel</button>
    <div className="lab-heading"><div><span className="eyebrow"><FlaskConical size={14} /> THE BUSINESS SIDE</span><h1>Keep the fun.<br /><em>Test the numbers.</em></h1></div><p>More ads can earn more per session and lose returning players. Explore that tradeoff before spending money.</p></div>
    <div className="model-notice"><Info size={19} /><p><strong>A model, not a revenue forecast.</strong> Every number below is an editable assumption. There is no ad SDK, no live ad delivery, and no money earned in this prototype.</p></div>
    <div className="lab-grid">
      <section className="lab-card assumptions"><div className="section-heading"><h2>Your assumptions</h2><button className="text-button" onClick={() => setInputs(DEFAULT_INPUTS)}>Reset</button></div>
        <Slider label="Daily active players" name="dailyPlayers" value={inputs.dailyPlayers} display={inputs.dailyPlayers.toLocaleString()} min={0} max={10000} step={100} onChange={change} />
        <Slider label="Sessions per player / day" name="sessionsPerPlayer" value={inputs.sessionsPerPlayer} display={inputs.sessionsPerPlayer.toFixed(1)} min={1} max={5} step={0.1} onChange={change} />
        <Slider label="Rounds per session" name="roundsPerSession" value={inputs.roundsPerSession} display={String(inputs.roundsPerSession)} min={1} max={10} onChange={change} />
        <Slider label="Seconds per round" name="secondsPerRound" value={inputs.secondsPerRound} display={`${inputs.secondsPerRound}s`} min={20} max={300} step={10} onChange={change} />
        <Slider label="Sessions from returning players" name="returningShare" value={inputs.returningShare} display={`${Math.round(inputs.returningShare * 100)}%`} min={0} max={1} step={0.05} onChange={change} />
        <Slider label="Round-end reward opt-in" name="rewardedOptIn" value={inputs.rewardedOptIn} display={`${Math.round(inputs.rewardedOptIn * 100)}%`} min={0} max={1} step={0.05} onChange={change} />
        <Slider label="Ad fill rate" name="fillRate" value={inputs.fillRate} display={`${Math.round(inputs.fillRate * 100)}%`} min={0} max={1} step={0.05} onChange={change} />
        <div className="ecpm-inputs"><label>Interstitial eCPM ($)<input aria-label="Interstitial eCPM in dollars" type="number" min="0" max="100" step="0.5" value={inputs.interstitialEcpm} onChange={e => change('interstitialEcpm', Math.max(0, Number(e.target.value)))} /></label><label>Rewarded eCPM ($)<input aria-label="Rewarded eCPM in dollars" type="number" min="0" max="100" step="0.5" value={inputs.rewardedEcpm} onChange={e => change('rewardedEcpm', Math.max(0, Number(e.target.value)))} /></label></div>
        <p className="field-note">eCPM means revenue per 1,000 filled ad impressions.</p>
        <Slider label="Hypothetical traffic lost to ads" name="trafficLoss" value={inputs.trafficLoss} display={`${Math.round(inputs.trafficLoss * 100)}%`} min={0} max={0.5} step={0.01} onChange={change} />
        <label className="cost-input">Monthly costs ($)<input aria-label="Monthly costs in dollars" type="number" min="0" step="10" value={inputs.monthlyCosts} onChange={e => change('monthlyCosts', Math.max(0, Number(e.target.value)))} /></label>
      </section>
      <div className="lab-results"><section className="lab-card revenue-card"><span className="eyebrow"><TrendingUp size={14} /> MODELED GROSS AD REVENUE</span><div className="revenue-number">{money(estimate.monthly)}<span>/ 30 days</span></div><p>About {money(estimate.daily)} / day with these assumptions.</p><div className="policy-tabs" aria-label="Modeled ad policy">{POLICIES.map((p, index) => <button key={p.id} aria-pressed={index === policyIndex} className={index === policyIndex ? 'active' : ''} onClick={() => setPolicyIndex(index)}>{p.name}</button>)}</div><div className="policy-bars" aria-label="Monthly revenue comparison">{POLICIES.map(p => { const value = estimateRevenue(inputs, p).monthly; return <div key={p.id}><span>{p.name}</span><div><i style={{ width: `${value / maxRevenue * 100}%` }} /></div><strong>{money(value)}</strong></div>; })}</div><div className="model-margin"><span>After your entered costs</span><strong>{money(estimate.margin)}<small> / 30 days</small></strong></div><p className="field-note">Simplified steady-traffic illustration. Not a cohort LTV model. Include acquisition, platform, operating and other costs above. Actual profit needs measured retention, impressions and costs.</p></section>
      <section className="lab-card"><span className="eyebrow"><ShieldCheck size={14} /> PLACEMENT SANDBOX</span><h2>A break, not an interruption.</h2><p className="muted">Policy decisions only; this does not display an ad.</p><div className="sandbox-toggles"><label><input type="checkbox" checked={activePlay} onChange={e => setActivePlay(e.target.checked)} /> Player is in the middle of a round</label><label><input type="checkbox" checked={firstSession} onChange={e => setFirstSession(e.target.checked)} /> This is their first session</label></div><div className={`decision ${decision.allowed ? 'eligible' : ''}`}><span className="status-dot" />{decision.reason}</div><ul className="policy-facts"><li>At least {policy.minimumRounds} rounds and {policy.minimumSeconds / 60} minutes of play</li><li>{policy.cooldownSeconds / 60}-minute cooldown; at most {policy.maxPerSession} per session</li><li>First session, active play and reward recovery protected</li></ul></section></div>
    </div>
    <section className="lab-card local-metrics"><div className="section-heading"><div><span className="eyebrow">OBSERVED IN THIS BROWSER</span><h2>A small, honest starting point.</h2></div><button className="secondary-button" onClick={exportEvents}><ArrowDownToLine size={16} /> Export events</button></div><div className="metric-grid"><div><strong>{sessions}</strong><span>Browser sessions</span></div><div><strong>{rounds.size}</strong><span>Runs reaching game over</span></div><div><strong>{observedRewards}</strong><span>Demo rescues used</span></div><div><strong>$0</strong><span>Actual ad revenue</span></div></div><p className="field-note">Local-only events; nothing is sent to a server. D1/D7 retention, global players and real revenue are not measured. Revenue inputs above do not use these local counts.</p></section>
  </main>;
}
