import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOTTOM_RAIL, createRun, dailySeed, distanceMeters, FIXED_STEP, flip, rescue, ROBOT_RADIUS, score, START_SPEED, startRun, stepRun, togglePause, TOP_RAIL } from '../src/game.ts';
import type { GameState, Obstacle } from '../src/game.ts';

function advance(state: GameState, seconds: number) {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP) && state.phase === 'playing'; tick++) state = stepRun(state, FIXED_STEP);
  return state;
}
function emptyRun() {
  const state = startRun(createRun(1));
  state.obstacles = []; state.orbs = []; state.pickups = []; state.nextObstacleX = Infinity;
  return state;
}
const wall = (x: number, id = 1): Obstacle => ({ id, x, width: 50, height: 250, side: 1, kind: 'wall', passed: false, broken: false, closest: Infinity });

test('ready and paused states freeze physics and inputs', () => {
  const ready = createRun(22);
  assert.equal(stepRun(ready, 0.1), ready);
  assert.equal(flip(ready), ready);
  const paused = togglePause(startRun(ready));
  assert.equal(paused.phase, 'paused');
  assert.equal(stepRun(paused, 0.1), paused);
  assert.equal(flip(paused), paused);
  assert.equal(togglePause(paused).phase, 'playing');
});

test('polarity switches land on the opposite rail within 0.3 seconds', () => {
  let state = advance(flip(emptyRun()), 0.3);
  assert.equal(state.y, TOP_RAIL + ROBOT_RADIUS);
  assert.equal(state.flips, 1);
  assert.ok(state.effects.some(e => e.kind === 'land'));
  state = advance(flip(state), 0.3);
  assert.equal(state.y, BOTTOM_RAIL - ROBOT_RADIUS);
  assert.equal(state.flips, 2);
});

test('opening starts fast and idle play dies in under 1.5 seconds', () => {
  const initial = startRun(createRun(72));
  assert.equal(initial.speed, START_SPEED);
  assert.ok(START_SPEED >= 400);
  const state = advance(initial, 2);
  assert.equal(state.phase, 'over');
  assert.ok(state.elapsed > 1 && state.elapsed < 1.5, String(state.elapsed));
  const frozen = stepRun(state, 0.1);
  assert.equal(frozen.distance, state.distance);
  assert.equal(frozen.y, state.y);
});

test('one flip cannot camp on the ceiling past the second gate', () => {
  const first = advance(flip(startRun(createRun(72))), 1.6);
  assert.equal(first.phase, 'playing');
  assert.ok(first.coins >= 3);
  assert.equal(first.shield, 0);
  const later = advance(first, 2);
  assert.equal(later.phase, 'over');
  assert.ok(later.elapsed < 2.8);
});

test('energy increases scoring and never awards an automatic shield', () => {
  const state = emptyRun();
  state.chain = 14; state.combo = 5;
  state.orbs = [{ id: 99, x: 1, y: state.y, collected: false }];
  const after = stepRun(state, FIXED_STEP);
  assert.equal(after.coins, 1);
  assert.equal(after.combo, 5);
  assert.equal(after.shield, 0);
  assert.equal(after.bonus, 50);
  assert.equal(score(after), distanceMeters(after) + 50);
});

test('missing energy breaks the multiplier chain', () => {
  const state = emptyRun(); state.chain = 8; state.combo = 3;
  state.orbs = [{ id: 1, x: -60, y: TOP_RAIL, collected: false }];
  const after = stepRun(state, FIXED_STEP);
  assert.equal(after.combo, 1); assert.equal(after.chain, 0); assert.equal(after.coins, 0);
});

test('physical shield pickup absorbs exactly one obstacle hit', () => {
  const state = emptyRun();
  state.pickups = [{ id: 1, kind: 'shield', x: 1, y: state.y, collected: false }];
  let after = stepRun(state, FIXED_STEP);
  assert.equal(after.shield, 1);
  after.obstacles = [wall(after.distance + 1)];
  after = stepRun(after, FIXED_STEP);
  assert.equal(after.phase, 'playing'); assert.equal(after.shield, 0); assert.equal(after.shieldHits, 1);
  assert.equal(after.obstacles[0].broken, true);
  assert.ok(after.effects.some(e => e.kind === 'break'));
  after.obstacles.push(wall(after.distance + 1, 2));
  assert.equal(stepRun(after, FIXED_STEP).phase, 'over');
});

test('shield capsules appear as distinct, rare pickups on reachable rails', () => {
  const state = createRun(12);
  state.distance = 2000;
  const populated = stepRun(startRun(state), FIXED_STEP);
  assert.ok(populated.pickups.length > 0);
  for (const p of populated.pickups) {
    assert.equal(p.kind, 'shield');
    assert.ok(p.y === TOP_RAIL + ROBOT_RADIUS + 2 || p.y === BOTTOM_RAIL - ROBOT_RADIUS - 2);
  }
});

test('rescue clears nearby terrain once without granting a shield', () => {
  const state = advance(startRun(createRun(72)), 2);
  const later = state.obstacles.filter(o => o.x > state.distance + 600);
  const restored = rescue(state);
  assert.equal(restored.phase, 'playing'); assert.equal(restored.rescued, true); assert.equal(restored.shield, 0);
  assert.deepEqual(restored.obstacles, later);
  assert.equal(advance(restored, 0.4).phase, 'playing');
  const ended = { ...restored, phase: 'over' as const };
  assert.equal(rescue(ended), ended);
});

test('a genuine close pass awards a visible skill bonus', () => {
  const state = emptyRun(); state.y = 356;
  state.obstacles = [{ ...wall(20), side: 0, height: 100 }];
  const after = advance(state, 0.3);
  assert.equal(after.phase, 'playing'); assert.equal(after.nearMisses, 1);
  assert.ok(after.effects.some(e => e.kind === 'near'));
  assert.ok(after.bonus >= 30);
});

test('daily layouts are deterministic and terrain includes tall gates and drones', () => {
  assert.equal(dailySeed('2026-10-19'), dailySeed('2026-10-19'));
  assert.notEqual(dailySeed('2026-10-19'), dailySeed('2026-10-20'));
  assert.deepEqual(createRun(141).obstacles, createRun(141).obstacles);
  assert.notDeepEqual(createRun(141).obstacles, createRun(142).obstacles);
  for (let seed = 1; seed <= 100; seed++) {
    const state = createRun(seed);
    assert.deepEqual(state.obstacles.slice(0, 4).map(o => o.side), [1, -1, 1, -1]);
    for (let i = 1; i < state.obstacles.length; i++) assert.ok(state.obstacles[i].x - state.obstacles[i-1].x >= 430);
    assert.ok(state.obstacles.filter(o => o.side !== 0).every(o => o.height > (BOTTOM_RAIL - TOP_RAIL) / 2));
  }
});

test('30 fps and 120 fps give the same active-time simulation', () => {
  let slow = emptyRun(), fast = emptyRun();
  for (let i = 0; i < 60; i++) slow = stepRun(slow, 1 / 30);
  for (let i = 0; i < 240; i++) fast = stepRun(fast, FIXED_STEP);
  assert.ok(Math.abs(slow.distance - fast.distance) < 0.00001);
  assert.ok(Math.abs(slow.y - fast.y) < 0.00001);
});

test('thirty seeded minute-long routes are navigable without shields and require repeated inputs', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = startRun(createRun(seed));
    for (let tick = 0; tick < 120 * 60 && state.phase === 'playing'; tick++) {
      const next = state.obstacles.find(o => !o.passed && !o.broken && o.x + o.width + ROBOT_RADIUS + 12 > state.distance);
      if (next && next.side !== 0 && next.x - state.distance < state.speed * 0.5 && state.gravity === next.side) state = flip(state);
      state.pickups = []; state.shield = 0;
      state = stepRun(state, FIXED_STEP);
    }
    assert.equal(state.phase, 'playing', `Seed ${seed} died at ${state.elapsed.toFixed(2)} seconds`);
    assert.ok(state.elapsed >= 59.9);
    assert.ok(state.flips > 40, `Seed ${seed} needed only ${state.flips} inputs`);
  }
});
