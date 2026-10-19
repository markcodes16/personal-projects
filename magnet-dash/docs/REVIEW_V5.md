# Magnet Dash V5: second design review

Historical assessment of V5. **V5.1 update:** the user shelved direction-required polarity gates after rejecting their visual treatments. Ordinary drift passages replace them, their prompts are gone, and the third mission now tracks bonus routes. Recommendations below about introducing or teaching those gates are superseded. The current build passes 33 unit tests and desktop/mobile browser checks; all 30 main-route and 30 bonus-route two-minute simulations survive without shields, with a 15.3% bonus score lift. See the [current handoff](PROJECT_HANDOFF.md) and [V5.1 diagnostic](PLAYTEST_V5_1.json).

The game now asks for route changes, precise movement and a choice about risk. It has a clearer magnetic identity and a visible reason for collected energy to matter between runs. The original center-hovering weakness is substantially reduced. Whether people enjoy these decisions and choose to return still needs human playtesting.

## Changes against the first report

| Prior gap | V5 behavior |
| --- | --- |
| Hovering could ignore the course | Six authored four-gate sequences: climb, dive, weave, squeeze, polarity and recovery. The opening climb forces a height change. |
| Gravity had little identity beyond flight control | Arrow-marked polarity gates require UP or DOWN pull at the glowing crossing line. Momentum is preserved. Wrong-pull crashes explain the required direction. |
| Pickups offered few choices | Two split passages per six-sequence cycle have a wide main opening and a tighter upper bonus opening. Gold pickups are worth extra points, and a completed bonus passage grants 150 × multiplier. Skipping optional energy leaves the chain intact. |
| Runs lacked pacing | Climbs, descents, precision sections and wider recovery passages alternate. Three sector palettes change with distance. |
| Distance records competed with score rewards | Score is the primary HUD, personal record, milestone and result. Distance remains a secondary statistic. A controlled crossing within 18 units of the opening center, below 220 vertical units/s, earns 60 × multiplier after clearing the gate. |
| Phone controls were clipped and the robot compressed | Starting opens a dedicated play view with sound, help, pause and exit controls. Portrait and landscape controls fit the viewport. Robot and pickup artwork retain their proportions; world lookahead is preserved. |
| Little persistent progress | Lifetime energy unlocks four selectable finishes at 0/60/180/400 energy. Three repeating mission tracks cover energy, perfect passes and polarity gates. Completion/unlock messages appear after a run. Saved progress and rescue checkpoints are deduplicated. |

## What the new checks establish

The final implementation passed **33 unit tests** and the expanded Chromium browser workflow. Browser checks include desktop, emulated phone portrait/landscape, controls, pause, rescue, storage-disabled play, old-save migration, finish unlock/equip persistence, and offline standalone play. Generated squeeze, polarity and bonus encounters were rendered at both 900px and 390px widths and visually inspected. Screenshots also cover the dedicated phone play view, result screen and career panel.

The second simulation review used seeds 1–30, 100ms decision intervals, at least 180ms between taps, ordinary gravity flips and no shield reliance. The middle-only controller repeats the strategy used in the previous review. The main and bonus controllers read upcoming visible-route cues; they do not control position or velocity directly.

| Strategy | V4 mean survival | V5 mean survival | V5 two-minute survivors | V5 mean score |
| --- | ---: | ---: | ---: | ---: |
| Stay near the middle, ignore the course | 42.34s | 4.45s | 0/30 | 395 |
| Follow the main passage | — | 120s | 30/30 | 34,825 |
| Choose the bonus passages | — | 120s | 30/30 | 39,889 |

The bonus strategy produced **14.5% more score**, with slightly less collected energy on average (394.5 versus 403.3). It therefore offers a score incentive while the main passage remains useful for steady career progress. Both guided controllers stayed airborne throughout the measured runs and averaged about 2.8 taps/second.

These are reachability and scoring checks. Controllers following known design cues do not measure human difficulty, enjoyment, retention or commercial performance. The previous 42.34s figure is the V4 diagnostic recorded in the first review, rather than a fresh V4 run. Raw V5 runs are in [PLAYTEST_V5.json](PLAYTEST_V5.json). Reproduce the diagnostic with `node --experimental-strip-types scripts/review.ts` from `magnet-dash/`.

## What is still missing or uncertain

1. **First-session teaching needs real observation.** The first climb now defeats inattentive hovering quickly. That solves the old weakness, but the controller result must not become a target for beginner survival. Watch unfamiliar players learn the drift-and-brake behavior; soften or demonstrate that first climb if they do not understand their deaths.
2. **The signature mechanic appears relatively late.** Polarity gates arrive after the opening climb, dive, weave and squeeze. New players who repeatedly die early may miss the strongest distinctive feature. A safe early polarity demonstration is the next candidate if this happens in playtests.
3. **Long-session variety remains limited.** Six sequences repeat with seeded geometry variation and rising difficulty. Their order is fixed, and daily layouts differ modestly. More authored combinations would help once players master the current set; merely making openings smaller will not solve repetition.
4. **Progression is a first pass.** Three recurring counters and four finishes provide goals, but the finish catalog is finite and missions repeat the same task types. Actual unlock pacing depends on novice run lengths, which are not measured yet. Energy is stored locally rather than tied to an account.
5. **Visual feedback needs a human readability check.** Pickup, flow and passage callouts can overlap during a busy bonus crossing. Wide phone artwork uses forgiving collision geometry; inspect whether grazing contacts look understandable on physical devices. The phone layout is verified in Chromium emulation; iOS Safari, slower hardware and longer sessions remain unverified.
6. **There is still no evidence of return behavior or income.** Local records and exports do not establish population retention. No live ads or global competitive system are present. Earlier local high scores remain saved across rule changes, so they are not a fair version-to-version comparison.

The next product milestone should be an observed first-session test with unfamiliar players: whether they can explain gravity and inertia, identify why they died, use the optional route deliberately, and choose another run without prompting. That evidence should guide the next difficulty and tutorial adjustment.
