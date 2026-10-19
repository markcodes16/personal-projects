import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCueMixer } from '../src/sound.ts';

test('sustained x5 uses shorter, quieter, lower notes instead of repeating a celebration', () => {
  const mix = createCueMixer();
  const ordinary = mix('coin', 0, 2)!;
  const capped = mix('coin', 1, 5)!;
  const celebration = mix('combo', 1, 5)!;
  assert.ok(capped.volume < ordinary.volume / 2);
  assert.ok(capped.duration < ordinary.duration);
  assert.ok(capped.root < ordinary.root);
  assert.equal(capped.notes.length, 1);
  assert.equal(celebration.notes.length, 3);
});

test('dense max-flow pickups are rate limited and varied without blocking important sounds', () => {
  const mix = createCueMixer();
  const notes = Array.from({ length: 120 }, (_, frame) => mix('coin', frame / 120, 5)).filter(cue => cue !== undefined);
  assert.ok(notes.length >= 7 && notes.length <= 9);
  assert.ok(new Set(notes.map(cue => cue.root)).size >= 3);
  assert.ok(notes.every(cue => cue.root <= 494));
  for (const kind of ['shield', 'break', 'crash', 'flip'] as const) assert.ok(mix(kind, 0.999, 5));
  mix('start', 1);
  assert.ok(mix('coin', 1, 5), 'A new run resets pickup throttling');
});
