import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOTTOM_RAIL, createRun, dailySeed, distanceMeters, FIXED_STEP, flip, rescue, ROBOT_RADIUS, score, startRun, stepRun, togglePause, TOP_RAIL } from '../src/game.ts';

test('ready and paused states do not advance or accept flips', () => {
  const ready = createRun(22);
  assert.equal(stepRun(ready, 0.1), ready);
  assert.equal(flip(ready), ready);
  const paused = togglePause(startRun(ready));
  assert.equal(paused.phase, 'paused');
  assert.equal(stepRun(paused, 0.1), paused);
  assert.equal(flip(paused), paused);
  assert.equal(togglePause(paused).phase, 'playing');
});

test('one flip transfers to the opposite rail with bounded position', () => {
  let state = flip(startRun(createRun(1)));
  for (let i = 0; i < 100; i++) state = stepRun(state, FIXED_STEP);
  assert.equal(state.y, TOP_RAIL + ROBOT_RADIUS);
  assert.equal(state.flips, 1);
  assert.equal(state.phase, 'playing');
  state = flip(state);
  for (let i = 0; i < 100; i++) state = stepRun(state, FIXED_STEP);
  assert.equal(state.y, BOTTOM_RAIL - ROBOT_RADIUS);
});

test('unattended run collides with the first floor obstacle and freezes', () => {
  let state = startRun(createRun(72));
  for (let i = 0; i < 1000 && state.phase === 'playing'; i++) state = stepRun(state, FIXED_STEP);
  assert.equal(state.phase, 'over');
  assert.ok(state.elapsed > 3);
  assert.ok(state.elapsed < 5);
  assert.ok(distanceMeters(state) > 50);
  assert.equal(stepRun(state, 1), state);
});

test('correct polarity avoids the first obstacle and collects charge', () => {
  let state = flip(startRun(createRun(72)));
  for (let i = 0; i < 540; i++) state = stepRun(state, FIXED_STEP);
  assert.equal(state.phase, 'playing');
  assert.ok(state.coins >= 1);
  assert.equal(score(state), distanceMeters(state) + state.coins * 10);
});

test('rescue is limited to one per run and preserves later generated terrain', () => {
  let state = startRun(createRun(72));
  for (let i = 0; i < 1000 && state.phase === 'playing'; i++) state = stepRun(state, FIXED_STEP);
  const later = state.obstacles.filter(obstacle => obstacle.x > state.distance + 320);
  const restored = rescue(state);
  assert.equal(restored.phase, 'playing');
  assert.equal(restored.rescued, true);
  assert.equal(restored.shield, 2.5);
  assert.deepEqual(restored.obstacles, later);
  const ended = { ...restored, phase: 'over' as const };
  assert.equal(rescue(ended), ended);
});

test('daily seeds reproduce terrain, independent of ads and player scores', () => {
  assert.equal(dailySeed('2026-10-19'), dailySeed('2026-10-19'));
  assert.notEqual(dailySeed('2026-10-19'), dailySeed('2026-10-20'));
  assert.deepEqual(createRun(141).obstacles, createRun(141).obstacles);
  assert.notDeepEqual(createRun(141).obstacles, createRun(142).obstacles);
  for (let seed = 1; seed <= 100; seed++) {
    const obstacles = createRun(seed).obstacles;
    for (let index = 1; index < obstacles.length; index++) {
      assert.ok(obstacles[index].x - obstacles[index - 1].x >= 550);
      assert.ok(obstacles[index].height < (BOTTOM_RAIL - TOP_RAIL) / 2);
    }
  }
});

test('equivalent fixed time at 30 and 120 fps yields the same simulation', () => {
  let slower = startRun(createRun(23));
  let faster = startRun(createRun(23));
  for (let i = 0; i < 60; i++) slower = stepRun(slower, 1 / 30);
  for (let i = 0; i < 240; i++) faster = stepRun(faster, 1 / 120);
  assert.ok(Math.abs(slower.distance - faster.distance) < 0.00001);
  assert.ok(Math.abs(slower.y - faster.y) < 0.00001);
});

test('collecting the fifth orb automatically activates a four-second surge', () => {
  const state = startRun(createRun(1));
  state.charge = 4;
  state.orbs = [{ id: 99, x: 1, y: state.y, collected: false }];
  const after = stepRun(state, FIXED_STEP);
  assert.equal(after.coins, 1);
  assert.equal(after.charge, 0);
  assert.equal(after.surges, 1);
  assert.equal(after.shield, 4);
});

test('generated terrain supports an early-flip route over thirty seeded minute-long runs', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = startRun(createRun(seed));
    for (let tick = 0; tick < 120 * 60 && state.phase === 'playing'; tick++) {
      const obstacle = state.obstacles.find(o => o.x + o.width + 35 > state.distance);
      if (obstacle && obstacle.side !== 0 && obstacle.x - state.distance < state.speed * 0.95 && state.gravity === obstacle.side) state = flip(state);
      state = stepRun(state, FIXED_STEP);
    }
    assert.equal(state.phase, 'playing', `Seed ${seed} should have a navigable route`);
    assert.ok(state.elapsed >= 59.9);
  }
});
