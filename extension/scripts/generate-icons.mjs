/**
 * Regenerate the extension PNG icons from the source SVG.
 *
 * Source of truth: extension/public/icons/anzeigenboost_app_icon.svg
 * Outputs:         extension/public/icons/icon-{16,32,48,128}.png
 *
 * Uses Playwright's bundled Chromium (already a dependency of ../../automation)
 * to rasterize the SVG faithfully, preserving the rounded-square + transparency.
 *
 * Run from the extension/ folder:
 *   node scripts/generate-icons.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(__dirname, '../public/icons');
const SVG_PATH = resolve(ICONS_DIR, 'anzeigenboost_app_icon.svg');
const SIZES = [16, 32, 48, 128];

// Resolve Playwright from the sibling automation package so we don't add a dep here.
const require = createRequire(resolve(__dirname, '../../automation/package.json'));
const { chromium } = require('playwright');

const svg = readFileSync(SVG_PATH, 'utf8');

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<!doctype html><html><head><style>
         html,body{margin:0;padding:0}
         svg{display:block;width:${size}px;height:${size}px}
       </style></head><body>${svg}</body></html>`,
      { waitUntil: 'networkidle' },
    );
    const el = await page.$('svg');
    await el.screenshot({ path: resolve(ICONS_DIR, `icon-${size}.png`), omitBackground: true });
    await page.close();
    console.log(`✓ icon-${size}.png`);
  }
} finally {
  await browser.close();
}
console.log('Done. PNGs written to extension/public/icons/');
