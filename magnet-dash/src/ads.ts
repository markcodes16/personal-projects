export type AdPolicy = {
  id: 'light' | 'balanced';
  name: string;
  minimumSession: number;
  minimumRounds: number;
  minimumSeconds: number;
  cooldownSeconds: number;
  maxPerSession: number;
};

export const POLICIES: AdPolicy[] = [
  { id: 'light', name: 'Light touch', minimumSession: 2, minimumRounds: 3, minimumSeconds: 180, cooldownSeconds: 180, maxPerSession: 2 },
  { id: 'balanced', name: 'Balanced', minimumSession: 2, minimumRounds: 2, minimumSeconds: 120, cooldownSeconds: 120, maxPerSession: 3 },
];

export type AdContext = {
  screen: 'playing' | 'round-end';
  sessionNumber: number;
  completedRounds: number;
  sessionSeconds: number;
  secondsSinceAd: number;
  shownThisSession: number;
  consentReady: boolean;
  adFree: boolean;
  rewardJustGranted: boolean;
};

export function adDecision(context: AdContext, policy: AdPolicy): { allowed: boolean; reason: string } {
  if (context.screen !== 'round-end') return { allowed: false, reason: 'Protect active play' };
  if (!context.consentReady) return { allowed: false, reason: 'Consent flow is not ready' };
  if (context.adFree) return { allowed: false, reason: 'Ad-free player' };
  if (context.rewardJustGranted) return { allowed: false, reason: 'No forced ad after a reward' };
  if (context.sessionNumber < policy.minimumSession) return { allowed: false, reason: 'Keep the first session ad-free' };
  if (context.completedRounds < policy.minimumRounds) return { allowed: false, reason: 'Let the player find their flow' };
  if (context.sessionSeconds < policy.minimumSeconds) return { allowed: false, reason: 'Minimum play time has not elapsed' };
  if (context.shownThisSession >= policy.maxPerSession) return { allowed: false, reason: 'Session cap reached' };
  if (context.secondsSinceAd < policy.cooldownSeconds) return { allowed: false, reason: 'Cooldown is active' };
  return { allowed: true, reason: 'Eligible at a natural round break' };
}

export type RevenueInputs = {
  dailyPlayers: number;
  sessionsPerPlayer: number;
  roundsPerSession: number;
  secondsPerRound: number;
  returningShare: number;
  rewardedOptIn: number;
  fillRate: number;
  interstitialEcpm: number;
  rewardedEcpm: number;
  trafficLoss: number;
  monthlyCosts: number;
};

export const DEFAULT_INPUTS: RevenueInputs = {
  dailyPlayers: 1000, sessionsPerPlayer: 2, roundsPerSession: 4, secondsPerRound: 80,
  returningShare: 0.6, rewardedOptIn: 0.15, fillRate: 0.85,
  interstitialEcpm: 6, rewardedEcpm: 12, trafficLoss: 0.05, monthlyCosts: 100,
};

export function opportunitiesPerSession(policy: AdPolicy, rounds: number, secondsPerRound: number): number {
  let count = 0;
  let lastAdAt = -Infinity;
  for (let round = 1; round <= Math.min(100, Math.floor(rounds)); round++) {
    const time = round * secondsPerRound;
    const decision = adDecision({ screen: 'round-end', sessionNumber: 2, completedRounds: round,
      sessionSeconds: time, secondsSinceAd: time - lastAdAt, shownThisSession: count,
      consentReady: true, adFree: false, rewardJustGranted: false }, policy);
    if (decision.allowed) { count++; lastAdAt = time; }
  }
  return count;
}

export function estimateRevenue(inputs: RevenueInputs, policy: AdPolicy) {
  const finite = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
  const fraction = (n: number) => Math.min(1, finite(n));
  const sessions = finite(inputs.dailyPlayers) * finite(inputs.sessionsPerPlayer) * (1 - fraction(inputs.trafficLoss));
  const opportunities = opportunitiesPerSession(policy, inputs.roundsPerSession, finite(inputs.secondsPerRound));
  // These are mutually exclusive round-end outcomes: accepting a reward suppresses the forced placement.
  const interstitialImpressions = sessions * fraction(inputs.returningShare) * opportunities * (1 - fraction(inputs.rewardedOptIn)) * fraction(inputs.fillRate);
  const rewardedImpressions = sessions * Math.min(100, finite(inputs.roundsPerSession)) * fraction(inputs.rewardedOptIn) * fraction(inputs.fillRate);
  const daily = (interstitialImpressions * finite(inputs.interstitialEcpm) + rewardedImpressions * finite(inputs.rewardedEcpm)) / 1000;
  return { daily, monthly: daily * 30, margin: daily * 30 - finite(inputs.monthlyCosts), interstitialImpressions, rewardedImpressions, opportunities };
}
