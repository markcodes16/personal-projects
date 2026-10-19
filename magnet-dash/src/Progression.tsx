import { Check, Lock, Sparkles, Zap } from 'lucide-react';
import { FINISHES, finishFor, missions } from './progression';
import type { PlayerData } from './storage';

export default function Progression({ player, onFinish }: { player: PlayerData; onFinish: (id: string) => void }) {
  const selected = finishFor(player);
  return <section className="progression" aria-label="Missions and robot finishes">
    <div className="section-heading"><span className="eyebrow"><Sparkles size={14} /> YOUR NEXT MISSIONS</span><span className="career-energy"><Zap size={14} /> {player.totalCoins} lifetime energy</span></div>
    <div className="mission-grid">{missions(player).map(mission => <article key={mission.id}>
      <strong>{mission.title}</strong><span>{mission.value} / {mission.target}</span>
      <progress aria-label={mission.title} value={mission.value} max={mission.target} /><small>{mission.unit}</small>
    </article>)}</div>
    <div className="section-heading garage-heading"><span className="eyebrow">ROBOT GARAGE</span><small>Energy unlocks finishes automatically. Your movement stays the same.</small></div>
    <div className="finish-grid">{FINISHES.map(finish => {
      const unlocked = player.totalCoins >= finish.energy;
      return <button key={finish.id} className={`finish-card ${selected.id === finish.id ? 'selected' : ''}`} aria-label={`Equip ${finish.name}`} aria-pressed={selected.id === finish.id} disabled={!unlocked} onClick={() => onFinish(finish.id)}>
        <span className="finish-swatch" style={{ background: finish.body, boxShadow: `0 0 24px ${finish.trail}25` }}>▰</span><strong>{finish.name}</strong>
        <small>{!unlocked ? <><Lock size={11} /> {player.totalCoins}/{finish.energy} energy</> : selected.id === finish.id ? <><Check size={12} /> Equipped</> : 'Ready to equip'}</small>
      </button>;
    })}</div>
  </section>;
}
