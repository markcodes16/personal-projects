import { copyFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
await mkdir(new URL('demo/', root), { recursive: true });
await copyFile(new URL('release/magnet-dash.html', root), new URL('demo/index.html', root));
console.log('Public demo file refreshed from the tested standalone build. No credentials or events are included.');
