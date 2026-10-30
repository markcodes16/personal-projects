# Magnet Dash

An original prototype for a one-tap arcade runner. A small magnetic robot floats through an industrial tunnel; tap to reverse gravity and steer through midair openings with momentum. Chain energy for score multipliers, skim obstacles for close-call bonuses, and collect cyan capsules for a one-hit shield. Beat your distance, or practice a repeatable daily circuit.

Working title and concept: commercial naming and competitor research are still needed. No proprietary code, artwork or ad algorithms from other games are used.

## Play it or inspect the engineering

- **[Open the playable V5.1 browser preview](https://raw.githack.com/markcodes16/personal-projects/a2ab8c208cb8298194e9856f3d6b187e5d95e55e/magnet-dash/demo/index.html)** — no installation or account required (commit-pinned prototype).
- Core game engine: [src/game.ts](src/game.ts). Rendering: [src/render.ts](src/render.ts). Persistence: [src/storage.ts](src/storage.ts).
- Automated verification: `npm ci && npm test && npm run build && npm run test:browser`.
- This is not a public mobile-app release; advertising, live retention measurements, and app-store packaging are not implemented.

Continuing in a new conversation? Read the [project handoff](docs/PROJECT_HANDOFF.md) for the user's goals, current build, verified checks and next priorities.

## Try it without installing tools

### Browser preview without Pages activation

The self-contained game file is published in this public repository. An account-free rendering URL is available through raw.githack.com:

https://raw.githack.com/markcodes16/personal-projects/a2ab8c208cb8298194e9856f3d6b187e5d95e55e/magnet-dash/demo/index.html

The V5.1 public preview returned HTTP 200 with an HTML content type and matched the tested standalone HTML byte-for-byte (SHA-256 `d7a72b183cfc920b8d38765a98486ce87e6e2212270d5121648e9cfb80efa5af`). The user confirmed an earlier preview plays successfully. Local desktop and mobile browser tests exercise the current version. Additional automated live-browser checks were blocked by the cloud Chromium profile's missing trust for the network proxy certificate; certificate verification was kept enabled. Node HTTPS checks use the supplied proxy and certificate configuration with `NODE_USE_ENV_PROXY=1`.

This is a public prototype preview, not production hosting. The preview URL is pinned to the verified V5.1 commit; main-branch URLs may temporarily serve an older CDN cache even with a new query string. `npm run refresh:demo` rebuilds `demo/index.html`; commit and push that file to publish a newer version, then verify its commit-specific rendering URL against the local artifact before sharing it. Request that URL only after the push finishes; early requests can cache a 404.

This environment-onboarding chat has no user-facing web-preview service. Workspace file links and a running cloud server do not produce a public website. Publishing the development environment saves its setup; it does not deploy the game.

The prepared cloud workspace contains `release/magnet-dash.html`, a single self-contained game file. Download it and open it in a modern browser that permits local HTML files. It needs no package installation or external assets. The automated browser checks verify that the same HTML renders and plays offline after loading; direct `file://` opening is blocked by the cloud machine's managed Chromium policy and could not be verified here.

For permanent hosting under your control, deploy `dist/` to a static HTTPS host. The browser preview above is available without GitHub Pages activation. An app-store release, native wrapper, signing, real analytics, and mobile ad-network integration are separate launch work.

For hosting under a subpath such as GitHub Pages, use the self-contained site from `npm run package:preview`. It produces `release/site/index.html` and `release/magnet-dash-preview.zip`, with no absolute asset-path dependency. The ZIP contains only the game HTML and `.nojekyll`; it contains no source tree, credentials or event exports.

The repository includes a **manual-only** GitHub Pages workflow at `.github/workflows/magnet-dash-pages.yml`. Creating or pushing the workflow does not publish a site. After approval of a public demo, save the game and workflow to GitHub. In the GitHub repository, enable **Settings → Pages → Source: GitHub Actions**, then run **Actions → Publish Magnet Dash demo → Run workflow**. Obtain the real website URL from the successful deployment; do not infer that a URL is live from the repository name. Account/plan eligibility for Pages has not been verified, and GitHub API access depends on the cloud environment's network settings. The workflow follows the official deploy-pages example and pins the verified action tag SHAs.

## Develop in the cloud

Requirements: Node.js >=22.13 and npm. The prepared environment uses Node 24.19.0.

```bash
cd /workspace/personal-projects/magnet-dash
npm ci --cache /workspace/.setup-cache/npm
npm run dev -- --port 4173 --strictPort
```

The dev server is long-lived. This is a separate Vite/React/TypeScript app; it does not change the Deadlock or Godot projects.

```bash
npm test                 # Engine, ad policy, and saved-run accounting tests
npm run build            # TypeScript + production web build
npm run build:standalone # Web build + release/magnet-dash.html
npm run package:preview  # Build + static site folder + verified upload ZIP (Python 3 required)
npm run refresh:demo     # Refresh the public demo/index.html from the standalone build
npm run test:browser     # Build + desktop, mobile, controls, storage, and offline-bundle checks
```

Browser checks use Playwright with `/usr/bin/chromium` when available. Else set `CHROMIUM_PATH` or install Playwright's Chromium in the cloud. They start a temporary local server on port 4175, close it afterward, and save screenshots under ignored `test-results/`. The game itself has no Playwright dependency at runtime.

## V5.1 design update

Slower gravity and inertia remain. Six authored sequences (climb, dive, weave, squeeze, drift, recovery), optional upper bonus passages, perfect-pass bonuses, and three changing sector palettes shape the course. Score is the main record and milestone. Optional pickups never break a multiplier when missed.

At the user's request, V5.1 shelves the direction-required polarity gates after two visual treatments proved unsatisfactory. Their section now contains ordinary open passages; crossing an opening never requires a particular pull. Their prompts and mission are removed, with a bonus-route mission taking that career slot. Gravity switching remains the movement mechanic. The shelved implementations remain in Git history and the `ux/clear-polarity-gate-cues` branch for possible future work; do not reintroduce them without a new request.

Starting a run opens a dedicated play view, with all phone controls visible in portrait and landscape. Character and pickup artwork preserve their proportions. Lifetime energy unlocks four robot finishes, and three repeating mission tracks save progress between runs. The garage is available from the result screen. Finishes affect appearance only; there are no purchases or live ads.

Validation: 33 unit tests and desktop/mobile Chromium checks passed, including openings accepting either pull, both passages, save migration and finish persistence. The V5.1 diagnostic covers 30 main-route and 30 bonus-route two-minute runs without shield reliance, with all guided runs surviving. The middle-only strategy lasts 4.45 seconds on average. The bonus strategy averages 15.3% more score. These checks establish reachability and scoring incentives, not human enjoyment or retention.

Read [the historical V5 second review](docs/REVIEW_V5.md) for the broader assessment and [current diagnostic results](docs/PLAYTEST_V5_1.json) for V5.1. Reproduce the diagnostic with `node --experimental-strip-types scripts/review.ts`. Existing records are preserved across balance changes.

## Controls and rules

- Tap/click the tunnel, press Space / Up / Down, or use the flip button to switch polarity.
- Press P / Escape or use the pause button. Hiding the tab, opening instructions, or visiting the creator lab pauses an active run. Resume explicitly.
- Pink paired barriers and amber squeeze gates end a run unless a shield is active. Fly through their clear openings. Stay in the air and reverse gravity before a turn: momentum continues briefly after each tap.
- Follow airborne energy trails up or down. Gold upper passages are optional and award extra points; skipping them does not reset flow. Consecutive energy pickups build a score multiplier up to ×5; missing an orb resets it. Close passes earn skill bonuses. Cyan shield capsules are separate pickups and absorb exactly one collision. Energy never grants a shield.
- One optional **demo** rescue returns the robot to midair, clears the immediate route and grants no shield. No ad plays. Rescuing updates the same saved run rather than counting it twice.
- Endless uses fresh seeds. Daily Circuit uses the browser's local calendar date, so the layout repeats that day. There is no global leaderboard or verified competitive scoring.

Best score, distance, mission counters, finish selection, sound preference and recent runs are saved locally in this browser. Sound starts muted. With browser storage disabled, play still works but persistent records are unavailable. Reduced-motion preferences suppress decorative movement; the core moving game remains visual.

## Monetization prototype

Open **Creator lab** in the footer. It includes two hypothetical interstitial policies, editable revenue assumptions, a placement sandbox, and an export of local play events. It does **not** serve live ads, make purchases, measure global retention, or earn money. Revenue values are illustrative assumptions, not market data or a forecast.

Player-facing ad decisions cannot alter obstacle generation, physics, or difficulty. The policies protect active play, first sessions, reward recovery and ad-free users, and apply cooldowns and session caps. Real ad consent and platform policy compliance must be implemented before any live SDK integration.

See [the experiment plan](docs/MONETIZATION.md) for benchmarking, profitability metrics, and launch gates.

## Structure

- `src/game.ts`: seeded generation, fixed physics substeps, collisions, score chains, physical shield pickups and rescue.
- `src/render.ts`: original vector tunnel and robot art; no external art assets.
- `src/GamePanel.tsx`: animation loop, input, pause, audio triggers, and run events.
- `src/storage.ts`: local personal bests and run accounting.
- `src/ads.ts`: standalone ad-policy rules and the assumption-based revenue model.
- `src/MonetizationLab.tsx`: creator-only policy and economics sandbox.
- `src/analytics.ts`: bounded local event storage and JSON export; no data is uploaded.
- `scripts/standalone.mjs`: builds the downloadable single-file version.
