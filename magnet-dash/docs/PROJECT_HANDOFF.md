# Magnet Dash project handoff

Start here when continuing this game in a new conversation. The GitHub repository contains the source and project documents; the earlier Codex conversation itself is not included.

## Repository and current build

- Repository: https://github.com/markcodes16/personal-projects
- Branch: `main`
- Project directory: `magnet-dash/`
- Current playable version: V5.1
- Browser game: https://raw.githack.com/markcodes16/personal-projects/a2ab8c208cb8298194e9856f3d6b187e5d95e55e/magnet-dash/demo/index.html
- Setup, commands and publishing: [README](../README.md)
- Broader assessment and remaining gaps: [historical V5 design review](REVIEW_V5.md), with the V5.1 change noted at its start
- Current diagnostic results: [V5.1 simulated runs](PLAYTEST_V5_1.json)
- Revenue hypotheses and measurement plan: [Monetization plan](MONETIZATION.md)

The browser link is pinned to the tested V5.1 game commit. Later documentation-only commits do not change that build. Verify a new build's public HTML before sharing a replacement link.

## User goals and preferences

The goal is an original, simple mobile arcade game with potential side income. The user develops remotely and cannot install development tools on their work computer, so maintain an accessible browser preview. Enjoyable movement and voluntary replay need to be established before assessing ad profitability.

The user asked for active play from the start, progressively harder obstacles, airborne rewards, collectible shields, less repetitive maximum-streak audio, and squeeze passages. The latest movement request was slower falling, inertia, and more time in the air, taking inspiration from Flappy Bird while preserving gravity switching as the input mechanic.

Keep the one-tap control and momentum. Switching gravity changes acceleration without instantly replacing vertical velocity. Shields are physical pickups, never automatically awarded for a combo. Avoid returning to long periods of riding the ceiling or floor, or a course that can be ignored by hovering in the middle. Preserve the softer, varied sustained-multiplier sounds.

The latest user decision is to remove direction-required polarity gates for now after rejecting both visual treatments. V5.1 replaces that section with ordinary flight openings and removes their prompts and mission. Do not reintroduce this obstacle unless the user asks to revisit it. Gravity switching itself remains. The shelved work is preserved in Git history and the `ux/clear-polarity-gate-cues` branch; its PR is superseded by this removal.

## What V5.1 implements

- A React/TypeScript/Vite game with original Canvas robot and tunnel artwork.
- Slower gravity, air drag, capped vertical speed, and inertia through switches.
- Six repeating authored sequences: climb, dive, weave, squeeze, drift, recovery. Openings accept either gravity direction.
- A wide main passage and optional tighter upper passage at selected split gates. Skipping optional energy does not break the score chain.
- Score as the main record, energy multipliers, controlled perfect-pass bonuses, and bonus-route rewards.
- Three sector palettes, a dedicated play view, reachable phone controls, and undistorted character/pickup artwork.
- Three recurring career mission tracks (energy, perfect passes, bonus routes) and four cosmetic finishes. Lifetime energy, finishes, scores and career counters persist in browser storage. Legacy polarity counters remain stored for compatibility but are not displayed or updated by new runs.
- Endless and a seeded daily circuit, pause, optional demo rescue, and a creator lab with hypothetical revenue inputs. No live ads are served.

## Verified state at handoff

The V5.1 implementation passed 33 unit tests, the TypeScript/production build, and the expanded desktop/mobile Chromium browser workflow. Checks cover both gravity directions through an open passage, no direction-required generated obstacles, ordinary drift sections, squeeze/bonus passages and the replacement mission. The public game returned HTTP 200 and matched the tested standalone HTML byte-for-byte. These are previously completed checks; rerun the relevant checks after making changes.

The V5.1 diagnostic tested 30 seeds per strategy. A middle-only hovering controller survived 4.45 seconds on average. Both main-route and bonus-route controllers survived every two-minute run without shield reliance; the bonus strategy averaged 15.3% more score. These are automated reachability and incentive measurements, not evidence of human enjoyment, retention or income.

## Recommended next work

Read the V5 review for the broader assessment, treating its polarity-gate recommendations as superseded. The next priority is observing unfamiliar players learning gravity, braking and the first climb. Assess whether deaths feel understandable and whether they voluntarily retry.

The six-sequence order repeats, daily layouts vary modestly, missions repeat three task types, and the cosmetic catalog is small. Reward callouts can overlap in busy passages. Physical iPhone/Safari behavior, slower hardware, player return rates and actual revenue remain unverified. Old local records were retained across rule changes.

## Development and publication

Use the existing checkout in the cloud; local installation on the user's computer is unnecessary. From `magnet-dash/`, follow the README for Node/npm setup and use:

```bash
npm test
npm run test:browser
node --experimental-strip-types scripts/review.ts
npm run refresh:demo
```

The diagnostic rewrites `docs/PLAYTEST_V5_1.json`; assess its results rather than treating a completed run as a pass. Historical V5 results remain in `docs/PLAYTEST_V5.json`. `npm run refresh:demo` builds the self-contained game into the tracked `demo/index.html`. Commit and push the intended source, tests, documents and demo to `main`. Request a commit-pinned preview URL only after the push completes, then compare its HTML with the local artifact. The README explains preview caching and HTTPS verification limitations.

Dependencies, temporary builds, local event exports and test screenshots are intentionally ignored. The other directories in this repository are separate projects; keep unrelated changes out of Magnet Dash commits.
