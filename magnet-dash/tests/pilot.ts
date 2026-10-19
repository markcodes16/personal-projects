import type { GameState } from '../src/game.ts';

// Test driver reads only visible gates and rewards. It has no generation data,
// invulnerability, or direct position/velocity control.
export function shouldFlip(state: GameState, takeRisk = false) {
  const gate = state.obstacles.find(o => !o.passed && !o.broken);
  const reward = state.orbs.find(o => !o.collected && !o.value && o.x >= state.distance + state.speed * 0.3);
  if (gate?.required !== undefined && !gate.crossed && gate.x + gate.width / 2 - state.distance < state.speed * 0.3) return state.gravity !== gate.required;
  const target = takeRisk && gate?.branch ? gate.branch.center : gate?.gap && gate.x - state.distance < state.speed * 0.65
    ? gate.gap.center - (gate.required ?? 0) * 22 : reward?.y ?? gate?.gap?.center ?? 283;
  const projectedY = state.y + state.vy * 0.24;
  const margin = takeRisk && gate?.branch ? 18 : 28;
  return state.gravity === 1 ? projectedY > target + margin : projectedY < target - margin;
}
