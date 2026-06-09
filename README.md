# AnzeigenBoost

**AnzeigenBoost** (anzeigenboost.de) — a German-market SaaS that automates Kleinanzeigen.de ad reposting.
"Deine Kleinanzeigen immer ganz oben — vollautomatisch."

![AnzeigenBoost Screenshot Placeholder](https://via.placeholder.com/800x400?text=AnzeigenBoost+Dashboard)

## Features
- **Automatisches Reposten:** Keep your ads at the top of the search results automatically.
- **KI-Optimierung:** Improve titles and descriptions using GPT-4o-mini to attract more buyers.
- **Preis-Vorschläge:** AI-powered market price suggestions.
- **Sicher:** AES-256-GCM encrypted credentials storage.

## Tech Stack
```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│                 │       │                 │       │                 │
│    Frontend     │ ────▶ │     Backend     │ ────▶ │    Automation   │
│                 │       │                 │       │                 │
│ React 18, Vite  │   ┌── │   NestJS 10     │       │   Playwright    │
│ TypeScript      │   │   │ TypeScript      │       │   Node/Express  │
│ TailwindCSS     │   │   │ Firebase/Auth   │       │   Headless Chrome│
└─────────────────┘   │   └─────────────────┘       └─────────────────┘
                      │
┌─────────────────┐   │
│                 │   │
│    Extension    │ ──┘
│                 │
│ Chrome MV3      │
│ React, Vite     │
│ TailwindCSS     │
└─────────────────┘
```

## Local Development

### Prerequisites
- Docker & Docker Compose
- Node.js 20+

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/anzeigenboost.git
   cd anzeigenboost
   ```

2. Copy environment files and fill in values (see Environment Variables section):
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp automation/.env.example automation/.env
   ```

3. Start services via Docker Compose:
   ```bash
   docker-compose up --build
   ```

4. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## Environment Variables

Check `.env.example` inside `backend/`, `frontend/`, and `automation/` directories for required environment variables. Ensure the internal secrets match between backend and automation.

## AI Features Documentation

AnzeigenBoost uses OpenAI's GPT-4o-mini model to power intelligent features:
1. **Ad Optimization**: Calls `/ai/optimize-ad` to improve German ad copy.
2. **Price Suggestion**: Calls `/ai/suggest-price` to analyze the market and suggest an optimal price range.
3. **AI Chat Assistant**: A floating chat widget (`/ai/chat`) utilizing SSE to provide live ad advice to users.

Monthly token limits are enforced based on the user's subscription tier.

## VPS Deployment

### Domain
Register `anzeigenboost.de` at Hetzner or IONOS.

### VPS Setup
Provider: Hetzner Cloud (CX22 instance recommended)
OS: Ubuntu 22.04 LTS

```bash
# SSH into VPS
ssh root@YOUR_VPS_IP

# Install dependencies
apt update && apt upgrade -y
apt install -y docker.io docker-compose git
systemctl enable docker

# Clone and setup
mkdir -p /opt/anzeigenboost
cd /opt/anzeigenboost
git clone https://github.com/yourusername/anzeigenboost .

# Copy .env files (ensure to rename them appropriately for prod)
# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### SSL Setup
```bash
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d anzeigenboost.de -d www.anzeigenboost.de \
  --email your@email.com --agree-tos
```

### Firestore Indexes (required)

The repost scheduler runs two `collectionGroup('ads')` queries (due-ad lookup and
stuck-task recovery). Firestore **rejects** these queries until their composite
indexes exist, so they must be deployed once before the scheduler runs in production.

The index definitions live in [`backend/firestore.indexes.json`](backend/firestore.indexes.json)
and are wired up by the root `firebase.json` / `.firebaserc`. Deploy them with:

```bash
firebase deploy --only firestore:indexes --project kleinanzeigen-app
```

Notes:
- Run this **once**, and again whenever you add a new index to `backend/firestore.indexes.json`.
- Index builds can take a few minutes; until they finish the scheduler logs an index
  error and simply skips that tick (no crash) — it recovers automatically once the
  build completes.
- Local development uses an in-memory Firestore mock, so no index deploy is needed there.

## Setting up PayPal Donate button

1. Go to https://www.paypal.com/donate/buttons
2. Log in to your PayPal account
3. Create a donation button (Donate, Organization: AnzeigenBoost, Purpose: Unterstützung des Projekts, No fixed amount)
4. Copy the `hosted_button_id` from the generated HTML
5. Your donate URL: `https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID`
6. Set `PAYPAL_DONATE_URL` in backend `.env`

### Optional: Ko-fi
1. Create free account at ko-fi.com
2. Your URL: `https://ko-fi.com/yourusername`
3. Set `KOFI_URL` in backend `.env`

## Support this project

AnzeigenBoost is a side project developed in free time. If it helps you, consider supporting! ☕
- [Support via PayPal](https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID)
- [Support via Ko-fi](https://ko-fi.com/yourusername)

## Contributing
Contributions are welcome. Please open an issue or pull request.

## License
MIT

---

## SECTION D: MONOREPO STRUCTURE ADDITION

Extend the existing monorepo root with one new top-level folder called
extension alongside the existing backend, frontend, and automation folders.
This folder contains the Chrome browser extension. It shares no code directly
with the frontend folder but communicates with the same backend API already
built. Add the folder to the root README monorepo diagram and mention it as
the fifth package alongside backend, frontend, automation, and the extension.

---

## SECTION E: CHROME EXTENSION

### Folder structure

Create a folder called extension at the monorepo root. Inside it scaffold a
Chrome Manifest V3 extension using TypeScript and Vite as the build tool.
The src directory contains four subdirectories: popup which is what the user
sees when clicking the extension icon in the toolbar, content which is the
script injected into Kleinanzeigen pages, background which is the service
worker handling alarms and API communication, and shared which holds types
and utility functions used across the other three.

### What the extension does

The extension has two core jobs. The first is to make reposting faster by
detecting when the user is browsing their own Kleinanzeigen listings and
injecting a one-click repost button directly into the page without leaving
Kleinanzeigen. The second is to show the user their AnzeigenBoost schedule
and status through a popup without needing to open the full web app.

### Popup interface

The popup opens when the user clicks the AnzeigenBoost icon in the Chrome
toolbar. Make it 380 pixels wide and up to 500 pixels tall. Use the same
brand colors as the web frontend — the Kleinanzeigen-inspired green palette.

If the user is not logged in to AnzeigenBoost show a compact login form that
calls the backend auth endpoint and stores the resulting JWT in
chrome.storage.session. If logged in show a compact dashboard with three tabs.

The first tab called Heute shows which ads are due for reposting today with
a repost now button next to each one. The second tab called Anzeigen shows
the full ads list with status badges showing active, paused, or error state
and the next scheduled repost date for each. The third tab called KI shows
a compact version of the AI chat where the user can type a quick question
and get a streamed response without opening the full web app.

Style the popup to feel like a mini version of the web dashboard. It should
be immediately recognizable as the same product to someone who uses the web
app regularly.

### Content script — injected on Kleinanzeigen pages

The content script runs only on URLs matching the kleinanzeigen.de domain.
It performs two different functions depending on which page the user is on.

On the Meine Anzeigen page at kleinanzeigen.de/m-meine-anzeigen.html the
content script reads each ad card, extracts the Kleinanzeigen ad ID from the
card's link URL, and sends those IDs to the background worker which checks
them against the user's AnzeigenBoost tracked ads. For each matched ad it
injects a small status badge next to the ad title. The badge shows a green
checkmark and the next repost date if the ad is on schedule, an amber clock
icon if the ad is due today, or a red warning icon if the ad is overdue.
This gives the user instant visual context while browsing their own listings
without any extra clicks.

On individual ad pages matching the URL pattern kleinanzeigen.de/s-anzeige
the content script injects a small floating action button anchored to the
bottom right corner of the page. The button shows the AnzeigenBoost logo and
the text Jetzt reposten. When clicked it sends a message to the background
worker which calls the backend POST /ads/:id/repost endpoint. While the repost
is processing the button shows a loading spinner. On success it shows a
checkmark and updates to display the new next repost date. On failure it shows
a brief red error message.

The content script never calls the backend API directly. All API communication
goes through the background service worker which is the single place that holds
and manages the auth token.

### Background service worker

The background service worker uses chrome.alarms to fire a check every 15
minutes while the browser is running. When an alarm fires it calls the backend
GET /schedule endpoint and checks if any ads are due or overdue. If any are
found it creates a chrome.notifications.create notification showing the ad
title and a Jetzt reposten action button. Clicking the action button in the
notification triggers the repost through the same API call as the popup button.

The background worker listens for messages from both the content script and the
popup and routes all API calls, keeping auth token management in one single
place. Store the access token in chrome.storage.session so it is cleared
automatically when the browser closes. Store a remember-me boolean in
chrome.storage.local so that if the user chose to stay logged in the background
worker silently calls the refresh token endpoint when the browser starts and
restores the session without requiring the user to log in again.

### Build process

Use Vite with the vite-plugin-web-extension package to handle the multi-entry
build since the popup, content script, and background service worker each need
to be compiled as separate output files. The build output goes into a dist
folder inside the extension directory. The manifest.json lives in the extension
root and references the compiled output paths. Add an npm run build script for
production and an npm run dev script that uses Vite's watch mode so the
extension auto-rebuilds on file changes during development.

Add the extension as a build check step in the existing GitHub Actions CI
workflow. The step should change directory into extension, run npm ci, and run
npm run build to verify the extension compiles cleanly on every pull request.

### Chrome Web Store publishing

Document in the extension README that publishing requires a one-time five
dollar Chrome Web Store developer account fee. The extension's privacy policy
URL should point to the existing Datenschutz page at anzeigenboost.de/datenschutz
so no separate policy document is needed.

Write the Chrome Web Store listing description in both German and English since
the store is international. The primary German description should lead with the
core value: automatisches Reposten von Kleinanzeigen direkt im Browser ohne
die Website zu verlassen. The English description is a shorter summary for
international discoverability.

Prepare the extension icon at 16, 48, and 128 pixel sizes using the
AnzeigenBoost logo mark. Because the extension stores a JWT and interacts with
a third-party website, note in the README that Chrome Web Store review may take
between two and seven business days and the reviewer may request a written
explanation of what user data is accessed and why. Prepare a short explanation
in advance: the extension stores only a JWT access token in session storage and
reads ad IDs from Kleinanzeigen page URLs to match them against the user's own
tracked ads in the AnzeigenBoost backend.

### Extension roadmap phases

Phase one covers the popup with the login form and the three-tab dashboard
including the manual repost button. Users who already have a web account can
install the extension and use it immediately without any extra setup.

Phase two adds the content script that injects status badges on the Meine
Anzeigen page. This is the feature that makes the extension feel magical —
the user's own listings page on Kleinanzeigen gains live repost status
indicators they did not put there.

Phase three adds the one-click repost floating button injected on individual
ad detail pages. This is the fastest possible repost path: the user is already
looking at their ad and clicks one button instead of switching to the web app.

Phase four adds the background alarm system with native browser notifications
so the extension watches for due reposts even when the user is not actively
using it.

Phase five adds the AI chat tab in the popup, giving users access to the
assistant without opening the web app.

---

## SECTION F: UPDATED PRODUCT ROADMAP

Phase 1 — Web MVP, weeks 1 through 4:
Build and launch the NestJS backend, React web frontend, and Playwright
automation service. Deploy to Hetzner VPS. Launch free tier. Goal is 100 free
users and validation that the core repost automation works reliably.

Phase 2 — Web complete, weeks 5 through 8:
Add the cron scheduler, repost logs, schedule calendar view, email notifications
via Resend, and the landing page with the SupportMe donation section. Launch
paid plans via Lemon Squeezy. Goal is first 10 paying users and 50 euros MRR.

Phase 3 — AI features, weeks 9 through 12:
Build the full AI module: ad title and description optimizer, price suggester,
streaming chat assistant, and smart repost timing for Pro users. Gate by plan.
Goal is AI features becoming the primary motivation to upgrade from free to paid.

Phase 4 — Chrome extension, month 4:
Build and publish the extension in the five phases described above, starting
with the popup and working toward background notifications and AI chat. The
extension lowers the friction of daily use significantly and makes for a
compelling product demo video for marketing.

Phase 5 — Multi-platform expansion, months 5 through 7:
Extend the Playwright automation scripts for Willhaben.at targeting Austria
and Ricardo.ch targeting Switzerland. The backend and frontend gain a platform
selector. This roughly triples the addressable market with around 20 percent
additional development effort.

Phase 6 — Scale and team accounts, months 8 through 10:
Add team accounts allowing one subscription to cover multiple Kleinanzeigen
accounts, targeting resellers and agencies who manage listings for clients.
Add a scraped analytics dashboard showing estimated ad views from the
Kleinanzeigen ad statistics page.

Phase 7 — Acquisition readiness, year 2:
Document all systems, maintain clean monthly revenue records, reduce churn
below 4 percent monthly, reach 500 paying users. List on Acquire.com targeting
a 24 to 36 times MRR valuation. At 500 users averaging 8 euros per month the
listing value range is roughly 96,000 to 144,000 euros.

---

## SECTION G: SHARED CONSIDERATIONS

The extension and the web frontend call the same backend API with the same JWT
authentication. Document this in the root README with a simple diagram showing
one backend serving two clients: the React web app and the Chrome extension.

The brand identity, color palette, and German copy tone must be identical across
both surfaces. A user switching from the web dashboard to the extension popup
should feel they are using the same product.

For the AI chat feature the conversation history is stored per user in Firestore,
not per device or per surface. A conversation started in the web app continues
in the extension popup. Highlight this cross-surface continuity on the landing
page as a feature of the Pro plan.
