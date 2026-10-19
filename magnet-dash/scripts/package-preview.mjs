import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const release = new URL('../release/', import.meta.url);
await mkdir(new URL('site/', release), { recursive: true });
await copyFile(new URL('magnet-dash.html', release), new URL('site/index.html', release));
await writeFile(new URL('site/.nojekyll', release), '');
const packaged = spawnSync('python3', ['-c', `
import pathlib, sys, zipfile
release = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(release / 'magnet-dash-preview.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(release / 'site/index.html', 'index.html')
    archive.write(release / 'site/.nojekyll', '.nojekyll')
with zipfile.ZipFile(release / 'magnet-dash-preview.zip') as archive:
    assert archive.namelist() == ['index.html', '.nojekyll']
    assert archive.read('index.html') == (release / 'magnet-dash.html').read_bytes()
print('Static site and verified ZIP prepared; no upload or publication performed.')
`, fileURLToPath(release)], { stdio: 'inherit' });
if (packaged.error) throw packaged.error;
if (packaged.status !== 0) process.exit(packaged.status ?? 1);
