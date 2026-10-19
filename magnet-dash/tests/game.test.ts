import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOTTOM_RAIL, circleClearance, createRun, dailySeed, difficultyAt, distanceMeters, FIXED_STEP, flip, MAX_SPEED, MAX_VERTICAL_SPEED, obstacleRects, rescue, ROBOT_RADIUS, RUN_ACCELERATION, score, START_SPEED, START_Y, startRun, stepRun, togglePause, TOP_RAIL } from '../src/game.ts';
import type { GameState, Obstacle } from '../src/game.ts';
import { shouldFlip } from './pilot.ts';

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

test('gravity switches preserve inertia and brake before changing direction', () => {
  const state = emptyRun(); state.vy = 260;
  const switched = flip(state);
  assert.equal(switched.gravity, -1); assert.equal(switched.vy, 260);
  assert.equal(switched.y, state.y); assert.equal(switched.flips, 1);
  const drifting = advance(switched, 0.1);
  assert.ok(drifting.vy > 0 && drifting.vy < 260);
  assert.ok(drifting.y > state.y, 'Existing downward motion continues after the flip');
  const returning = advance(drifting, 0.25);
  assert.ok(returning.vy < 0, 'Opposite gravity eventually reverses motion');
  assert.ok(returning.y > TOP_RAIL + ROBOT_RADIUS, 'The turn does not snap to a rail');
  assert.ok(Math.abs(returning.angle) < 0.5, 'Body lean follows motion instead of a half-turn snap');
});

test('slower capped falls leave time to steer and rail contact does not stick', () => {
  const floating = advance(emptyRun(), 0.4);
  assert.ok(floating.y > START_Y + 40 && floating.y < START_Y + 100);
  assert.ok(floating.vy <= MAX_VERTICAL_SPEED);
  const landed = advance(floating, 1);
  assert.equal(landed.y, BOTTOM_RAIL - ROBOT_RADIUS); assert.equal(landed.vy, 0);
  const rising = advance(flip(landed), 0.3);
  assert.ok(rising.y < landed.y - 25 && rising.y > TOP_RAIL + ROBOT_RADIUS + 100);
  assert.ok(rising.vy < 0);
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

test('holding either polarity cannot ride a rail through the opening gate', () => {
  for (const polarity of [1, -1]) {
    const initial = startRun(createRun(72));
    const state = advance(polarity === 1 ? initial : flip(initial), 2);
    assert.equal(state.phase, 'over'); assert.equal(state.dodged, 0);
    assert.ok(state.elapsed < 1.5);
    assert.equal(state.shieldHits, 0);
  }
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
  const later = state.obstacles.filter(o => o.x > state.distance + Math.max(900, state.speed * 1.5));
  const restored = rescue(state);
  assert.equal(restored.phase, 'playing'); assert.equal(restored.rescued, true); assert.equal(restored.shield, 0);
  assert.deepEqual(restored.obstacles, later);
  assert.equal(restored.y, START_Y); assert.equal(restored.vy, 0);
  assert.equal(advance(restored, 0.4).phase, 'playing');
  const ended = { ...restored, phase: 'over' as const };
  assert.equal(rescue(ended), ended);
});

test('a genuine close pass awards a visible skill bonus', () => {
  const state = emptyRun(); state.y = 360;
  state.obstacles = [{ ...wall(20), side: 0, height: 100 }];
  const after = advance(state, 0.3);
  assert.equal(after.phase, 'playing'); assert.equal(after.nearMisses, 1);
  assert.ok(after.effects.some(e => e.kind === 'near'));
  assert.ok(after.bonus >= 30);
});

test('daily layouts are deterministic and all openings leave room to steer with inertia', () => {
  assert.equal(dailySeed('2026-10-19'), dailySeed('2026-10-19'));
  assert.notEqual(dailySeed('2026-10-19'), dailySeed('2026-10-20'));
  assert.deepEqual(createRun(141).obstacles, createRun(141).obstacles);
  assert.notDeepEqual(createRun(141).obstacles, createRun(142).obstacles);
  for (let seed = 1; seed <= 100; seed++) {
    const state = createRun(seed);
    assert.equal(state.obstacles[0].gap?.center, START_Y);
    for (let i = 1; i < state.obstacles.length; i++) {
      assert.ok(state.obstacles[i].x - state.obstacles[i-1].x >= 550);
      assert.ok(Math.abs(state.obstacles[i].gap!.center - state.obstacles[i-1].gap!.center) <= 110);
    }
    assert.ok(state.obstacles.every(o => o.gap && obstacleRects(o).every(rect => rect.height > 0)));
  }
});

test('30 fps and 120 fps give the same active-time simulation', () => {
  let slow = emptyRun(), fast = emptyRun();
  slow.vy = fast.vy = 230;
  for (let part = 0; part < 4; part++) {
    slow = flip(slow); fast = flip(fast);
    for (let i = 0; i < 9; i++) slow = stepRun(slow, 1 / 30);
    for (let i = 0; i < 36; i++) fast = stepRun(fast, FIXED_STEP);
  }
  assert.ok(Math.abs(slow.distance - fast.distance) < 0.00001);
  assert.ok(Math.abs(slow.y - fast.y) < 0.00001);
  assert.ok(Math.abs(slow.vy - fast.vy) < 0.00001);
});

test('difficulty raises speed and density while narrowing openings to a reachable limit', () => {
  for (let x = 0; x < 36000; x += 1000) {
    const before = difficultyAt(x), after = difficultyAt(x + 1000);
    assert.ok(after.speed >= before.speed);
    assert.ok(after.spacing < before.spacing);
    assert.ok(after.opening < before.opening);
  }
  assert.equal(difficultyAt(36000).speed, MAX_SPEED);
  assert.equal(difficultyAt(36000).opening, 158);
  assert.equal(difficultyAt(36000).spacing, 550);
  assert.equal(difficultyAt(1e8).opening, 158);
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
  const protectedRun = emptyRun(); protectedRun.y = BOTTOM_RAIL - ROBOT_RADIUS; protectedRun.shield = 1; protectedRun.obstacles = [gate];
  const broken = advance(protectedRun, 0.15);
  assert.equal(broken.phase, 'playing'); assert.equal(broken.shieldHits, 1);
  assert.equal(broken.obstacles[0].broken, true);
});

test('pickups trace smooth airborne routes and never require touching the rails', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const state = createRun(seed);
    assert.ok(state.orbs.every(orb => orb.y > TOP_RAIL + 30 && orb.y < BOTTOM_RAIL - 30));
    assert.ok(Math.max(...state.orbs.map(o => o.y)) - Math.min(...state.orbs.map(o => o.y)) > 20);
    for (const orb of state.orbs) for (const o of state.obstacles) {
      assert.ok(obstacleRects(o).every(rect => circleClearance(orb.x, orb.y, 11, o.x, rect.top, o.width, rect.height) >= 0));
    }
  }
});

test('early gates tolerate more steering error while expert gaps remain navigable', () => {
  const windows = [3500, 50000].map(distance => {
    const difficulty = difficultyAt(distance);
    const accepted: number[] = [];
    for (let offset = -120; offset <= 120; offset += 2) {
      let state = emptyRun();
      Object.assign(state, { distance, speed: difficulty.speed, elapsed: (difficulty.speed - START_SPEED) / RUN_ACCELERATION, y: START_Y + offset });
      const gate: Obstacle = { ...wall(distance + 20), width: 30 + 8 * difficulty.progress,
        kind: 'squeeze', gap: { center: START_Y, size: difficulty.opening - 20 } };
      state.obstacles = [gate];
      for (let tick = 0; tick < 120 && state.phase === 'playing' && !state.obstacles[0].passed; tick++) {
        state = stepRun(state, FIXED_STEP);
      }
      if (state.phase === 'playing' && state.obstacles[0].passed) accepted.push(offset);
    }
    return Math.max(...accepted) - Math.min(...accepted);
  });
  assert.ok(windows[0] >= 110, `Opening margin: ${windows[0]}`);
  assert.ok(windows[1] >= 90 && windows[1] <= windows[0] - 20, `Expert margin: ${windows[1]}`);
});

test('thirty seeded two-minute routes stay navigable without shields, including the tightest gates', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = startRun(createRun(seed));
    let squeezed = 0, tightGates = 0, airborneShields = 0, lastFlipAt = -1, airborneTicks = 0;
    const seen = new Set<number>();
    for (let tick = 0; tick < 120 * 120 && state.phase === 'playing'; tick++) {
      // 100ms decisions, a 180ms minimum between taps, and ordinary flips only.
      if (tick % 12 === 0 && state.elapsed - lastFlipAt >= 0.18 && shouldFlip(state)) {
        state = flip(state); lastFlipAt = state.elapsed;
      }
      state.shield = 0;
      state = stepRun(state, FIXED_STEP);
      assert.equal(state.shieldHits, 0, 'The route must never rely on a shield');
      if (state.shield) airborneShields++;
      if (state.y > TOP_RAIL + ROBOT_RADIUS + 2 && state.y < BOTTOM_RAIL - ROBOT_RADIUS - 2) airborneTicks++;
      for (const o of state.obstacles) {
        assert.ok(!('required' in o), 'Generated obstacles must not require a selected pull');
        assert.notEqual(o.pattern, 'POLARITY');
        if (o.kind === 'squeeze' && o.passed && !seen.has(o.id)) { seen.add(o.id); squeezed++; if (o.gap!.size <= 147) tightGates++; }
        for (const orb of state.orbs.filter(orb => Math.floor(orb.id / 8) === o.id)) {
          assert.ok(obstacleRects(o).every(rect => circleClearance(orb.x, orb.y, 11, o.x, rect.top, o.width, rect.height) >= 0), 'Energy must stay out of barriers');
        }
      }
    }
    assert.equal(state.phase, 'playing', `Seed ${seed} died at ${state.elapsed.toFixed(2)} seconds`);
    assert.ok(state.elapsed >= 119.9);
    assert.ok(state.flips > 100 && state.flips < 480, `Seed ${seed} needed ${state.flips} inputs`);
    assert.ok(squeezed >= 16 && tightGates >= 8, `Seed ${seed}: ${squeezed} gates, ${tightGates} tight`);
    assert.ok(airborneShields > 5, 'Airborne shields must be physically collectible');
    assert.ok(state.coins >= state.dodged * 3.3, 'At least 82.5% of the main trail stays collectible with coarse inputs');
    assert.ok(airborneTicks / (120 * 120) > 0.98, 'The intended route must stay in the air');
  }
});

test('center-only hovering cannot ignore the first climb sequence', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = startRun(createRun(seed)), lastFlip = -1;
    for (let tick = 0; tick < 120 * 12 && state.phase === 'playing'; tick++) {
      const projected = state.y + state.vy * 0.24;
      if (tick % 12 === 0 && state.elapsed - lastFlip >= 0.18 && (state.gravity === 1 ? projected > 311 : projected < 255)) { state = flip(state); lastFlip = state.elapsed; }
      state.shield = 0; state = stepRun(state, FIXED_STEP);
    }
    assert.equal(state.phase, 'over'); assert.ok(state.elapsed < 8);
  }
});

test('clear openings accept either gravity direction without a polarity check', () => {
  for (const gravity of [-1, 1] as const) {
    const state = emptyRun(); state.gravity = gravity;
    state.obstacles = [{ ...wall(20), width: 28, gap: { center: START_Y, size: 210 } }];
    const passed = advance(state, 0.2);
    assert.equal(passed.phase, 'playing'); assert.equal(passed.dodged, 1);
    assert.equal(passed.shieldHits, 0);
  }
});

test('controlled central crossings earn a perfect bonus and skipping optional energy preserves flow', () => {
  const state = emptyRun(); state.chain = 14; state.combo = 5;
  state.orbs = [{ id: 1, x: -50, y: 154, optional: true, value: 30, collected: false }];
  state.obstacles = [{ ...wall(20), width: 30, gap: { center: START_Y, size: 210 } }];
  const passed = advance(state, 0.2);
  assert.equal(passed.combo, 5); assert.equal(passed.chain, 14);
  assert.equal(passed.perfects, 1); assert.ok(passed.bonus >= 305);
  assert.ok(passed.effects.some(e => e.kind === 'perfect'));
});

test('split gates offer distinct safe and bonus openings with a higher reward above', () => {
  const gate: Obstacle = { ...wall(20), width: 30, gap: { center: 318, size: 180 }, branch: { center: 154, size: 108 } };
  assert.equal(obstacleRects(gate).length, 3);
  const safe = emptyRun(); safe.y = 318; safe.obstacles = [gate];
  const risky = emptyRun(); risky.y = 154; risky.obstacles = [gate];
  const normal = advance(safe, 0.2), bonus = advance(risky, 0.2);
  assert.equal(normal.phase, 'playing'); assert.equal(bonus.phase, 'playing');
  assert.equal(normal.riskyPasses, 0); assert.equal(bonus.riskyPasses, 1);
  assert.ok(bonus.bonus >= normal.bonus + 150);
});

test('all six authored sequences and optional bonus routes remain playable without shields', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = startRun(createRun(seed)), lastFlip = -1;
    const patterns = new Set<string>();
    for (let tick = 0; tick < 120 * 120 && state.phase === 'playing'; tick++) {
      if (tick % 12 === 0 && state.elapsed - lastFlip >= 0.18 && shouldFlip(state, true)) { state = flip(state); lastFlip = state.elapsed; }
      state.shield = 0; state = stepRun(state, FIXED_STEP);
      for (const gate of state.obstacles) if (gate.passed && gate.pattern) patterns.add(gate.pattern);
      assert.equal(state.shieldHits, 0);
    }
    assert.equal(state.phase, 'playing', `Bonus route seed ${seed}: ${state.crashReason}`);
    assert.equal(patterns.size, 6); assert.ok(state.riskyPasses >= 8);
    assert.ok(state.perfects > 20);
  }
});
