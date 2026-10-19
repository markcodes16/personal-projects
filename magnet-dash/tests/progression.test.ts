import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINISHES, finishFor, missions } from '../src/progression.ts';
import { initialPlayer } from '../src/storage.ts';

test('finishes unlock at energy boundaries and unavailable saved choices fall back safely', () => {
  assert.equal(finishFor({ skin: 'orchid', totalCoins: 0 }).id, 'factory');
  for (const finish of FINISHES.slice(1)) {
    assert.equal(finishFor({ skin: finish.id, totalCoins: finish.energy - 1 }).id, 'factory');
    assert.equal(finishFor({ skin: finish.id, totalCoins: finish.energy }).id, finish.id);
  }
  assert.equal(finishFor({ skin: 'invalid', totalCoins: 999 }).id, 'factory');
});

test('mission milestones advance when completed and keep lifetime progress visible', () => {
  const first = missions(initialPlayer);
  const next = missions({ ...initialPlayer, totalCoins: 60, totalPerfects: 6, totalRisky: 3 });
  assert.deepEqual(first.map(m => m.target), [60, 6, 3]);
  assert.deepEqual(next.map(m => m.target), [120, 12, 6]);
  assert.deepEqual(next.map(m => m.value), [60, 6, 3]);
});
