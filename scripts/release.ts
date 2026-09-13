import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const releaseDir = resolve(root, 'release');

function walk(dir: string, base = dir): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const rel = full.slice(base.length + 1).replace(/\\/g, '/');
    if (statSync(full).isDirectory()) Object.assign(out, walk(full, base));
    else out[rel] = new Uint8Array(readFileSync(full));
  }
  return out;
}

const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

console.log('Building…');
execSync('pnpm build', { cwd: root, stdio: 'inherit' });

if (!existsSync(dist)) throw new Error('dist/ missing after build');

mkdirSync(releaseDir, { recursive: true });
const zipName = `my-x-flows-${pkg.version}.zip`;
const zipPath = resolve(releaseDir, zipName);
const files = walk(dist);
const zipped = zipSync(files, { level: 6 });
writeFileSync(zipPath, zipped);
console.log(`Wrote ${zipPath}`);
