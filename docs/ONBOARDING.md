# AnzeigenBoost — Developer Onboarding Guide

Welcome to **AnzeigenBoost**! This document gets a new developer from zero to a working local environment and provides the context needed to contribute confidently.

---

## 1. What Is This Product?

AnzeigenBoost is a German-market SaaS tool that automates managing ads on **Kleinanzeigen.de** (Germany's largest classifieds marketplace). Key features:

- **Auto-repost** — automatically re-submit ads to keep them at the top of search results
- **Cross-post** — publish the same ad to eBay and Vinted with one click
- **AI optimization** — use Gemini to improve ad titles, descriptions, and pricing
- **View analytics** — track how many views a repost generates over 24 hours
- **Chrome Extension** — syncs live sessions, injects repost buttons into Kleinanzeigen pages

---

## 2. Tech Stack at a Glance

| Layer | Technology |
|---|---|
| **Backend** | NestJS 10, TypeScript, Firebase Firestore, JWT, Axios |
| **Automation Worker** | Express, Playwright (headless Chrome) |
| **Frontend** | React 18, Vite, TailwindCSS, React Router |
| **Chrome Extension** | Manifest V3, React 18, Vite, WebSocket |
| **Database** | Firebase Firestore (NoSQL) |
| **AI** | Google Gemini 2.0 Flash (with OpenRouter fallback) |
| **Infrastructure** | Docker Compose, Firebase Hosting (frontend), Firebase Admin SDK |

---

## 3. Repository Structure

```
kleinzeigen_project/
├── backend/              # NestJS API — orchestration, auth, scheduling, AI
│   └── src/
│       ├── ads/          # Ad CRUD, sync, cross-posting
│       ├── ai/           # Gemini integration + system prompt files
│       ├── auth/         # JWT, cookie handshake, extension WebSocket gateway
│       ├── automation/   # HTTP client for the Playwright worker
│       ├── common/       # Shared filters, constants
│       ├── credentials/  # AES-256-GCM encryption utilities
│       ├── ebay/         # eBay OAuth + Inventory API
│       ├── firebase/     # Firebase Admin SDK singleton
│       ├── reply-templates/  # AI-generated reply templates
│       ├── scheduler/    # Cron jobs (repost + view tracking)
│       ├── support/      # Support contact endpoint
│       └── vinted/       # Vinted Playwright cross-posting
├── automation/           # Express server wrapping Playwright for browser tasks
│   └── src/
│       ├── index.ts      # Route definitions (login, repost, sync, etc.)
│       ├── browser-manager.ts  # Shared Playwright browser lifecycle
│       ├── login.ts      # Kleinanzeigen login + 2FA
│       ├── repost.ts     # Ad delete + re-create flow
│       ├── sync.ts       # Scrape ad list from Kleinanzeigen
│       ├── vinted-login.ts
│       └── vinted-post.ts
├── frontend/             # React web dashboard
│   └── src/
│       ├── pages/        # Ads, Auth, Settings, CreateWithAi, etc.
│       ├── components/   # AdCard, AdGrid, Toast, TopBar, AppShell, etc.
│       └── hooks/        # useAdsActions, useExtension
├── extension/            # Chrome Extension (MV3)
│   └── src/
│       ├── background/index.ts   # Service worker — WS connection + cookie relay
│       ├── content/index.ts      # Content script (page injection)
│       ├── popup/App.tsx         # Extension popup UI
│       └── config/endpoints.ts  # API URL config
├── README.md                   # Overview (stays at root)
├── CHANGELOG.md                # Changelog (stays at root)
└── docs/                       # All other documentation
    ├── ARCHITECTURE.md         # System diagrams and data flow
    ├── ONBOARDING.md           # This file
    ├── DEPLOYMENT.md           # VPS + Firebase deploy guide
    ├── AI_AND_MONETIZATION.md  # AI limits, models, pricing
    ├── ROADMAP.md              # Task tracker
    └── roadmap.csv             # Importable roadmap
```

---

## 4. Prerequisites

- **Node.js** ≥ 18 (use `nvm` for version management)
- **Docker** + **Docker Compose** (for containerised dev)
- **Google Chrome** (for extension development)
- A **Firebase project** with:
  - Firestore enabled in Native mode
  - A **Service Account** key (download from Firebase Console → Project Settings → Service Accounts)
- A **Google AI Studio** API key (for Gemini)
- An **eBay Developer** account (optional, for eBay cross-posting)

---

## 5. First-Time Local Setup

### Step 1 — Clone and Install

```bash
git clone <repo-url> kleinzeigen_project
cd kleinzeigen_project

# Install root workspace dependencies
npm install

# Install each service
cd backend && npm install && cd ..
cd automation && npm install && cd ..
cd frontend && npm install && cd ..
cd extension && npm install && cd ..
```

### Step 2 — Configure Environment Variables

Each service has an `.env.example`. Copy it and fill in values:

```bash
cp backend/.env.example backend/.env
cp automation/.env.example automation/.env
cp frontend/.env.example frontend/.env
```

#### `backend/.env` — critical values:

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | Random 64-char secret for signing JWTs | `openssl rand -hex 32` |
| `INTERNAL_SECRET` | Shared secret between backend ↔ automation | Same value in both `.env` files |
| `GEMINI_API_KEY` | Google AI Studio key | `AIza...` |
| `AUTOMATION_WORKER_URL` | URL of the automation worker | `http://localhost:3001` (local) or `http://automation:3001` (Docker) |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID | `my-project-12345` |
| `FIREBASE_CLIENT_EMAIL` | Service account email | From downloaded SA key |
| `FIREBASE_PRIVATE_KEY` | Service account private key | From downloaded SA key (keep `\n` escapes) |
| `EBAY_CLIENT_ID` | eBay app Client ID | From eBay developer portal |
| `EBAY_CLIENT_SECRET` | eBay app Client Secret | From eBay developer portal |

#### `automation/.env` — critical values:

| Variable | Description |
|---|---|
| `INTERNAL_SECRET` | **Must match `backend/.env`** exactly |
| `PORT` | `3001` (default) |

#### `frontend/.env` — critical values:

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |

> ⚠️ **Never commit `.env` files or any `*-sa.json` files.** They are gitignored.

### Step 3 — Run with Docker (recommended)

```bash
# Builds and starts all services
docker compose up --build

# Services will be available at:
# Backend:    http://localhost:3000
# Frontend:   http://localhost:5173
# Automation: http://localhost:3001 (local only via override)
```

### Step 4 — Run Without Docker (per-service)

```bash
# Terminal 1 — Automation worker (must start first)
cd automation && npm run dev

# Terminal 2 — Backend API
cd backend && npm run start:dev

# Terminal 3 — Frontend
cd frontend && npm run dev
# Visit: http://localhost:5173
```

### Step 5 — Load the Chrome Extension

```bash
cd extension && npm run build
```

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select `extension/dist/`
4. The AnzeigenBoost icon will appear in your toolbar

---

## 6. How Authentication Works

Understanding auth is critical since everything depends on it.

### Cookie Handshake Flow (primary — no password needed)

1. User logs into **Kleinanzeigen.de** normally in Chrome
2. User clicks the AnzeigenBoost extension icon → "Konto verbinden"
3. Extension reads active cookies from `kleinanzeigen.de` via `chrome.cookies`
4. Extension POSTs cookies to `POST /auth/handshake-token`
5. Backend encrypts cookies with AES-256-GCM, stores in Firestore `handshakes/{token}` (30-min TTL)
6. Extension opens a new tab to `/auth/callback?token=<handshakeToken>`
7. Frontend POSTs to `POST /auth/exchange-token`
8. Backend atomically claims the handshake (inside a Firestore transaction), decrypts cookies, creates a JWT
9. User is authenticated — JWT stored in browser `localStorage`

### How the Chrome Extension Stays Connected

After login, the extension's background service worker opens a WebSocket connection to `wss://api.anzeigenboost.de/ws/extension?token=<jwt>`. The backend uses this persistent connection to push commands (like `SYNC_ADS`) to the extension, which runs inside Chrome with full cookie access to Kleinanzeigen.

---

## 7. Firestore Collections

```
sessions/{userId}                     — Active user session (encrypted cookies)
users/{userId}/                       — User document (accountStatus, eBay tokens)
users/{userId}/ads/{adId}             — Ad data + repost config
users/{userId}/ads/{adId}/repostLogs/ — Per-repost view analytics
handshakes/{token}                    — Ephemeral cookie exchange (30 min, one-time use)
loginJobs/{jobId}                     — Visible browser login job tracking
meta/schedulerMeta                    — Last cron run timestamp
aiUsage/{userId}                      — AI request usage tracking (rate limiting)
```

### Ad Status Values

All statuses are defined in `backend/src/ads/dto/ad-status.enum.ts`:

| Enum | Value | Meaning |
|---|---|---|
| `AdStatus.ACTIVE` | `'active'` | Live on Kleinanzeigen |
| `AdStatus.PAUSED` | `'paused'` | Deactivated by user |
| `AdStatus.RESERVED` | `'reserviert'` | Marked as reserved |
| `AdStatus.PENDING` | `'pending'` | Draft / not yet posted |
| `AdStatus.PENDING_REPOST` | `'pending_repost'` | Currently being reposted (lock) |

---

## 8. Key Code Flows

### Sync Ads (Fetch from Kleinanzeigen)

```
User clicks "Sync" in dashboard
  → POST /api/ads/sync
  → AdsService checks session is active
  → AdsService checks Chrome Extension is connected via WebSocket
  → ExtensionGateway.sendCommand(userId, 'SYNC_ADS')
  → Extension background worker fetches Kleinanzeigen ads JSON
  → Extension sends COMMAND_RESPONSE back over WebSocket
  → AdsService batch-upserts ads to Firestore users/{userId}/ads/
  → Returns ads array to frontend
```

### Automated Repost (Cron)

```
SchedulerService cron fires every 1 minute
  → Queries all users' ads where autoRepost=true AND nextRepostAt <= now AND status=active
  → Processes up to 5 users concurrently
  → Per user:
      → Atomically sets status = pending_repost + stamps pendingRepostSince
      → Calls POST /repost on Automation Worker (Playwright)
      → Playwright deletes old ad, re-creates it on Kleinanzeigen
      → On success: updates status=active, lastPostedAt, nextRepostAt
      → Creates a repostLogs entry for view analytics
  → Stuck recovery: ads in pending_repost for >10 min are auto-reverted to active
```

### AI Features (Gemini)

The backend loads system prompts from `src/ai/prompts/*.txt` at startup and passes them to Gemini. There are 4 AI endpoints:

| Endpoint | Prompt file | What it does |
|---|---|---|
| `POST /api/ai/analyze-photos` | `analyze-photos.system.txt` | Extracts product info from up to 8 images |
| `POST /api/ai/optimize-ad` | `optimize-ad.system.txt` | Rewrites ad title + description |
| `POST /api/ai/price-check` | `price-check.system.txt` | Suggests a competitive price |
| `POST /api/ai/reply-suggestions` | `reply-suggestions.system.txt` | Generates buyer message replies |

All AI calls enforce per-user rate limits tracked in Firestore `aiUsage/{userId}`.

---

## 9. Adding a New Feature

### Add a new API endpoint

1. Add a method to the relevant `*.service.ts`
2. Add a decorated handler to the `*.controller.ts`
3. Add a DTO in `*/dto/` if the endpoint accepts a body
4. Add a route call in the frontend if needed

### Add a new marketplace (e.g. Willhaben.at)

1. Create `backend/src/willhaben/willhaben.service.ts` with a `crossPostAd(userId, adId)` method
2. Create `willhaben.module.ts` and `willhaben.controller.ts`
3. Add automation routes to `automation/src/index.ts` if Playwright is needed
4. Wire it into `AdsService.crossPostWillhaben()` and the controller
5. Add a "Verbinden" UI in `frontend/src/pages/Settings.tsx`

### Modify AI prompts

Edit the relevant `.txt` file in `backend/src/ai/prompts/`. They are loaded at startup — restart the backend to pick up changes.

---

## 10. Environment-Specific Configs

| Environment | Backend URL | How to run |
|---|---|---|
| **Local** | `http://localhost:3000` | `npm run dev` (frontend+backend) or `npm start` (+ automation worker) — see [LOCAL_DEV.md](../LOCAL_DEV.md) |
| **Production** | `https://api.anzeigenboost.de` | PM2 (`anzeigenboost-api`) + nginx on the VPS, deployed via SSH from `.github/workflows/deploy-backend.yml` on every push to `main` |

> No Docker setup exists in this repo currently — the `docker-compose*.yml`/`Dockerfile`s that used to sit here were unused scaffolding (never referenced by any deploy workflow, placeholder image names never filled in) and were removed. A real Docker migration is tracked separately (stale, unmerged PR #29) if that's revisited later.

---

## 11. Security Rules to Never Break

1. **Never commit `.env` files** — they contain real secrets
2. **Never commit `*-sa.json` files** — they are Firebase admin keys
3. **Never remove the `X-Internal-Secret` check** from `automation/src/index.ts` — it's the only guard on the worker
4. **Never disable the `JwtAuthGuard`** on API routes without a strong reason
5. **Marketplace cookies are always encrypted** — read/write only via `AuthService.encryptData/decryptData` or `SessionService.getDecryptedCookies()`

---

## 12. Common Issues & Solutions

| Problem | Likely Cause | Fix |
|---|---|---|
| `Chrome Extension ist nicht verbunden` | Extension not running or WS disconnected | Reload extension, check background service worker console |
| `Handshake abgelaufen` | Token older than 30 minutes or already used | Click "Konto verbinden" again in the extension |
| `SESSION_EXPIRED` in scheduler logs | Kleinanzeigen session cookie expired | User must reconnect via extension handshake |
| Ads stuck in `pending_repost` | Automation worker crashed mid-task | Auto-recovered after 10 min by cron; check worker logs |
| `403 Forbidden` from automation worker | `INTERNAL_SECRET` mismatch between backend and automation | Ensure both `.env` files have the same `INTERNAL_SECRET` |
| eBay cross-posting fails | Access token expired | Backend auto-refreshes — check `EBAY_CLIENT_ID/SECRET` |
| AI features return 429 | Per-user AI usage limit reached | Check `aiUsage/{userId}` in Firestore; limits reset monthly |

---

## 13. Useful Commands

```bash
# Build the Chrome extension (required before loading)
cd extension && npm run build

# Rebuild backend and restart
cd backend && npm run build && npm run start

# Tail backend logs in Docker
docker compose logs -f backend

# Tail automation worker logs
docker compose logs -f automation

# Access Firestore emulator (if configured)
firebase emulators:start --only firestore

# Run TypeScript type check without building
cd backend && npx tsc --noEmit
```

---

## 14. Contact & Support

For questions about the codebase, reach out to the project owner or open a GitHub issue. For Firebase/eBay credential access, ask for project access to be granted to your email.
