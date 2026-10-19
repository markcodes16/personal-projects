import type { GameState } from '../src/game.ts';

// Test driver reads only visible gates and rewards. It has no generation data,
// invulnerability, or direct position/velocity control.
export function shouldFlip(state: GameState) {
  const gate = state.obstacles.find(o => !o.passed && !o.broken);
  const reward = state.orbs.find(o => !o.collected && o.x >= state.distance + state.speed * 0.22);
  const target = gate?.gap && gate.x - state.distance < state.speed * 0.45
    ? gate.gap.center : reward?.y ?? gate?.gap?.center ?? 283;
  const projectedY = state.y + state.vy * 0.24;
  return state.gravity === 1 ? projectedY > target + 28 : projectedY < target - 28;
}
