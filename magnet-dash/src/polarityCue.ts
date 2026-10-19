import type { GameState, Side } from './game';

export type PolarityCue = { required: Side; matched: boolean; firstGate: boolean; gateId: number };

/** Warn about the immediate upcoming polarity gate, before the crossing line. */
export function polarityCue(state: Pick<GameState, 'phase' | 'obstacles' | 'distance' | 'speed' | 'gravity' | 'polarityPasses'>): PolarityCue | null {
  if (state.phase !== 'playing') return null;
  const next = state.obstacles.find(obstacle => !obstacle.passed && !obstacle.broken);
  if (!next || next.required === undefined || next.crossed) return null;
  const distanceToLine = next.x + next.width / 2 - state.distance;
  if (distanceToLine < 0 || distanceToLine > Math.max(900, state.speed * 2.25)) return null;
  return { required: next.required, matched: state.gravity === next.required,
    firstGate: state.polarityPasses === 0, gateId: next.id };
}
