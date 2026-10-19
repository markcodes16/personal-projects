import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialPlayer, recordRun } from '../src/storage.ts';
import type { PlayerData, RunResult } from '../src/storage.ts';

const player: PlayerData = { ...initialPlayer };
const run: RunResult = { id: 'one-run', distance: 70, score: 90, coins: 2, flips: 3, seconds: 4, mode: 'endless', rescued: false, at: '2026-10-19T00:00:00.000Z' };

test('reviving a run updates its best without duplicating runs or energy', () => {
  const first = recordRun(player, run);
  assert.equal(first.totalRuns, 1);
  assert.equal(first.totalCoins, 2);
  const continued = recordRun(first, { ...run, distance: 130, score: 170, coins: 4, rescued: true });
  assert.equal(continued.totalRuns, 1);
  assert.equal(continued.totalCoins, 4);
  assert.equal(continued.recent.length, 1);
  assert.equal(continued.bestDistance, 130);
  assert.equal(continued.bestScore, 170);
  const replay = recordRun(continued, { ...run, id: 'second-run', distance: 50 });
  assert.equal(replay.totalRuns, 2);
  assert.equal(replay.bestDistance, 130);
  assert.equal(replay.totalCoins, 6);
});

test('career counters update once across a rescue checkpoint', () => {
  const first = recordRun(player, { ...run, perfects: 2, polarityPasses: 1, riskyPasses: 1 });
  const rescued = recordRun(first, { ...run, rescued: true, perfects: 5, polarityPasses: 4, riskyPasses: 2 });
  const repeated = recordRun(rescued, { ...run, rescued: true, perfects: 5, polarityPasses: 4, riskyPasses: 2 });
  assert.equal(repeated.totalPerfects, 5); assert.equal(repeated.totalPolarity, 4); assert.equal(repeated.totalRisky, 2);
  assert.equal(repeated.totalRuns, 1);
});
