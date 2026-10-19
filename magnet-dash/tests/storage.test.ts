import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordRun } from '../src/storage.ts';
import type { PlayerData, RunResult } from '../src/storage.ts';

const player: PlayerData = { bestDistance: 0, bestScore: 0, totalRuns: 0, totalCoins: 0, sound: false, recent: [] };
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
