import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adDecision, DEFAULT_INPUTS, estimateRevenue, opportunitiesPerSession, POLICIES } from '../src/ads.ts';
import type { AdContext } from '../src/ads.ts';

const eligible: AdContext = { screen: 'round-end', sessionNumber: 2, completedRounds: 10, sessionSeconds: 1000,
  secondsSinceAd: 1000, shownThisSession: 0, consentReady: true, adFree: false, rewardJustGranted: false };

test('every policy protects active play, first sessions, consent, purchases, and reward recovery', () => {
  for (const policy of POLICIES) {
    assert.equal(adDecision(eligible, policy).allowed, true);
    for (const patch of [{ screen: 'playing' }, { sessionNumber: 1 }, { consentReady: false }, { adFree: true }, { rewardJustGranted: true }]) {
      assert.equal(adDecision({ ...eligible, ...patch } as AdContext, policy).allowed, false);
    }
  }
});

test('cooldown, elapsed-time minimum and caps apply at their boundaries', () => {
  for (const policy of POLICIES) {
    assert.equal(adDecision({ ...eligible, secondsSinceAd: policy.cooldownSeconds - 1 }, policy).allowed, false);
    assert.equal(adDecision({ ...eligible, sessionSeconds: policy.minimumSeconds - 1 }, policy).allowed, false);
    assert.equal(adDecision({ ...eligible, shownThisSession: policy.maxPerSession }, policy).allowed, false);
    assert.equal(adDecision({ ...eligible, completedRounds: policy.minimumRounds - 1 }, policy).allowed, false);
    assert.equal(adDecision({ ...eligible, secondsSinceAd: policy.cooldownSeconds, sessionSeconds: policy.minimumSeconds, completedRounds: policy.minimumRounds }, policy).allowed, true);
  }
});

test('short rounds cannot bypass elapsed-time rules and long sessions hit caps', () => {
  assert.equal(opportunitiesPerSession(POLICIES[0], 4, 20), 0);
  assert.equal(opportunitiesPerSession(POLICIES[0], 99, 300), 2);
  assert.equal(opportunitiesPerSession(POLICIES[1], 99, 300), 3);
});

test('model handles zero traffic, no fill and traffic loss without inventing revenue', () => {
  for (const policy of POLICIES) {
    assert.equal(estimateRevenue({ ...DEFAULT_INPUTS, dailyPlayers: 0 }, policy).daily, 0);
    assert.equal(estimateRevenue({ ...DEFAULT_INPUTS, fillRate: 0 }, policy).daily, 0);
    assert.equal(estimateRevenue({ ...DEFAULT_INPUTS, trafficLoss: 1 }, policy).daily, 0);
    assert.equal(estimateRevenue({ ...DEFAULT_INPUTS, rewardedOptIn: 1 }, policy).interstitialImpressions, 0);
    const revenue = estimateRevenue(DEFAULT_INPUTS, policy);
    const half = estimateRevenue({ ...DEFAULT_INPUTS, dailyPlayers: DEFAULT_INPUTS.dailyPlayers / 2 }, policy);
    assert.equal(half.daily, revenue.daily / 2);
    assert.equal(revenue.margin, revenue.monthly - DEFAULT_INPUTS.monthlyCosts);
  }
});
