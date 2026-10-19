import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('dist/index.html', root), 'utf8');
const scriptPath = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/)?.[1];
const stylePath = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)?.[1];
if (!scriptPath || !stylePath) throw new Error('Expected one bundled JS entry and one stylesheet.');
const script = await readFile(new URL(`dist/${scriptPath.replace(/^\//, '')}`, root), 'utf8');
const style = await readFile(new URL(`dist/${stylePath.replace(/^\//, '')}`, root), 'utf8');
const favicon = await readFile(new URL('public/favicon.svg', root), 'utf8');
const output = html
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace(/<link rel="stylesheet"[^>]*href="[^"]+"[^>]*>/, () => `<style>${style.replace(/<\/style/gi, '<\\/style')}</style>`)
  .replace('href="/favicon.svg"', () => `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
await mkdir(new URL('release/', root), { recursive: true });
await writeFile(new URL('release/magnet-dash.html', root), output);
console.log(`Standalone game written to ${path.resolve('release/magnet-dash.html')} (${Math.round(Buffer.byteLength(output) / 1024)} KB). No server or installation required.`);
