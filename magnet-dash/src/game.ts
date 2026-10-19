// World units are independent of canvas size. Ad decisions never alter physics or difficulty.
export const WORLD_HEIGHT = 560;
export const TOP_RAIL = 86;
export const BOTTOM_RAIL = 480;
export const ROBOT_RADIUS = 17;
export const METERS_PER_UNIT = 0.08;
export const FIXED_STEP = 1 / 120;

export type Phase = 'ready' | 'playing' | 'paused' | 'over';
export type Side = -1 | 1;
export type Obstacle = { id: number; x: number; width: number; height: number; side: Side | 0 };
export type Orb = { id: number; x: number; y: number; collected: boolean };
export type GameState = {
  phase: Phase; seed: number; random: number; distance: number; elapsed: number; speed: number;
  y: number; vy: number; gravity: Side; flips: number; coins: number; charge: number;
  surges: number; shield: number; rescued: boolean; crash: { x: number; y: number } | null;
  obstacles: Obstacle[]; orbs: Orb[]; nextObstacleX: number; nextId: number;
};

function random(state: GameState) {
  let seed = state.random | 0;
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  state.random = seed >>> 0;
  return state.random / 4294967296;
}

function populate(state: GameState) {
  while (state.nextObstacleX < state.distance + 2600) {
    const id = state.nextId++;
    const side: Side | 0 = id === 0 ? 1 : id % 5 === 4 ? 0 : random(state) > 0.5 ? 1 : -1;
    const obstacle: Obstacle = { id, x: state.nextObstacleX, width: 64 + Math.floor(random(state) * 30), height: 78 + Math.floor(random(state) * 45), side };
    state.obstacles.push(obstacle);
    const safeY = side === 1 ? TOP_RAIL + 28 : BOTTOM_RAIL - 28;
    state.orbs.push({ id: id * 2, x: obstacle.x - 160, y: safeY, collected: false });
    state.orbs.push({ id: id * 2 + 1, x: obstacle.x + obstacle.width + 45, y: safeY, collected: false });
    // A generous gap allows a full transfer even at maximum speed.
    state.nextObstacleX += 550 + Math.floor(random(state) * 180);
  }
}

export function createRun(seed = 1): GameState {
  const state: GameState = { phase: 'ready', seed: seed >>> 0 || 1, random: seed >>> 0 || 1,
    distance: 0, elapsed: 0, speed: 235, y: BOTTOM_RAIL - ROBOT_RADIUS, vy: 0, gravity: 1,
    flips: 0, coins: 0, charge: 0, surges: 0, shield: 0, rescued: false, crash: null,
    obstacles: [], orbs: [], nextObstacleX: 900, nextId: 0 };
  populate(state);
  return state;
}

export function startRun(state: GameState): GameState {
  return state.phase === 'ready' ? { ...state, phase: 'playing' } : state;
}

export function flip(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  return { ...state, gravity: state.gravity === 1 ? -1 : 1, vy: 0, flips: state.flips + 1 };
}

export function togglePause(state: GameState): GameState {
  if (state.phase === 'playing') return { ...state, phase: 'paused' };
  if (state.phase === 'paused') return { ...state, phase: 'playing' };
  return state;
}

export function circleHitsRect(x: number, y: number, radius: number, left: number, top: number, width: number, height: number) {
  const closestX = Math.max(left, Math.min(x, left + width));
  const closestY = Math.max(top, Math.min(y, top + height));
  return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2;
}

export function stepRun(previous: GameState, dt: number): GameState {
  if (previous.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return previous;
  if (dt > FIXED_STEP + 1e-8) {
    let remaining = Math.min(dt, 0.1);
    let state = previous;
    while (remaining > 1e-8 && state.phase === 'playing') {
      const amount = Math.min(FIXED_STEP, remaining);
      state = stepRun(state, amount);
      remaining -= amount;
    }
    return state;
  }
  const state = { ...previous, obstacles: [...previous.obstacles], orbs: previous.orbs.map(orb => ({ ...orb })) };
  state.elapsed += dt;
  state.speed = Math.min(375, 235 + state.elapsed * 1.5);
  state.distance += state.speed * dt;
  state.vy = Math.max(-1050, Math.min(1050, state.vy + state.gravity * 2200 * dt));
  state.y += state.vy * dt;
  if (state.y <= TOP_RAIL + ROBOT_RADIUS) { state.y = TOP_RAIL + ROBOT_RADIUS; state.vy = 0; }
  if (state.y >= BOTTOM_RAIL - ROBOT_RADIUS) { state.y = BOTTOM_RAIL - ROBOT_RADIUS; state.vy = 0; }
  state.shield = Math.max(0, state.shield - dt);
  for (const orb of state.orbs) {
    if (!orb.collected && Math.hypot(orb.x - state.distance, orb.y - state.y) < ROBOT_RADIUS + 13) {
      orb.collected = true; state.coins++; state.charge++;
      if (state.charge === 5) { state.charge = 0; state.shield = 4; state.surges++; }
    }
  }
  for (const obstacle of state.obstacles) {
    const top = obstacle.side === 1 ? BOTTOM_RAIL - obstacle.height : obstacle.side === -1 ? TOP_RAIL : (TOP_RAIL + BOTTOM_RAIL - obstacle.height) / 2;
    if (state.shield === 0 && circleHitsRect(state.distance, state.y, ROBOT_RADIUS - 2, obstacle.x, top, obstacle.width, obstacle.height)) {
      state.phase = 'over'; state.crash = { x: state.distance, y: state.y }; break;
    }
  }
  state.obstacles = state.obstacles.filter(obstacle => obstacle.x + obstacle.width > state.distance - 200);
  state.orbs = state.orbs.filter(orb => orb.x > state.distance - 200);
  populate(state);
  return state;
}

export function rescue(state: GameState): GameState {
  if (state.phase !== 'over' || state.rescued) return state;
  return { ...state, phase: 'playing', rescued: true, shield: 2.5, crash: null,
    obstacles: state.obstacles.filter(obstacle => obstacle.x > state.distance + 320),
    y: state.gravity === 1 ? BOTTOM_RAIL - ROBOT_RADIUS : TOP_RAIL + ROBOT_RADIUS, vy: 0 };
}

export function distanceMeters(state: GameState) { return Math.floor(state.distance * METERS_PER_UNIT); }
export function score(state: GameState) { return distanceMeters(state) + state.coins * 10; }

export function dailySeed(date: string): number {
  let hash = 2166136261;
  for (const char of date) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0 || 1;
}
