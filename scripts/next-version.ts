import { readFileSync, writeFileSync } from 'node:fs';

// CalVer YYYY.MMdd.HHmm (UTC), without SemVer-invalid leading zeroes.
export function calver(now: Date = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid release date');
  return `${now.getUTCFullYear()}.${(now.getUTCMonth() + 1) * 100 + now.getUTCDate()}.${now.getUTCHours() * 100 + now.getUTCMinutes()}`;
}

if (import.meta.main) {
  const version = calver();
  if (process.argv.includes('--write')) {
    const path = new URL('../package.json', import.meta.url);
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifest.version = version;
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(version);
}
