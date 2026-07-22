// Zips dist-firefox/ for submission to addons.mozilla.org. Mirrors
// package-zip.mjs's Chrome/Edge zip, just pointed at the Firefox build
// output (see build-firefox.mjs for why dist-firefox/ only differs from
// dist/ by its manifest.json).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(extensionRoot, '..');
const distDir = resolve(extensionRoot, 'dist-firefox');
const manifestPath = resolve(distDir, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error('[package-zip-firefox] dist-firefox/manifest.json not found — run `npm run build:firefox` first.');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(manifestPath, 'utf8'));
const zipName = `anzeigenboost-extension-firefox-v${version}.zip`;
const zipPath = resolve(repoRoot, zipName);

if (existsSync(zipPath)) rmSync(zipPath);

execSync(`zip -r ${JSON.stringify(zipPath)} .`, { cwd: distDir, stdio: 'inherit' });

console.log(`[package-zip-firefox] Created ${zipName} — submission-ready for addons.mozilla.org.`);
console.log('[package-zip-firefox] AMO also wants the SOURCE for review since this is a built/bundled extension —');
console.log('[package-zip-firefox] see the audit writeup for how to produce a source archive if AMO flags this on submission.');
