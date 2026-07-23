# AnzeigenBoost

**German SaaS that keeps your Kleinanzeigen.de ads on top — automatically.**
"Deine Kleinanzeigen immer ganz oben, vollautomatisch."

📋 [Roadmap](docs/ROADMAP.md) · 💰 [AI & Monetization](docs/AI_AND_MONETIZATION.md) · 🚀 [Deployment](docs/DEPLOYMENT.md) · 📡 [Monitoring & Alerts](MONITORING.md)

---

## What it does

- **Auto-Repost** — schedules and re-posts your ads so they jump back to the top.
- **AI listing creation** — turn a photo into a title, description, category & price (DE/EN).
- **Reply templates** — saved answers you copy into the Kleinanzeigen chat in one click.
- **AI optimization & price suggestions** for existing ads.

## Architecture (monorepo)

| Folder | What | Runs on |
|--------|------|---------|
| `backend/` | NestJS API + cron scheduler | VPS (PM2, port 3000) |
| `automation/` | Playwright worker (logs in, reposts) | VPS (PM2, port 3001) |
| `frontend/` | React + Vite dashboard **and landing page** | Firebase Hosting (free) |
| `extension/` | Chrome MV3 extension (captures session, syncs ads) | Chrome Web Store |

Data: Firebase Firestore. AI: OpenRouter (multi-model fallback chain — no direct Gemini SDK).

## Local development

```bash
# Backend  (http://localhost:3000)
cd backend && npm install && npm run start:dev

# Frontend (http://localhost:5173) — includes the landing page at /
cd frontend && npm install && npm run dev

# Automation worker (http://localhost:3001)
cd automation && npm install && npm run dev
```

Without `firebase-credentials.json` the backend uses a local file-based mock, so you can run it with no cloud setup. Copy each `.env.example` to `.env` and fill in keys.

## Environment

See `backend/.env.example` and `frontend/.env.example`. Production **requires**
`JWT_SECRET`, `INTERNAL_SECRET`, `OPENROUTER_API_KEY`, and an https
`AUTOMATION_WORKER_URL` — the app fails fast on startup without them.

## Deployment

- **Backend + automation → VPS:** automated via GitHub Actions on push to `main`. Full guide + manual commands: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
- **Frontend + landing → Firebase Hosting (free):** `cd frontend && npm run build && firebase deploy --only hosting` (or the `deploy-frontend.yml` action). The landing page is the `/` route — it ships with the frontend.
- **Firestore indexes:** `firebase deploy --only firestore:indexes` (required for the scheduler — see DEPLOYMENT.md).

Health check: `curl https://<host>/api/health` → `{"status":"ok",...}`.

Every backend deploy is gated on that health check and auto-rolls back on
failure; a separate scheduled check pings production every 5 minutes and a
GitHub Actions failure on any deploy/publish workflow posts to Slack — see
**[MONITORING.md](MONITORING.md)** for the full setup and how to configure
the Slack webhook.

## Support

Donations: Buy Me a Coffee (link in the dashboard Settings).

## License

Private project. All rights reserved.
