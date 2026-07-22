# Running AnzeigenBoost locally

## Ports
| Service | Port | URL |
|---|---|---|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (NestJS) | 3000 | http://localhost:3000/api |
| Automation worker (Playwright) | 3001 | http://localhost:3001 |

The frontend already points at the local backend in dev — `frontend/.env` has
`VITE_API_URL=http://localhost:3000/api`. No change needed.

## One-time setup
```bash
npm run install:all      # installs root + frontend + backend + extension deps
```
Make sure these env files exist (they hold secrets, not committed):
- `backend/.env` — Firebase creds, `INTERNAL_SECRET`, `OPENROUTER_API_KEY`
- `automation/.env` — only needed if you run the Playwright worker (`npm start`,
  not plain `npm run dev`). Required: `PORT=3001` and `INTERNAL_SECRET` —
  **must be the exact same value as `backend/.env`'s `INTERNAL_SECRET`**, since
  the backend authenticates its calls to the worker with it; a mismatch fails
  every repost/scrape call with a 401 (see `automation/src/index.ts`'s
  `X-Internal-Secret` check). Everything else in `automation/.env.example`
  (`CHROMIUM_PATH`, `PROXY_*`, `BLOCK_RESOURCES`) is optional — leave unset to
  run with Playwright's bundled Chromium and no proxy.

## Day-to-day: just the app (most UI/backend work)
```bash
npm run dev              # runs frontend + backend together (colored logs)
```
Then open http://localhost:5173.

## Full stack incl. the Playwright automation worker
```bash
npm start                # frontend + backend + automation worker
```

## Logging in locally with your REAL Kleinanzeigen account
The dashboard auth is driven by the Chrome extension, which must point at your
local servers (not production). Use the dev build:
```bash
npm run ext:dev          # builds extension/dist against localhost:3000 / :5173
```
Then in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked**
→ select `extension/dist`. Click the extension's connect button — it will run the
handshake against your local backend and log you in with your real account/cookies.

> The dev extension build injects localhost host-permissions and points
> `ENDPOINTS` at localhost; the production build never includes localhost. See
> `extension/scripts/patch-dev-manifest.mjs`.

## Dev-only mock login (fastest way to reach the dashboard)
No extension, no real Kleinanzeigen account, no CAPTCHA.

Start both servers already wired for mock login:
```bash
npm run dev:mock          # frontend + backend, both in mock mode
```
Or start each side independently (useful when only one half needs restarting):
```bash
npm run start:backend:mock    # backend with DEV_LOGIN_ENABLED=true
npm run start:frontend:mock   # frontend with VITE_DEV_MOCK_ADS_COUNT=24
```
Then open http://localhost:5173/login and click **"Mit Test-Account einloggen"**
(only rendered in dev builds). It calls `POST /api/auth/dev-login`, sets the
session cookie + `localStorage` token, seeds `ab_mock_ads`, and redirects to
`/meine-anzeigen`.

Configurable via env:
- Backend `DEV_LOGIN_ENABLED` (default `true` outside `NODE_ENV=production`) —
  set to `false` to disable the endpoint even in dev.
- Backend `DEV_LOGIN_EMAIL` — identity of the mock session (default `dev@example.com`).
- Frontend `VITE_DEV_MOCK_ADS_COUNT` — how many synthetic ads to seed.

CLI alternative (skips the UI, requires the backend already running):
```bash
npm run dev:mock-login   # POSTs to the backend, saves the session cookie to /tmp
```
This endpoint 404s automatically when `NODE_ENV=production`, so it can never
reach a deployed environment.

## EN/DE language toggle
Behind `FEATURE_I18N_ENABLED` (backend) / `enableI18n` (frontend feature flag),
default OFF. Set `FEATURE_I18N_ENABLED=true` in `backend/.env` to show the
language toggle (🌐 DE/EN) in the top bar. German stays the default language
regardless of the flag — it only gates whether the toggle UI is rendered.
Translation strings live in `frontend/src/i18n/locales/{de,en}.json`; the shell
(nav, top bar, login, landing page) is translated. Deeper pages (Settings,
CreateWithAi, Wettbewerb, etc.) still render German-only strings — extend the
JSON files and swap in `useTranslation()`'s `t()` as those get covered.

## Preview the dashboard with many ads (no backend, no login)
For eyeballing pagination/search/list performance at scale without a big account:
```bash
npm run start:frontend   # or: npm run dev
```
At http://localhost:5173, open DevTools console:
```js
localStorage.setItem('token', 'dev');        // satisfy the auth guard
localStorage.setItem('ab_mock_ads', '107');  // render 107 synthetic ads
location.href = '/meine-anzeigen';
```
Turn it off: `localStorage.removeItem('ab_mock_ads')`. This mock is DEV-only and
is stripped from production builds.
