import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOTTOM_RAIL, createRun, difficultyAt, FIXED_STEP, obstacleRects, PATTERNS, patternAt, ROBOT_RADIUS, START_Y, startRun, stepRun, TOP_RAIL } from '../src/game.ts';

function longCourse(seed: number) {
  const state = startRun(createRun(seed));
  const opening = [...state.obstacles];
  // Fast-forward world position to force generation well beyond the difficulty
  // cap. This examines terrain deterministically, not human playability.
  state.distance = 120000;
  const later = stepRun(state, FIXED_STEP);
  assert.equal(later.phase, 'playing');
  return [...opening, ...later.obstacles].sort((a, b) => a.id - b.id);
}

test('seeded pattern bags shuffle six sequences without immediate duplicates', () => {
  const courseOrders = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    assert.equal(patternAt(seed, 0), 'CLIMB', 'Keep the first learning section predictable');
    const sequence = Array.from({ length: 36 }, (_, n) => patternAt(seed, n * 4));
    courseOrders.add(sequence.slice(1, 6).join(','));
    for (let cycle = 0; cycle < 6; cycle++) {
      const bag = sequence.slice(cycle * 6, cycle * 6 + 6);
      assert.deepEqual(new Set(bag), new Set(PATTERNS), 'Each bag must include every sequence');
    }
    for (let n = 1; n < sequence.length; n++) {
      assert.notEqual(sequence[n], sequence[n - 1], 'Never repeat a sequence at a bag boundary');
    }
  }
  assert.ok(courseOrders.size > 20, 'Different seeds should give meaningfully different sequence orders');
});

test('procedural routes stay bounded, preserve bonuses and require no forced polarity', () => {
  let totalBranches = 0, totalSqueezes = 0;
  const signatures = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    const gates = longCourse(seed);
    assert.equal(gates[0].gap?.center, START_Y);
    signatures.add(gates.slice(4, 20).map(gate => Math.round(gate.gap!.center) + gate.pattern!).join('/'));
    for (let i = 0; i < gates.length; i++) {
      const gate = gates[i];
      const { center, size } = gate.gap!;
      assert.ok(!('required' in gate), 'Do not reintroduce direction-required gates');
      assert.ok(size >= 135 && size <= 220);
      assert.ok(center - size / 2 >= TOP_RAIL + ROBOT_RADIUS + 4);
      assert.ok(center + size / 2 <= BOTTOM_RAIL - ROBOT_RADIUS - 4);
      assert.equal(gate.pattern, patternAt(seed, gate.id));
      assert.ok(obstacleRects(gate).every(segment => segment.height > 0));
      if (gate.branch) {
        totalBranches++;
        assert.ok(gate.branch.center + gate.branch.size / 2 + 16 < center - size / 2, 'Bonus passage needs a separating wall');
      }
      if (gate.kind === 'squeeze') totalSqueezes++;
      if (i > 0 && gate.id === gates[i - 1].id + 1) {
        assert.ok(gate.x - gates[i - 1].x >= 550, 'Enough time to respond to each gate');
        assert.ok(Math.abs(center - gates[i - 1].gap!.center) <= 110.001,
          `Seed ${seed}: jump from ${gates[i - 1].gap!.center} to ${center}`);
      }
    }
  }
  assert.ok(totalBranches > 200 && totalSqueezes > 1000, 'Keep optional rewards and squeeze challenge available');
  assert.ok(signatures.size > 90, 'Routes should vary beyond a different seed label');
});

test('same seed gives the same sequence and geometry across a long course', () => {
  const first = longCourse(425);
  const again = longCourse(425);
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, longCourse(426));
  assert.equal(difficultyAt(100000).opening, 158, 'Keep the established difficulty ceiling');
});

test('after the intro, frequent gates physically force leaving the center corridor', () => {
  const requiredDeviation = 30;
  for (let seed = 1; seed <= 100; seed++) {
    const course = longCourse(seed).filter(gate => gate.id < 52);
    const challenges = course.filter(gate => {
      const gap = gate.gap!;
      // A robot must fit entirely inside the gap; an allowed middle corridor
      // of +/-30 is insufficient at a committed altitude gate.
      return Math.abs(gap.center - START_Y) > gap.size / 2 - ROBOT_RADIUS + requiredDeviation;
    });
    const high = challenges.filter(gate => gate.gap!.center < START_Y).length;
    const low = challenges.filter(gate => gate.gap!.center > START_Y).length;
    assert.ok(challenges.length >= 14, `Seed ${seed}: only ${challenges.length} meaningful altitude changes`);
    assert.ok(high >= 5 && low >= 5, `Seed ${seed}: need challenges in both directions (${high} up, ${low} down)`);
    // The first gate must remain forgiving; the next few demonstrate ascent
    // without turning the control into an instant-velocity jump.
    assert.equal(course[0].gap?.center, START_Y);
    assert.ok(course.some(gate => gate.id >= 4 && gate.gap!.center > 350));
    assert.ok(course.some(gate => gate.id >= 4 && gate.gap!.center < 210));
  }
});
