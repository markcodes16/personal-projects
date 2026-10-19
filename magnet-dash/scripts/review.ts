// Diagnostic play simulation, not a measurement of human fun or retention.
import { writeFileSync } from 'node:fs';
import { createRun, FIXED_STEP, flip, startRun, stepRun, TOP_RAIL, BOTTOM_RAIL, ROBOT_RADIUS, score } from '../src/game.ts';
import { shouldFlip } from '../tests/pilot.ts';

function benchmark(driver: 'middle' | 'main' | 'bonus') {
  const runs = [];
  for (let seed = 1; seed <= 30; seed++) {
    let state = startRun(createRun(seed)), lastFlip = -1, airborne = 0, ticks = 0;
    for (; ticks < 120 * 120 && state.phase === 'playing'; ticks++) {
      const projected = state.y + state.vy * 0.24;
      const wantsFlip = driver === 'middle' ? (state.gravity === 1 ? projected > 311 : projected < 255) : shouldFlip(state, driver === 'bonus');
      if (ticks % 12 === 0 && state.elapsed - lastFlip >= 0.18 && wantsFlip) { state = flip(state); lastFlip = state.elapsed; }
      state.shield = 0;
      state = stepRun(state, FIXED_STEP);
      if (state.y > TOP_RAIL + ROBOT_RADIUS + 2 && state.y < BOTTOM_RAIL - ROBOT_RADIUS - 2) airborne++;
    }
    runs.push({ seed, seconds: +state.elapsed.toFixed(2), survived: state.phase === 'playing', score: score(state), energy: state.coins,
      gates: state.dodged, perfects: state.perfects, bonusRoutes: state.riskyPasses, polarityGates: state.polarityPasses,
      tapsPerSecond: +(state.flips / state.elapsed).toFixed(2), airborneShare: +(airborne / ticks).toFixed(3), shieldHits: state.shieldHits, crashReason: state.crashReason });
  }
  const mean = (field: 'seconds' | 'score' | 'energy' | 'tapsPerSecond' | 'airborneShare') => +(runs.reduce((sum, run) => sum + run[field], 0) / runs.length).toFixed(2);
  return { driver, survivedTwoMinutes: runs.filter(run => run.survived).length, averageSeconds: mean('seconds'), averageScore: mean('score'), averageEnergy: mean('energy'), averageTapsPerSecond: mean('tapsPerSecond'), averageAirborneShare: mean('airborneShare'), runs };
}
const main = benchmark('main'), bonus = benchmark('bonus'), middle = benchmark('middle');
const report = { version: 5, seeds: 30, decisionIntervalMs: 100, minimumTapIntervalMs: 180, shieldsDisabled: true,
  limitations: 'Automated visible-route controllers establish reachability only. No human retention, device performance population, or revenue is measured.',
  oldMiddleAverageSeconds: 42.34, middle, main, bonus,
  bonusScoreLiftPercent: +((bonus.averageScore / main.averageScore - 1) * 100).toFixed(1) };
writeFileSync(new URL('../docs/PLAYTEST_V5.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, middle: { ...middle, runs: undefined }, main: { ...main, runs: undefined }, bonus: { ...bonus, runs: undefined } }, null, 2));
