// Zips dist/ for submission to Microsoft Partner Center (Edge Add-ons).
// Edge is Chromium-based and accepts the exact same manifest/dist output as
// Chrome (confirmed via the compatibility audit — same MV3 implementation,
// same chrome.* APIs, no divergent manifest keys used by this extension) —
// so this is genuinely just a repackage of the same dist/ package-zip.mjs
// already produces, under an Edge-specific filename so submission artifacts
// for each store are unambiguous instead of you having to guess whether the
// one generic zip is the right one to upload where.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(extensionRoot, '..');
const distDir = resolve(extensionRoot, 'dist');
const manifestPath = resolve(distDir, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error('[package-zip-edge] dist/manifest.json not found — run `npm run build` first.');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(manifestPath, 'utf8'));
const zipName = `anzeigenboost-extension-edge-v${version}.zip`;
const zipPath = resolve(repoRoot, zipName);

if (existsSync(zipPath)) rmSync(zipPath);

execSync(`zip -r ${JSON.stringify(zipPath)} .`, { cwd: distDir, stdio: 'inherit' });

console.log(`[package-zip-edge] Created ${zipName} — submission-ready for Microsoft Partner Center.`);
