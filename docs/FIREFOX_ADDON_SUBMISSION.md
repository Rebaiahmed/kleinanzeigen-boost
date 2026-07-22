# Firefox Add-on (AMO) Submission — AnzeigenBoost

`npm run build:firefox && npm run package:zip:firefox` (in `extension/`)
produces `anzeigenboost-extension-firefox-v{version}.zip`, submission-ready
for [addons.mozilla.org](https://addons.mozilla.org/developers/).

## What's different from Chrome/Edge

- **Manifest**: `extension/public/manifest.firefox.json` — background script
  runs as `scripts: ["background.js"]` (Firefox's MV3 doesn't support
  `service_worker` the same way Chrome/Edge do) instead of a service worker,
  and adds the required `browser_specific_settings.gecko` block (extension
  ID + minimum Firefox version). No `externally_connectable` key (Firefox
  doesn't support it — the extension already has a `postMessage` fallback
  for the one place that mattered, the auth callback relay).
- **JS bundle**: identical to Chrome/Edge — `build-firefox.mjs` copies the
  already-built `dist/` rather than re-running Vite, so there's zero chance
  of Firefox-only behavior drift. Every `chrome.*` API this extension calls
  (`alarms`, `cookies`, `notifications`, `runtime`, `scripting`, `storage`,
  `tabs`) is covered by Firefox's built-in `chrome.*` compatibility shim.
- **One runtime risk, not a build-time one**: `chrome.scripting.executeScript`
  with `world: 'MAIN'` (used by the repost engine,
  `extension/src/background/repost-engine.ts`) is only supported in Firefox
  128+. Older Firefox will throw at that call site. Not fixed in this pass —
  flagging it so it's tested for real on install, and 128+ is already >2
  years old at time of writing so the practical exposure is small.

## Reusable store listing copy

Same story as Edge (see [`EDGE_STORE_LISTING.md`](EDGE_STORE_LISTING.md)) —
[`CHROME_STORE_LISTING.md`](CHROME_STORE_LISTING.md)'s copy has no
Chrome-specific wording, so name/description/screenshots/privacy-policy URL
are directly reusable. AMO's listing form has fewer fields than Partner
Center (no separate certification questionnaire), so this is actually the
easiest of the three submissions to fill out by hand.

## Not automated in this pass

Staying **manual** for the same reason as Edge: AMO does support an API for
automated submission (JWT auth via an `issuer`/`secret` key pair from
addons.mozilla.org's API keys page, used with `web-ext sign` or the
addons-server REST API directly), so this isn't a hard blocker the way
Partner Center's Azure AD requirement is — but setting up a third publish
pipeline before the Chrome one (the highest-traffic store) has been used
even once isn't justified yet. If Firefox submission cadence picks up,
revisit: the GitHub Actions equivalent would need `AMO_JWT_ISSUER` and
`AMO_JWT_SECRET` secrets (generate at
https://addons.mozilla.org/developers/addon/api/key/) and a
`web-ext sign --api-key --api-secret` step, gated behind the same kind of
approval-required GitHub Environment used for Chrome
(`.github/workflows/deploy-extension.yml`).

Also note: AMO reviews **built/bundled** extensions more strictly than
Chrome/Edge and will often ask for the extension's *source* alongside the
built zip, since it can't otherwise verify the built JS matches buildable
source. If/when this gets automated, budget for producing a source archive
(e.g. `git archive` of the `extension/` directory at the tagged commit) as
a second upload alongside the built zip.
