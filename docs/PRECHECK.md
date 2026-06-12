# AnzeigenBoost — Pre-Launch Precheck

Manual smoke-test checklist before a release / production cutover (roadmap 6.2).
Mark each item **✅ Pass**, **❌ Fail**, or **⏳ Not tested**. Add notes/date.

Legend: ✅ pass · ❌ fail · ⏳ not tested · ⚠️ pass with caveat

---

## 1. Authentication & Connection

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.1 | Log in to the dashboard (email) → lands on Meine Anzeigen | ✅ |  |
| 1.2 | Extension popup: logged out of KA → shows „Nicht angemeldet", links locked, login CTA | ⏳ |  |
| 1.3 | Extension popup: logged in to KA, not connected → „Verbinden" is the only action | ⏳ |  |
| 1.4 | „Verbinden" → handshake stores token → popup shows „Verbunden", links enabled | ⏳ |  |
| 1.5 | Stepper advances ① ✓ → ② active after logging into KA | ⏳ |  |
| 1.6 | Unauthenticated → opening a dashboard link redirects to /login (ProtectedRoute) | ⏳ |  |

## 2. Sync

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1 | „Synchronisieren" pulls the user's KA ads into the dashboard | ✅ |  |
| 2.2 | Indeterminate progress bar + „Synchronisiere N Anzeigen…" shows during sync | ⏳ |  |
| 2.3 | Large account (50+ ads) syncs without error; pagination 12/page | ⏳ |  |
| 2.4 | Newly appeared KA ad shows first („Neueste zuerst" default) | ⏳ |  |
| 2.5 | Listing state synced: Reserviert / Pausiert badge + greyed image | ⏳ |  |
| 2.6 | Deleted-on-KA ad flagged „Gelöscht" (not silently dropped) | ⏳ |  |

> **Confirmed working:** Login (1.1) and Sync (2.1) verified manually — basic
> login + ad sync flow works end-to-end.

## 3. Auto-Repost & Scheduler

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.1 | Enable Auto-Repost on an ad → interval saved | ⏳ |  |
| 3.2 | „Jetzt" immediate repost works and pushes the ad up on KA | ⏳ |  |
| 3.3 | Reserved/paused ad: Auto-Repost toggle disabled with note | ⏳ |  |
| 3.4 | Repost failure → ad reverts to active, failure logged (repostLogs) | ⏳ |  |
| 3.5 | Scheduler run summary visible (schedulerMeta.lastRun) | ⏳ |  |

## 4. AI (create-from-photo)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1 | Upload photos → AI returns title/description/price/category | ⏳ | needs valid AIza Gemini key |
| 4.2 | „Neu generieren" re-runs the AI on the same photos | ⏳ |  |
| 4.3 | Vinted tab: brand/color/material fields populate | ⏳ |  |
| 4.4 | At monthly limit → upgrade prompt (only if MONETIZATION_ENABLED) | ⏳ |  |

## 5. Reply Templates

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.1 | Create / edit / delete a reply template | ⏳ |  |
| 5.2 | Copy a template → paste into KA chat | ⏳ |  |
| 5.3 | In-page „Vorlage einfügen" button on KA Nachrichten (if flag on) | ⏳ |  |

## 6. Environment / Config (pre-prod)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.1 | Backend `/api/health` returns ok | ⏳ |  |
| 6.2 | Real `AIza…` Gemini key set on server (not depleted `AQ.` key) | ❌ | open item |
| 6.3 | Extension `endpoints.ts` set to prod URLs before publishing | ⏳ | still localhost |
| 6.4 | HTTPS domain live (dashboard ↔ backend, Stripe webhook) | ❌ | depends on 1.2 (domain) |
| 6.5 | Exposed service-account keys rotated | ❌ | open security item |

---

### Known blockers before public launch
- Buy domain `anzeigenboost.de` (gates HTTPS, extension publish, Stripe webhook).
- Set a real Gemini `AIza…` key on the VPS (AI features fail otherwise).
- Rotate the previously-exposed service-account keys.
