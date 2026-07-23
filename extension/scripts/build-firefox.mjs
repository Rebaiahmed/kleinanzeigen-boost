// Produces dist-firefox/ from the already-built dist/ — no second `vite build`
// needed, since the actual JS bundle is target-agnostic (confirmed via the
// Firefox compatibility audit: every chrome.* API this extension calls is
// covered by Firefox's own chrome.* compatibility shim). Only the manifest
// differs (background.scripts vs service_worker, browser_specific_settings,
// no externally_connectable — see public/manifest.firefox.json's comments in
// the audit writeup). Copying dist/ guarantees the Firefox build ships
// byte-identical logic to the Chrome/Edge build, not a second, potentially-
// drifted compile.
import { cpSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const firefoxDistDir = resolve(root, 'dist-firefox');
const firefoxManifestSrc = resolve(root, 'public/manifest.firefox.json');

if (!existsSync(distDir)) {
  console.error('[build-firefox] dist/ not found — run `npm run build` first.');
  process.exit(1);
}
if (!existsSync(firefoxManifestSrc)) {
  console.error('[build-firefox] public/manifest.firefox.json not found.');
  process.exit(1);
}

if (existsSync(firefoxDistDir)) rmSync(firefoxDistDir, { recursive: true });
cpSync(distDir, firefoxDistDir, { recursive: true });

// Swap in the Firefox manifest and remove the now-redundant copy Vite's
// public/ passthrough put in dist/ (and therefore in this dist-firefox/ copy).
const firefoxManifest = readFileSync(firefoxManifestSrc, 'utf8');
writeFileSync(resolve(firefoxDistDir, 'manifest.json'), firefoxManifest);
rmSync(resolve(firefoxDistDir, 'manifest.firefox.json'), { force: true });

console.log('[build-firefox] dist-firefox/ ready — same JS as the Chrome/Edge build, Firefox manifest swapped in.');
