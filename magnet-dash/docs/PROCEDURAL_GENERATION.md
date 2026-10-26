# Procedural obstacle generation (candidate)

The current V5.1 game repeats six fixed four-gate sequences. The proposed generator shuffles those sequences in seeded six-pattern bags, varies approach heights and spacing. The first four gates remain the familiar introductory climb.

## Rules

- **Endless:** a new random seed yields a different authored-pattern order and terrain.
- **Daily Circuit:** the existing calendar seed reproduces the exact same generated course.
- **Fairness:** consecutive main openings shift by at most 110 world units, generally less after the introduction; the original speed/opening difficulty curve and minimum gate spacing remain. The tunnel's physical limits include clearance for the robot.
- **Diversity:** climb, dive, weave, squeeze, drift and recovery each occur once per six-sequence bag, with no consecutive duplicate at bag boundaries. Sequence mirroring is deferred until pilot validation shows the randomized order is fair.
- **Optional reward routes:** dive/recovery can include a narrow upper passage with a wide safe main passage and a separating wall. The bonus route remains voluntary.
- **Obsolete mechanic:** no gate forces a selected gravity direction. The prior direction-locked polarity gate was removed in V5.1 and must not be reintroduced without new user direction.
- **Protection:** shield capsules remain physical pickups, not free grants; new runs do not alter old local progression records.

## Validation before merge

Run `npm test`, `npm run build`, `npm run test:browser` and `node --experimental-strip-types scripts/review.ts`. The last command writes the V5.1 diagnostic file, so review differences and do not mistake automated pilot success for evidence of player enjoyment. Record path diversity, survival without shields, main-vs-bonus incentives, center-hovering exploit risk, and novice first-minute usability. Test on an actual phone before publishing a public gameplay preview.

Keep this candidate separate from the pinned V5.1 demo until source, browser and human verification complete.
