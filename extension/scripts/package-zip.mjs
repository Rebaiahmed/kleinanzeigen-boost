// Zips the built extension for store submission. Chrome Web Store and Edge
// Add-ons both accept the exact same manifest/dist output — no separate
// build or manifest variant needed (confirmed via compatibility audit,
// feature/edge-store-port) — so this one script serves both.
// Mirrors the zip step already used in .github/workflows/deploy-extension.yml
// (same filename convention, same source directory) so local packaging
// matches what CI produces.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(extensionRoot, '..');
const distDir = resolve(extensionRoot, 'dist');
const manifestPath = resolve(distDir, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error('[package-zip] dist/manifest.json not found — run `npm run build` first.');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(manifestPath, 'utf8'));
const zipName = `anzeigenboost-extension-v${version}.zip`;
const zipPath = resolve(repoRoot, zipName);

if (existsSync(zipPath)) rmSync(zipPath);

execSync(`zip -r ${JSON.stringify(zipPath)} .`, { cwd: distDir, stdio: 'inherit' });

console.log(`[package-zip] Created ${zipName} — submission-ready for both Chrome Web Store and Edge Add-ons.`);
