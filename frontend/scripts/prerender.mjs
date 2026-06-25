// Build-time SSG for the landing page. Runs AFTER `vite build`:
//   1. Build an SSR bundle of src/entry-server.tsx (browser-free).
//   2. Render the Landing component to static HTML.
//   3. Inject it into dist/index.html's <div id="root"> so crawlers get the full
//      content in the initial HTML instead of an empty shell.
// The shipped index.html also clears #root on non-"/" routes before React mounts
// (see the inline script in index.html), so app routes don't flash the landing.
import { build } from 'vite';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const ssrDir = resolve(root, '.ssr-prerender');

await build({
  root,
  logLevel: 'error',
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: '.ssr-prerender',
    emptyOutDir: true,
    rollupOptions: { output: { format: 'es', entryFileNames: 'entry-server.mjs' } },
  },
});

const { renderLanding } = await import(pathToFileURL(resolve(ssrDir, 'entry-server.mjs')).href);
const html = renderLanding();

const indexPath = resolve(root, 'dist/index.html');
let index = readFileSync(indexPath, 'utf8');
if (!index.includes('<div id="root"></div>')) {
  console.warn('[prerender] <div id="root"></div> not found — skipping injection');
} else {
  index = index.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  writeFileSync(indexPath, index);
  console.log(`[prerender] injected ${html.length} chars of landing HTML into dist/index.html`);
}

rmSync(ssrDir, { recursive: true, force: true });
