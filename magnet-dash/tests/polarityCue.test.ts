import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, flip, startRun } from '../src/game.ts';
import { polarityCue } from '../src/polarityCue.ts';

function approachingGate() {
  const run = startRun(createRun(1));
  const gate = { ...run.obstacles[0], id: 16, x: 850, width: 28, required: -1 as const,
    crossed: false, passed: false, broken: false };
  run.obstacles = [gate];
  return { run, gate };
}

test('polarity instruction warns before the gate and confirms the chosen pull', () => {
  const { run } = approachingGate();
  assert.deepEqual(polarityCue(run), { required: -1, matched: false, firstGate: true, gateId: 16 });
  assert.equal(polarityCue(flip(run))?.matched, true, 'One tap should make the UP gate matched');
  run.polarityPasses = 1;
  assert.equal(polarityCue(run)?.firstGate, false);
  run.phase = 'paused';
  assert.equal(polarityCue(run), null);
});

test('polarity instruction does not distract from earlier hazards or already crossed gates', () => {
  const { run, gate } = approachingGate();
  run.obstacles = [{ ...gate, x: 1600 }];
  assert.equal(polarityCue(run), null, 'Hide gates more than the reaction window away');
  run.obstacles = [{ ...gate, crossed: true }];
  assert.equal(polarityCue(run), null);
  run.obstacles = [gate];
  run.distance = 900;
  assert.equal(polarityCue(run), null, 'Hide gates once the crossing line is behind the player');
  run.distance = 0;
  run.obstacles = [{ ...gate, id: 1, x: 200, required: undefined }, gate];
  assert.equal(polarityCue(run), null, 'Never warn about a polarity gate behind an earlier obstacle');
  run.obstacles = [{ ...gate, id: 1, passed: true }, gate];
  assert.equal(polarityCue(run)?.required, -1);
});
