// Seeded terrain and physics are independent of ads. All timings use active play time.
export const WORLD_HEIGHT = 560;
export const TOP_RAIL = 86;
export const BOTTOM_RAIL = 480;
export const ROBOT_RADIUS = 17;
export const METERS_PER_UNIT = 0.08;
export const FIXED_STEP = 1 / 120;
export const START_SPEED = 400;
export const MAX_SPEED = 640;
export const GRAVITY_PULL = 1100;
export const AIR_DRAG = 1.4;
export const MAX_VERTICAL_SPEED = 320;
export const RUN_ACCELERATION = 4;
export const START_Y = (TOP_RAIL + BOTTOM_RAIL) / 2;

export type Phase = 'ready' | 'playing' | 'paused' | 'over';
export type Side = -1 | 1;
export type Obstacle = {
  id: number; x: number; width: number; height: number; side: Side | 0;
  kind: 'wall' | 'laser' | 'drone' | 'squeeze'; gap?: { center: number; size: number };
  passed: boolean; broken: boolean; closest: number;
};
export type Orb = { id: number; x: number; y: number; collected: boolean };
export type Pickup = Orb & { kind: 'shield' };
export type EffectKind = 'flip' | 'land' | 'coin' | 'combo' | 'near' | 'shield' | 'break' | 'crash';
export type Effect = { id: number; kind: EffectKind; x: number; y: number; age: number; value: number };
export type GameState = {
  phase: Phase; seed: number; random: number; distance: number; elapsed: number; speed: number;
  y: number; vy: number; angle: number; gravity: Side; flips: number; coins: number;
  chain: number; combo: number; maxCombo: number; bonus: number; dodged: number; nearMisses: number;
  shield: number; shieldHits: number; rescued: boolean; crash: { x: number; y: number } | null;
  obstacles: Obstacle[]; orbs: Orb[]; pickups: Pickup[]; effects: Effect[];
  trail: { x: number; y: number }[]; effectId: number; nextObstacleX: number; nextId: number;
  lastGateX: number; lastGapY: number;
};

function random(state: GameState) {
  let seed = state.random | 0;
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  state.random = seed >>> 0;
  return state.random / 4294967296;
}
function emit(state: GameState, kind: EffectKind, x: number, y: number, value = 0) {
  state.effects.push({ id: ++state.effectId, kind, x, y, age: 0, value });
}
export function difficultyAt(distance: number) {
  // Terrain uses its world position, so generating ahead cannot skip a tier.
  const progress = Math.max(0, Math.min(1, distance / 36000));
  return { progress, sector: 1 + Math.floor(Math.max(0, distance) / 6500),
    speed: Math.min(MAX_SPEED, Math.sqrt(START_SPEED ** 2 + 2 * RUN_ACCELERATION * Math.max(0, distance))),
    spacing: 550 - 70 * progress, opening: 230 - 64 * progress };
}
function populate(state: GameState) {
  while (state.nextObstacleX < state.distance + 2800) {
    const id = state.nextId++;
    const difficulty = difficultyAt(state.nextObstacleX);
    // Every gate blocks both rails. Bounded height changes and longer approach
    // times leave room to brake and steer with momentum instead of snapping.
    const squeeze = id >= 3 && id % (difficulty.progress < 0.5 ? 4 : 3) === 2;
    const kind = squeeze ? 'squeeze' : id % 4 === 1 ? 'laser' : 'wall';
    const width = squeeze ? 30 + 8 * difficulty.progress : kind === 'laser' ? 28 : 52 + Math.floor(random(state) * 17);
    const size = difficulty.opening - (squeeze ? 20 : 0);
    const desired = START_Y + (random(state) - 0.5) * (130 + 70 * difficulty.progress);
    const shift = 65 + 20 * difficulty.progress;
    const center = id === 0 ? START_Y : Math.max(TOP_RAIL + size / 2 + 38, Math.min(BOTTOM_RAIL - size / 2 - 38,
      Math.max(state.lastGapY - shift, Math.min(state.lastGapY + shift, desired))));
    const gap = { center, size };
    const obstacle: Obstacle = { id, x: state.nextObstacleX, width, height: 0, side: 0, kind, gap, passed: false, broken: false, closest: Infinity };
    state.obstacles.push(obstacle);
    const gateX = obstacle.x + width / 2;
    const bend = (random(state) - 0.5) * 24;
    const point = (fraction: number) => ({ x: state.lastGateX + (gateX - state.lastGateX) * fraction,
      y: state.lastGapY + (center - state.lastGapY) * fraction ** 2 * (3 - 2 * fraction) + Math.sin(fraction * Math.PI) * bend });
    // Smooth airborne trails join the openings, with space to reverse the pull
    // before a turn. Rewards never require touching either rail.
    for (let index = 0; index < 4; index++) state.orbs.push({ id: id * 4 + index, ...point(0.28 + index * 0.22), collected: false });
    if (id % 10 === 5) state.pickups.push({ id, ...point(0.6), kind: 'shield', collected: false });
    state.lastGateX = gateX; state.lastGapY = center;
    state.nextObstacleX += difficulty.spacing + Math.floor(random(state) * 70);
  }
}
export function createRun(seed = 1): GameState {
  const state: GameState = { phase: 'ready', seed: seed >>> 0 || 1, random: seed >>> 0 || 1,
    distance: 0, elapsed: 0, speed: START_SPEED, y: START_Y, vy: 0, angle: 0, gravity: 1,
    flips: 0, coins: 0, chain: 0, combo: 1, maxCombo: 1, bonus: 0, dodged: 0, nearMisses: 0,
    shield: 0, shieldHits: 0, rescued: false, crash: null, obstacles: [], orbs: [], pickups: [], effects: [], trail: [],
    effectId: 0, nextObstacleX: 580, nextId: 0, lastGateX: 0, lastGapY: START_Y };
  populate(state);
  return state;
}
export function startRun(state: GameState): GameState { return state.phase === 'ready' ? { ...state, phase: 'playing' } : state; }
export function flip(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const gravity: Side = state.gravity === 1 ? -1 : 1;
  // Switching changes acceleration, not velocity. Existing momentum has to
  // slow down before the robot starts drifting toward the opposite rail.
  const next = { ...state, gravity, flips: state.flips + 1, effects: [...state.effects] };
  emit(next, 'flip', state.distance, state.y);
  return next;
}
export function togglePause(state: GameState): GameState {
  if (state.phase === 'playing') return { ...state, phase: 'paused' };
  if (state.phase === 'paused') return { ...state, phase: 'playing' };
  return state;
}
export function obstacleTop(obstacle: Obstacle) {
  return obstacle.side === 1 ? BOTTOM_RAIL - obstacle.height : obstacle.side === -1 ? TOP_RAIL : (TOP_RAIL + BOTTOM_RAIL - obstacle.height) / 2;
}
export function obstacleRects(obstacle: Obstacle) {
  if (obstacle.gap) {
    const top = obstacle.gap.center - obstacle.gap.size / 2, bottom = obstacle.gap.center + obstacle.gap.size / 2;
    return [{ top: TOP_RAIL, height: top - TOP_RAIL, side: -1 }, { top: bottom, height: BOTTOM_RAIL - bottom, side: 1 }];
  }
  return [{ top: obstacleTop(obstacle), height: obstacle.height, side: obstacle.side }];
}
export function circleClearance(x: number, y: number, radius: number, left: number, top: number, width: number, height: number) {
  return Math.hypot(x - Math.max(left, Math.min(x, left + width)), y - Math.max(top, Math.min(y, top + height))) - radius;
}
export function circleHitsRect(x: number, y: number, radius: number, left: number, top: number, width: number, height: number) {
  return circleClearance(x, y, radius, left, top, width, height) < 0;
}
export function stepRun(previous: GameState, dt: number): GameState {
  if (!Number.isFinite(dt) || dt <= 0 || previous.phase === 'ready' || previous.phase === 'paused') return previous;
  if (previous.phase === 'over') return { ...previous, effects: previous.effects.map(e => ({ ...e, age: e.age + Math.min(dt, 0.1) })).filter(e => e.age < 0.9) };
  if (dt > FIXED_STEP + 1e-8) {
    let remaining = Math.min(dt, 0.1), state = previous;
    while (remaining > 1e-8 && state.phase === 'playing') { const amount = Math.min(FIXED_STEP, remaining); state = stepRun(state, amount); remaining -= amount; }
    return state;
  }
  const state: GameState = { ...previous, obstacles: previous.obstacles.map(o => ({ ...o })), orbs: previous.orbs.map(o => ({ ...o })),
    pickups: previous.pickups.map(p => ({ ...p })), effects: previous.effects.map(e => ({ ...e, age: e.age + dt })).filter(e => e.age < 0.9) };
  state.elapsed += dt;
  state.speed = Math.min(MAX_SPEED, START_SPEED + state.elapsed * RUN_ACCELERATION);
  state.distance += state.speed * dt;
  state.vy = Math.max(-MAX_VERTICAL_SPEED, Math.min(MAX_VERTICAL_SPEED,
    state.vy + (state.gravity * GRAVITY_PULL - state.vy * AIR_DRAG) * dt));
  const incomingVy = state.vy;
  state.y += state.vy * dt;
  if (state.y <= TOP_RAIL + ROBOT_RADIUS) { state.y = TOP_RAIL + ROBOT_RADIUS; state.vy = 0; }
  if (state.y >= BOTTOM_RAIL - ROBOT_RADIUS) { state.y = BOTTOM_RAIL - ROBOT_RADIUS; state.vy = 0; }
  if (state.vy === 0 && Math.abs(incomingVy) > 180) emit(state, 'land', state.distance, state.y);
  state.angle += (state.vy / MAX_VERTICAL_SPEED * 0.38 - state.angle) * Math.min(1, dt * 10);
  state.trail = [...previous.trail, { x: state.distance, y: state.y }].slice(-15);
  for (const orb of state.orbs) {
    if (!orb.collected && Math.hypot(orb.x - state.distance, orb.y - state.y) < ROBOT_RADIUS + 13) {
      orb.collected = true; state.coins++; state.chain++;
      const combo = Math.min(5, 1 + Math.floor(state.chain / 3));
      if (combo > state.combo) emit(state, 'combo', state.distance, state.y, combo);
      state.combo = combo; state.maxCombo = Math.max(state.maxCombo, combo);
      const value = 10 * state.combo;
      state.bonus += value; emit(state, 'coin', orb.x, orb.y, value);
    } else if (!orb.collected && orb.x < state.distance - ROBOT_RADIUS - 13) {
      orb.collected = true; state.chain = 0; state.combo = 1;
    }
  }
  for (const pickup of state.pickups) {
    if (!pickup.collected && Math.hypot(pickup.x - state.distance, pickup.y - state.y) < ROBOT_RADIUS + 18) {
      pickup.collected = true; state.shield = 1; emit(state, 'shield', pickup.x, pickup.y);
    }
  }
  for (const obstacle of state.obstacles) {
    if (obstacle.broken || obstacle.passed) continue;
    const rects = obstacleRects(obstacle);
    const clearance = Math.min(...rects.map(rect => circleClearance(state.distance, state.y, ROBOT_RADIUS - 2, obstacle.x, rect.top, obstacle.width, rect.height)));
    if (state.distance > obstacle.x - ROBOT_RADIUS && state.distance < obstacle.x + obstacle.width + ROBOT_RADIUS) obstacle.closest = Math.min(obstacle.closest, clearance);
    if (clearance < 0) {
      if (state.shield > 0) {
        state.shield = 0; state.shieldHits++; state.bonus += 50; obstacle.broken = true;
        emit(state, 'break', obstacle.x + obstacle.width / 2, state.y, 50);
      } else {
        state.phase = 'over'; state.crash = { x: state.distance, y: state.y };
        emit(state, 'crash', state.distance, state.y); break;
      }
    } else if (state.distance > obstacle.x + obstacle.width + ROBOT_RADIUS) {
      obstacle.passed = true; state.dodged++; state.bonus += 5;
      if (obstacle.closest > 0 && obstacle.closest < 24) { state.nearMisses++; const value = 25 * state.combo; state.bonus += value; emit(state, 'near', state.distance, state.y, value); }
    }
  }
  state.obstacles = state.obstacles.filter(o => o.x + o.width > state.distance - 200);
  state.orbs = state.orbs.filter(o => o.x > state.distance - 200);
  state.pickups = state.pickups.filter(p => p.x > state.distance - 200);
  populate(state);
  return state;
}
export function rescue(state: GameState): GameState {
  if (state.phase !== 'over' || state.rescued) return state;
  return { ...state, phase: 'playing', rescued: true, shield: 0, crash: null, effects: [], trail: [],
    obstacles: state.obstacles.filter(o => o.x > state.distance + Math.max(900, state.speed * 1.5)),
    y: START_Y, vy: 0 };
}
export function distanceMeters(state: GameState) { return Math.floor(state.distance * METERS_PER_UNIT); }
export function score(state: GameState) { return distanceMeters(state) + state.bonus; }
export function dailySeed(date: string): number {
  let hash = 2166136261;
  for (const char of date) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0 || 1;
}
