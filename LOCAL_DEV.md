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
- `automation/.env` — only needed if you run the Playwright worker

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
No extension, no real Kleinanzeigen account, no CAPTCHA. On `/login`, click
**"Mit Test-Account einloggen"** (only rendered in dev builds). It calls
`POST /api/auth/dev-login`, sets the session cookie + `localStorage` token, seeds
`ab_mock_ads` (count via `VITE_DEV_MOCK_ADS_COUNT`, default 24), and redirects to
`/meine-anzeigen`.

Configurable via env:
- Backend `DEV_LOGIN_ENABLED` (default `true` outside `NODE_ENV=production`) —
  set to `false` to disable the endpoint even in dev.
- Backend `DEV_LOGIN_EMAIL` — identity of the mock session (default `dev@example.com`).
- Frontend `VITE_DEV_MOCK_ADS_COUNT` — how many synthetic ads to seed.

CLI alternative (skips the UI):
```bash
npm run dev:mock-login   # POSTs to the backend, saves the session cookie to /tmp
```
This endpoint 404s automatically when `NODE_ENV=production`, so it can never
reach a deployed environment.

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
