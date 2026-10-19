# Magnet Dash: learn the game before scaling the ads

## What this prototype establishes

The prototype makes the game playable and ad placement rules inspectable. There is no live ad network, backend experiment assignment, verified audience, global retention measurement, paid acquisition, or demonstrated income. Default revenue inputs are example assumptions, not measured eCPMs, fill rates, or competitor performance.

The initial commercial hypothesis is that short runs, a clear one-tap control, visible skill improvement, and a likeable robot can produce repeat play. That needs real playtesting. A name/trademark and comparable-game search is also outstanding; the broad gravity-switching mechanic is not claimed to be unprecedented.

## Benchmark public behavior

For games such as Block Blast and Subway Surfers, record only observable behavior from ordinary play. Their private selection, auction, mediation and targeting algorithms cannot be inferred exactly from a few sessions. No proprietary algorithm has been reverse engineered here.

Use an observation sheet with app/version, date, region, device/OS, consent state, first vs returning session, elapsed active time, round/death count, placement type, whether the ad was requested, whether a retry remained available without watching, and time since the previous ad. Observe multiple sessions; do not mistake an unfilled ad request or a regional experiment for a universal rule. Do not bypass access controls or intercept other users' data.

Compare these observable policies with the two testable Magnet Dash candidates:

| Policy | First eligible session | Minimum completed rounds | Earliest elapsed time | Cooldown | Session cap |
| --- | --- | --- | --- | --- | --- |
| Light touch | 2 | 3 | 180 seconds | 180 seconds | 2 |
| Balanced | 2 | 2 | 120 seconds | 120 seconds | 3 |

Both permit forced placements only at a round-end screen. Neither permits one during gameplay, in the first session, immediately after a reward, without a completed consent flow, or for an ad-free player. These are product choices to test, not claims about the competitors. The policies currently run only in the lab.

## First experiments

1. **Is the game understandable?** Start with 5–10 people and no ads. Observe whether they learn the control without explanation, survive the first obstacle, and voluntarily retry. Record specific confusion and frustration before tuning difficulty.
2. **Is there a reason to return?** Offer endless and repeatable daily circuits. Once a real consent-aware event service exists, measure return rates, attempts per session, run duration, and progression. Local browser exports help inspect event shape but cannot establish population retention.
3. **Does a reward improve the experience?** Compare no rescue with one clearly optional rescue. The normal retry stays prominent. In this prototype the rescue is free and explicitly marked as a demo; its acceptance is not evidence of willingness to watch a real ad.
4. **Do ads create incremental value?** Only after integrating an approved SDK, compare an ad-free holdout, light-touch policy, and balanced policy. Randomize a persistent player cohort before exposure. Keep gameplay generation identical between cohorts. Choose sample size and duration from actual variance and a prespecified detectable effect; a handful of installs is not enough to declare a winner.

Predefine the primary metric as net contribution per acquired player over a fixed observation window (for example 30 days). Also monitor D1/D7 return rates, playtime, crash-free sessions, complaints, ad latency, and reward completion. Set acceptable retention/crash limits before inspecting outcomes. Report uncertainty, not just the best-looking point estimate.

## Revenue and profit

The lab approximates daily filled interstitial impressions from active players × sessions × returning-session share × eligible round-end slots × (1 − reward opt-in) × fill rate. Rewarded impressions use active players × sessions × rounds × opt-in × fill rate. Both are scaled by the entered hypothetical traffic loss. Rewards suppress a forced placement at that round break. This is a simplified approximation; it does not replay cohort-level reward/cooldown interactions or predict retention.

For each placement: gross ad revenue = filled impressions × realized eCPM / 1,000. The monthly display is simply 30 × modeled daily revenue. The traffic-loss slider applies a hypothetical steady traffic reduction; it is not D1 retention or a lifetime-value estimate. Costs are entirely user-entered, and the displayed difference excludes anything not entered, including acquisition, tax, contractors, platform and operational costs.

Use measured cohort revenue and actual costs to decide whether to scale. Positive daily ad revenue alone does not establish profit. Player acquisition cost must be supported by lifetime contribution and available cash. No earnings target is promised.

## Event semantics and implementation

Events stay in browser storage under `pocket-arcade.events.v1`, capped at 5,000 entries. Export contains a browser-session ID, a run ID, timestamps and gameplay values. No third-party collection occurs. Session means this browser tab's `sessionStorage` lifetime, not a validated industry-standard inactivity session.

- `round_started`: one new seeded run.
- `run_crashed` and `round_ended`: a game-over checkpoint. A rescued run may emit a second checkpoint with the same run ID; unique-run metrics must deduplicate that ID and use its latest values. These are not two new runs.
- `reward_offered`, `reward_requested`, `reward_granted`: explicitly demo-only rescue events. They are not ad impressions, ad completions or revenue.

Native ad integration must grant a reward only on the SDK's verified earned-reward callback, handle load failures without blocking ordinary retry, and persist caps and policy assignment appropriately. Use official test ad units during development. Consent, age/audience decisions, privacy disclosures, store rules and network policies must be reviewed against current official documentation for the chosen release markets. Nothing in the prototype supplies production consent.

Reference entry points for future integration:

- https://developers.google.com/admob/android/interstitial
- https://developers.google.com/admob/android/rewarded
- https://developers.google.com/admob/android/privacy

Those documentation hosts were inaccessible under the onboarding machine's network policy, so their current content was not verified in this task. The game and local lab do not require access to them.

## Still required before launch

A validated game loop, broader device testing (especially iOS Safari), hosted HTTPS distribution, server-side analytics and cohort assignment, native packaging if targeting mobile stores, signing/store accounts, accessible privacy and consent flows, actual ad SDK integration, live-policy review, and tests with real players. Any public deployment, paid acquisition, accounts or spending require a separate explicit launch instruction.
