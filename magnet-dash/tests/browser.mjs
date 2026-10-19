import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'http://127.0.0.1:4175';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLogs = '';
server.stdout.on('data', chunk => { serverLogs += chunk; });
server.stderr.on('data', chunk => { serverLogs += chunk; });
const errors = [];
let browser;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
function watch(page) { page.on('pageerror', error => errors.push(error.message)); }

try {
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${serverLogs}`);
    if (serverLogs.includes('http://127.0.0.1:4175')) {
      try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* Startup is bounded below. */ }
    }
    await sleep(100);
  }
  assert.ok(ready, `Preview did not become ready: ${serverLogs}`);
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  watch(page);
  await page.goto(origin);
  await page.getByRole('button', { name: "Let's dash" }).waitFor();
  assert.equal(await page.title(), 'Magnet Dash — Flip the pull');
  assert.ok(await noOverflow(page));
  await page.screenshot({ path: `${root}/test-results/desktop.png`, fullPage: true });
  console.log('PASS desktop landing and canvas render');

  await page.getByRole('button', { name: 'Daily circuit', exact: true }).click();
  assert.match(await page.locator('.circuit-label').innerText(), /DAILY CIRCUIT/);
  await page.getByRole('button', { name: 'Endless', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: 'How to play' }).click();
  await page.getByRole('dialog', { name: "It's all in the little flips." }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  console.log('PASS daily mode and keyboard-accessible help');

  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await page.getByRole('button', { name: 'Mute sound', exact: true }).waitFor();
  await page.getByRole('button', { name: "Let's dash" }).click();
  await page.waitForTimeout(180);
  await page.keyboard.press('Space');
  await page.getByText('PULLING UP', { exact: true }).waitFor();
  await page.keyboard.press('p');
  await page.locator('.phase-paused').waitFor();
  const pausedDistance = await page.locator('.game-hud strong').first().textContent();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.game-hud strong').first().textContent(), pausedDistance);
  console.log('PASS keyboard polarity, pause, and frozen simulation');

  await page.getByRole('button', { name: 'Creator lab' }).click();
  await page.getByText('Keep the fun.').waitFor();
  await page.locator('h1').filter({ visible: true }).click();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('.phase-paused').count(), 1, 'Hidden game must remain paused');
  const revenueBefore = await page.locator('.revenue-number').textContent();
  await page.getByRole('slider').first().focus();
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.locator('.revenue-number').textContent(), revenueBefore);
  await page.getByLabel('Player is in the middle of a round').check();
  await page.getByText('Protect active play', { exact: true }).waitFor();
  await page.getByLabel('Player is in the middle of a round').uncheck();
  await page.getByLabel('This is their first session').check();
  await page.getByText('Keep the first session ad-free', { exact: true }).waitFor();
  await page.getByRole('slider').first().focus();
  await page.keyboard.press('Home');
  assert.match(await page.locator('.revenue-number').textContent(), /^\$0/);
  assert.ok(await noOverflow(page));
  await page.screenshot({ path: `${root}/test-results/creator-lab.png`, fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export events' }).click();
  const download = await downloadPromise;
  await download.saveAs(`${root}/test-results/events.json`);
  const exported = JSON.parse(await readFile(`${root}/test-results/events.json`, 'utf8'));
  assert.equal(exported.liveAds, false);
  assert.equal(exported.scope, 'this browser only');
  assert.ok(exported.events.some(event => event.name === 'round_started'));
  console.log('PASS interactive ad model, first-session protection, hidden-game pause, and event export');

  await page.goto(origin);
  await page.getByRole('button', { name: "Let's dash" }).click();
  await page.getByRole('dialog', { name: 'Run complete' }).waitFor({ timeout: 7000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('magnet-dash.player.v1')));
  assert.ok(stored.bestDistance >= 30);
  assert.equal(stored.totalRuns, 1);
  await page.getByRole('button', { name: 'Try a free rescue' }).click();
  await page.locator('.phase-playing').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Try a free rescue' }).count(), 0);
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade.events.v1')));
  assert.equal(events.filter(event => event.name === 'reward_granted').length, 1);
  assert.equal(events.find(event => event.name === 'reward_granted').data.liveAd, false);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.reload();
  assert.match(await page.locator('.personal-best').textContent(), new RegExp(`${stored.bestDistance}m`));
  console.log('PASS collision, optional demo rescue, saved best, and reload persistence');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  watch(mobile);
  await mobile.goto(origin);
  await mobile.getByRole('button', { name: "Let's dash" }).waitFor();
  assert.ok(await noOverflow(mobile));
  await mobile.screenshot({ path: `${root}/test-results/mobile.png`, fullPage: true });
  await mobile.getByRole('button', { name: "Let's dash" }).tap();
  await mobile.waitForTimeout(180);
  await mobile.locator('canvas').tap({ position: { x: 170, y: 210 } });
  await mobile.getByText('PULLING UP', { exact: true }).waitFor();
  await mobile.getByRole('button', { name: 'Pause game', exact: true }).tap();
  await mobile.locator('.phase-paused').waitFor();
  await mobile.setViewportSize({ width: 844, height: 390 });
  assert.ok(await noOverflow(mobile));
  console.log('PASS phone layout, touch polarity, pause, and landscape resize');

  const standalone = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(standalone);
  const network = [];
  const standaloneUrl = `${origin}/standalone-game`;
  // This managed Chromium blocks file:// navigation. Serve the exact HTML as one
  // response, forbid every subresource, then disconnect the context for interaction.
  await standalone.route('**/*', async route => {
    if (route.request().url() === standaloneUrl) await route.fulfill({ status: 200, contentType: 'text/html', body: await readFile(`${root}/release/magnet-dash.html`, 'utf8') });
    else { network.push(route.request().url()); await route.abort(); }
  });
  await standalone.goto(standaloneUrl);
  await standalone.context().setOffline(true);
  await standalone.getByRole('button', { name: "Let's dash" }).click();
  await standalone.waitForTimeout(180);
  await standalone.keyboard.press('Space');
  await standalone.getByText('PULLING UP', { exact: true }).waitFor();
  await standalone.getByRole('button', { name: 'Pause game', exact: true }).click();
  await standalone.getByRole('button', { name: 'Creator lab' }).click();
  await standalone.getByText('Keep the fun.').waitFor();
  assert.deepEqual(network, [], 'Standalone game must not request any external assets');
  console.log('PASS single-file bundle has no subresource requests and remains playable offline after loading');
  console.log('NOTE direct file:// opening is unverified: this managed Chromium blocks file navigation');
  const privatePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(privatePage);
  await privatePage.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
  });
  await privatePage.goto(origin);
  await privatePage.getByRole('button', { name: "Let's dash" }).click();
  await privatePage.waitForTimeout(180);
  await privatePage.keyboard.press('Space');
  await privatePage.getByText('PULLING UP', { exact: true }).waitFor();
  await privatePage.getByRole('button', { name: 'Pause game', exact: true }).click();
  await privatePage.getByRole('button', { name: 'Creator lab' }).click();
  await privatePage.getByText('Keep the fun.').waitFor();
  assert.match(await privatePage.locator('.metric-grid').innerText(), /1\s+Browser sessions/);
  console.log('PASS gameplay and in-memory metrics with persistent browser storage disabled');

  // Render an actual generated squeeze in Chromium at both viewport widths.
  // Test-only module routes keep fixture controls out of the shipped game.
  const scene = await browser.newPage({ viewport: { width: 900, height: 560 } });
  watch(scene);
  const engineModule = stripTypeScriptTypes(await readFile(`${root}/src/game.ts`, 'utf8'));
  const rendererModule = stripTypeScriptTypes(await readFile(`${root}/src/render.ts`, 'utf8')).replace("from './game'", "from './game.js'");
  const pilotModule = stripTypeScriptTypes(await readFile(`${root}/tests/pilot.ts`, 'utf8'));
  await scene.route('**/__scene/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('.js')) await route.fulfill({ contentType: 'text/javascript', body: path.endsWith('/game.js') ? engineModule : path.endsWith('/pilot.js') ? pilotModule : rendererModule });
    else await route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0;background:#111}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas>' });
  });
  await scene.goto(`${origin}/__scene/index.html`);
  for (const width of [900, 390]) {
    await scene.setViewportSize({ width, height: 560 });
    const result = await scene.evaluate(async () => {
      const game = await import('/__scene/game.js');
      const { drawScene } = await import('/__scene/render.js');
      const { shouldFlip } = await import('/__scene/pilot.js');
      let state = game.startRun(game.createRun(72));
      let inGate = false, lastFlipAt = -1;
      for (let tick = 0; tick < 120 * 12 && state.phase === 'playing'; tick++) {
        const next = state.obstacles.find(o => !o.passed && !o.broken);
        if (tick % 12 === 0 && state.elapsed - lastFlipAt >= 0.18 && shouldFlip(state)) { state = game.flip(state); lastFlipAt = state.elapsed; }
        state.shield = 0;
        state = game.stepRun(state, 1 / 120);
        if (next?.kind === 'squeeze' && Math.abs(next.x + next.width / 2 - state.distance) < 5) { inGate = true; break; }
      }
      const canvas = document.querySelector('canvas');
      canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
      const context = canvas.getContext('2d');
      context.scale(devicePixelRatio, devicePixelRatio);
      drawScene(context, innerWidth, innerHeight, state, state.elapsed, false);
      return { phase: state.phase, coins: state.coins, inGate, y: state.y, shieldHits: state.shieldHits };
    });
    assert.equal(result.phase, 'playing'); assert.ok(result.inGate);
    assert.ok(result.coins >= 24); assert.equal(result.shieldHits, 0);
    assert.ok(result.y > 200 && result.y < 360);
    await scene.screenshot({ path: `${root}/test-results/squeeze-${width}.png` });
  }
  console.log('PASS momentum steering through a generated squeeze and airborne collection on desktop and phone');
  assert.deepEqual(errors, [], `Browser exceptions: ${errors.join('; ')}`);
  console.log('PASS all browser checks; no uncaught exceptions');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
