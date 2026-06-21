// Adds localhost host permissions + matches to the BUILT dist/manifest.json for
// local development. The committed public/manifest.json stays production-clean
// (no localhost) so it's never accidentally shipped to the Chrome Web Store.
// Run automatically by `npm run build:dev` after vite build.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'dist/manifest.json');

const LOCAL_HOSTS = [
  'http://127.0.0.1:3000/*',
  'http://localhost:3000/*',
  'ws://127.0.0.1:3000/*',
  'ws://localhost:3000/*',
  'http://localhost:5173/*',
];
const LOCAL_DASHBOARD = 'http://localhost:5173/*';

const m = JSON.parse(readFileSync(manifestPath, 'utf8'));

// host_permissions
m.host_permissions = Array.from(new Set([...(m.host_permissions || []), ...LOCAL_HOSTS]));

// externally_connectable
m.externally_connectable ??= { matches: [] };
m.externally_connectable.matches = Array.from(
  new Set([...(m.externally_connectable.matches || []), LOCAL_DASHBOARD]),
);

// dashboard content script (the one matching the web app, not kleinanzeigen)
for (const cs of m.content_scripts || []) {
  if ((cs.js || []).includes('dashboard.js')) {
    cs.matches = Array.from(new Set([...(cs.matches || []), LOCAL_DASHBOARD]));
  }
}

writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n');
console.log('[build:dev] patched dist/manifest.json with localhost permissions');
