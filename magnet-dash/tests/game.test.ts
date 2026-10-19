import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOTTOM_RAIL, circleClearance, createRun, dailySeed, difficultyAt, distanceMeters, FIXED_STEP, flip, MAX_SPEED, obstacleRects, rescue, ROBOT_RADIUS, score, START_SPEED, startRun, stepRun, togglePause, TOP_RAIL } from '../src/game.ts';
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
  assert.ok(first.coins < 4, 'An immediate flip misses the airborne trail');
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

test('shield capsules appear as distinct, rare airborne pickups', () => {
  const state = createRun(12);
  state.distance = 2000;
  const populated = stepRun(startRun(state), FIXED_STEP);
  assert.ok(populated.pickups.length > 0);
  for (const p of populated.pickups) {
    assert.equal(p.kind, 'shield');
    assert.ok(p.y > TOP_RAIL + 70 && p.y < BOTTOM_RAIL - 70);
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

test('daily layouts are deterministic and opening zigzags leave transfer room', () => {
  assert.equal(dailySeed('2026-10-19'), dailySeed('2026-10-19'));
  assert.notEqual(dailySeed('2026-10-19'), dailySeed('2026-10-20'));
  assert.deepEqual(createRun(141).obstacles, createRun(141).obstacles);
  assert.notDeepEqual(createRun(141).obstacles, createRun(142).obstacles);
  for (let seed = 1; seed <= 100; seed++) {
    const state = createRun(seed);
    assert.deepEqual(state.obstacles.slice(0, 4).map(o => o.side), [1, -1, 1, -1]);
    for (let i = 1; i < state.obstacles.length; i++) assert.ok(state.obstacles[i].x - state.obstacles[i-1].x >= 350);
    assert.ok(state.obstacles.filter(o => o.kind !== 'squeeze').every(o => o.height > (BOTTOM_RAIL - TOP_RAIL) / 2));
  }
});

test('30 fps and 120 fps give the same active-time simulation', () => {
  let slow = emptyRun(), fast = emptyRun();
  for (let i = 0; i < 60; i++) slow = stepRun(slow, 1 / 30);
  for (let i = 0; i < 240; i++) fast = stepRun(fast, FIXED_STEP);
  assert.ok(Math.abs(slow.distance - fast.distance) < 0.00001);
  assert.ok(Math.abs(slow.y - fast.y) < 0.00001);
});

test('difficulty raises speed and density while narrowing openings to a reachable limit', () => {
  for (let x = 0; x < 45000; x += 1000) {
    const before = difficultyAt(x), after = difficultyAt(x + 1000);
    assert.ok(after.speed >= before.speed);
    assert.ok(after.spacing < before.spacing);
    assert.ok(after.opening < before.opening);
  }
  assert.equal(difficultyAt(45000).speed, MAX_SPEED);
  assert.equal(difficultyAt(45000).opening, 178);
  assert.equal(difficultyAt(45000).spacing, 350);
  assert.equal(difficultyAt(1e8).opening, 178);
  assert.equal(difficultyAt(1e8).speed, MAX_SPEED);
});

test('squeeze barriers block both rails and leave only the midair passage open', () => {
  const gate: Obstacle = { ...wall(20), width: 18, kind: 'squeeze', gap: { center: 283, size: 200 } };
  for (const y of [TOP_RAIL + ROBOT_RADIUS, BOTTOM_RAIL - ROBOT_RADIUS]) {
    const state = emptyRun(); state.y = y; state.obstacles = [gate];
    assert.equal(advance(state, 0.15).phase, 'over');
  }
  const state = emptyRun(); state.y = 283; state.obstacles = [gate];
  const through = advance(state, 0.15);
  assert.equal(through.phase, 'playing');
  assert.equal(through.dodged, 1);
  const protectedRun = emptyRun(); protectedRun.shield = 1; protectedRun.obstacles = [gate];
  const broken = advance(protectedRun, 0.15);
  assert.equal(broken.phase, 'playing'); assert.equal(broken.shieldHits, 1);
  assert.equal(broken.obstacles[0].broken, true);
});

test('energy trails span the tunnel and a timed opening flip collects the whole arc', () => {
  let state = startRun(createRun(72));
  const opening = state.orbs.filter(o => o.id < 4);
  assert.ok(Math.max(...opening.map(o => o.y)) - Math.min(...opening.map(o => o.y)) > 250);
  const first = state.obstacles[0];
  while (state.distance < first.x - state.speed * 0.29) state = stepRun(state, FIXED_STEP);
  state = advance(flip(state), 0.5);
  assert.equal(state.phase, 'playing'); assert.equal(state.coins, 4);
});

test('early squeeze gates allow a wider input window than expert gates', () => {
  const windows = [3500, 50000].map(distance => {
    const difficulty = difficultyAt(distance);
    const accepted: number[] = [];
    for (let milliseconds = -80; milliseconds <= 80; milliseconds += 2) {
      let state = emptyRun();
      Object.assign(state, { distance, speed: difficulty.speed, elapsed: (difficulty.speed - START_SPEED) / 6 });
      const gate: Obstacle = { ...wall(distance + 350), width: 14 + 4 * difficulty.progress,
        kind: 'squeeze', gap: { center: 283, size: difficulty.opening } };
      state.obstacles = [gate];
      let tapped = false;
      for (let tick = 0; tick < 240 && state.phase === 'playing' && !state.obstacles[0].passed; tick++) {
        const lead = (Math.sqrt(1100 ** 2 + 10000 * 180) - 1100) / 5000 + milliseconds / 1000;
        if (!tapped && gate.x + gate.width / 2 - state.distance <= state.speed * lead) { state = flip(state); tapped = true; }
        state = stepRun(state, FIXED_STEP);
      }
      if (state.phase === 'playing' && state.obstacles[0].passed) accepted.push(milliseconds);
    }
    return Math.max(...accepted) - Math.min(...accepted);
  });
  assert.ok(windows[0] >= 60, `Opening window: ${windows[0]}ms`);
  assert.ok(windows[1] >= 30 && windows[1] <= windows[0] - 20, `Expert window: ${windows[1]}ms`);
});

test('thirty seeded two-minute routes stay navigable without shields, including the tightest gates', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = startRun(createRun(seed));
    let squeezed = 0, tightGates = 0, airborneShields = 0, lastFlipAt = -1;
    const seen = new Set<number>();
    for (let tick = 0; tick < 120 * 120 && state.phase === 'playing'; tick++) {
      const next = state.obstacles.find(o => !o.passed && !o.broken);
      if (next && state.gravity === next.side) {
        // Aim the center of a normal ballistic transfer at the physical opening.
        // This test drives actual inputs through collision detection, not invulnerability.
        const dy = next.gap ? Math.abs(state.y - next.gap.center) : 0;
        const lead = next.gap ? (Math.sqrt(1100 ** 2 + 10000 * dy) - 1100) / 5000 : 0.29;
        const targetX = next.x + (next.gap ? next.width / 2 : 0);
        if (targetX - state.distance <= state.speed * lead) {
          assert.ok(state.elapsed - lastFlipAt >= 0.09, 'Must respect touch debounce');
          state = flip(state); lastFlipAt = state.elapsed;
        }
      }
      state.shield = 0;
      state = stepRun(state, FIXED_STEP);
      assert.equal(state.shieldHits, 0, 'The route must never rely on a shield');
      if (state.shield) airborneShields++;
      for (const o of state.obstacles) {
        if (o.gap && o.passed && !seen.has(o.id)) { seen.add(o.id); squeezed++; if (o.gap.size <= 179) tightGates++; }
        for (const orb of state.orbs.filter(orb => Math.floor(orb.id / 4) === o.id)) {
          assert.ok(obstacleRects(o).every(rect => circleClearance(orb.x, orb.y, 11, o.x, rect.top, o.width, rect.height) >= 0), 'Energy must stay out of barriers');
        }
      }
    }
    assert.equal(state.phase, 'playing', `Seed ${seed} died at ${state.elapsed.toFixed(2)} seconds`);
    assert.ok(state.elapsed >= 119.9);
    assert.ok(state.flips > 100, `Seed ${seed} needed only ${state.flips} inputs`);
    assert.ok(squeezed > 20 && tightGates > 8, `Seed ${seed}: ${squeezed} gates, ${tightGates} tight`);
    assert.ok(airborneShields > 5, 'Airborne shields must be physically collectible');
    assert.ok(state.coins >= state.dodged * 3.8, 'The flight trails must remain collectible at every tier');
  }
});
