# Magnet Dash

An original prototype for a one-tap arcade runner. A small magnetic robot runs through an industrial tunnel; tap to reverse its pull between the floor and ceiling. Collect five energy orbs for a four-second shield. Beat your distance, or practice a repeatable daily circuit.

Working title and concept: commercial naming and competitor research are still needed. No proprietary code, artwork or ad algorithms from other games are used.

## Try it without installing tools

### Browser preview without Pages activation

The self-contained game file is published in this public repository. An account-free rendering URL is available through raw.githack.com:

https://raw.githack.com/markcodes16/personal-projects/6daf438bb64fbd466209363a7518ebd00202bb87/magnet-dash/demo/index.html

The live HTTPS preview returns HTTP 200 with an HTML content type and matches the tested standalone build byte-for-byte. The user confirmed that it plays successfully. Local desktop and mobile browser tests passed. Additional automated live-browser checks were blocked by the cloud Chromium profile's missing trust for the network proxy certificate; certificate verification was kept enabled. Node HTTPS checks use the supplied proxy and certificate configuration with `NODE_USE_ENV_PROXY=1`.

This is a public prototype preview, not production hosting. The URL pins the published version. `npm run refresh:demo` rebuilds `demo/index.html`; commit and push that file to publish a newer version, then use its commit SHA in the preview URL.

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

## Controls and rules

- Tap/click the tunnel, press Space / Up / Down, or use the flip button to switch polarity.
- Press P / Escape or use the pause button. Hiding the tab, opening instructions, or visiting the creator lab pauses an active run. Resume explicitly.
- Pink obstacles end a run unless the shield is active. Flip early enough to cross the tunnel. Floating cargo appears later to vary the route.
- Each energy orb adds ten points. Five orbs automatically activate a four-second shield; distance continues to increase normally.
- One optional **demo** rescue clears nearby obstacles and grants 2.5 seconds of protection. No ad plays. Rescuing updates the same saved run rather than counting it twice.
- Endless uses fresh seeds. Daily Circuit uses the browser's local calendar date, so the layout repeats that day. There is no global leaderboard or verified competitive scoring.

Best distance, best score, sound preference, recent runs, and aggregate counts are saved locally in this browser. Sound starts muted. With browser storage disabled, play still works but persistent records are unavailable. Reduced-motion preferences suppress decorative movement; the core moving game remains visual.

## Monetization prototype

Open **Creator lab** in the footer. It includes two hypothetical interstitial policies, editable revenue assumptions, a placement sandbox, and an export of local play events. It does **not** serve live ads, make purchases, measure global retention, or earn money. Revenue values are illustrative assumptions, not market data or a forecast.

Player-facing ad decisions cannot alter obstacle generation, physics, or difficulty. The policies protect active play, first sessions, reward recovery and ad-free users, and apply cooldowns and session caps. Real ad consent and platform policy compliance must be implemented before any live SDK integration.

See [the experiment plan](docs/MONETIZATION.md) for benchmarking, profitability metrics, and launch gates.

## Structure

- `src/game.ts`: seeded generation, fixed physics substeps, collisions, charge and rescue.
- `src/render.ts`: original vector tunnel and robot art; no external art assets.
- `src/GamePanel.tsx`: animation loop, input, pause, audio triggers, and run events.
- `src/storage.ts`: local personal bests and run accounting.
- `src/ads.ts`: standalone ad-policy rules and the assumption-based revenue model.
- `src/MonetizationLab.tsx`: creator-only policy and economics sandbox.
- `src/analytics.ts`: bounded local event storage and JSON export; no data is uploaded.
- `scripts/standalone.mjs`: builds the downloadable single-file version.
