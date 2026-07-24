# AnzeigenBoost — Roadmap & Task Tracker

Status legend: **Pending** · **In Progress** · **Done**
Priority: **High** · **Medium** · **Low**

> Notes flag what already exists in the codebase so work isn't duplicated.
> An importable version lives in [`roadmap.csv`](roadmap.csv).

---

## Part 1 — DevOps & Infrastructure

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 1.1 | Create VPS server + add credentials to GitHub Actions secrets | **Done** | High | VPS `178.105.216.147`; VPS_HOST/USER/SSH_KEY + FIREBASE_SERVICE_ACCOUNT secrets set |
| 1.2 | Buy domain (e.g. anzeigenboost.de) | Pending | High | Use **anzeigenboost.de** (NOT kleinanzeigen-* — trademark). Then A `api`→VPS + Firebase custom domain + certbot |
| 1.3 | Test GitHub Actions deployment workflow | **Done** | High | All 3 deploy workflows green (backend/automation/frontend) |
| 1.4 | Test Firebase deployment (frontend) | **Done** | High | Action succeeds; also deployed manually |
| 1.5 | Test landing page deployment | **Done** | High | Live: https://kleinanzeigen-app.web.app |
| 1.6 | Deploy backend to VPS | **Done** | High | PM2 `anzeigenboost-api` (3000) + nginx :80; Firestore connected; health OK |
| 1.7 | Deploy frontend to Firebase | **Done** | High | Live (landing works; dashboard needs https API = domain) |
| 1.8 | Command to clean up Firestore data (for testing) | **Done** | Medium | `npm run cleanup:firestore -- --user <id>` or `--all --yes` (works in real + mock mode) |
| 1.9 | VPS provisioning script (deps for any new VPS) | **Done** | Medium | `scripts/provision-vps.sh` (Node 20, PM2, nginx, Chrome, browser libs, ufw) |
| 1.10 | Migrate deployment to Docker + docker-compose | Pending | Low | Future — see issue #24. Current PM2 setup works |

## Part 2 — Chrome Extension

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 2.1 | Publish extension to Chrome Web Store | Pending | High | Update `ENDPOINTS.*` to prod URLs first; store listing copy drafted |
| 2.2 | Generate logo (icon + branding) | Pending | High | — |
| 2.3 | Prepare Kleinanzeigen profile (testing/demo) | Pending | Medium | — |
| 2.4 | In-page actions on Kleinanzeigen (content scripts) | Pending | Medium | PR #25 (reply-template injection on Nachrichten + per-ad buttons on Meine Anzeigen, behind `FEATURES.*` flags) was **closed without merging** — not landed, needs a decision on whether to revisit or abandon. |
| 2.5 | Facebook Marketplace repost (POC) | Pending | Low | PR #26 (flag-gated `FACEBOOK_MARKETPLACE_REPOST` POC) was **closed without merging** — not landed. See [docs/POC-facebook-marketplace-repost.md](POC-facebook-marketplace-repost.md) for the design if revisited. |

## Part 3 — Frontend & UX

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 3.1 | Add pagination for ads synchronization | **Done** | Medium | Client-side, 12/page (commit 047f917f) |
| 3.2 | Better loading spinner during sync | Pending | Medium | Small corner spinner exists; this is a polish pass |
| 3.3 | Apply official logo to frontend header, landing & favicon | **Done** | Low | Extracted the icon mark from `docs/assets/branding/anzeigenboost_logo_final.svg` into a reusable `BrandMark` component (frontend/src/components/BrandMark.tsx) placed next to the existing text wordmark in `TopBar` & `Landing` (keeps i18n/dark-mode text control instead of baking in a flat-color SVG wordmark). `favicon.svg` updated to the same arrow mark on the brand-green rounded square. |
| 3.4 | „Nur aktive Anzeigen" filter / hide-deleted toggle | **Done** | Low | Deleted ads were already always hidden. Added a "Nur aktive Anzeigen" toggle button on the Ads page (`frontend/src/pages/Ads.tsx`) that additionally hides reserved/paused listings, filtering on the existing `listingState` field. |

## Part 4 — Documentation & Monetization

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 4.1 | Document AI credits/limits per plan (free/starter/pro) | **Done** | High | Documented in [docs/AI_AND_MONETIZATION.md](AI_AND_MONETIZATION.md) |
| 4.2 | Document which AI models are used | **Done** | High | Documented in [docs/AI_AND_MONETIZATION.md](AI_AND_MONETIZATION.md) |
| 4.3 | Document payment setup (Stripe/PayPal) | **Done (flag-gated)** | High | Stripe billing merged (as `feat/monetization-stripe`, superseding the earlier unmerged PR #27) behind `BILLING_ENABLED`: checkout/portal/webhook → `users/{id}.tier`. Verified end-to-end locally with a real Stripe test-mode purchase (checkout session → test card → webhook → tier applied). Dormant in production until real Stripe keys + price IDs are configured there. Separately, the pay-as-you-go credits wallet (`ENABLE_CREDITS`) is also merged and was verified the same way (test purchase → webhook → balance updated). |
| 4.4 | Define monetization strategy (pricing, upgrade prompts, limits) | **In Progress** | High | Tiers/prompts wired (Settings "Dein Plan", flag-gated). AI + template limits enforce via `tier`. Still pending: validate €4.99/€9.99 pricing; the per-plan `maxAutoRepostAds` cap is NOT built (confirmed — no such field/check exists in the scheduler yet). |
| 4.5 | Generate Firestore schema reference (`docs/firestore-schema.md`) | Pending | Medium | Explore every Firestore read/write; document all collections/subcollections (`meta`, `sessions`, `users/{id}`, `users/{id}/ads/{adId}`, `aiUsage`, `handshakes`, `loginJobs`, repostLogs, notifications, schedulerMeta/runs). Per doc type: every field (name, type, required/optional, description) inferred from code. TS interface + plain-language table. Flag inconsistent/optional/mixed-type fields. Note: `ads` now has `listingState` (active/reserved/paused/deleted) + repost-lifecycle `status`. |

## Part 5 — Epic: POST-SMARTER (Posting Tips & AI Photo Feedback)

> Teach users HOW to sell better (guides, photo feedback, pricing) to drive free → paid conversion.

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 5.1 | Category-specific posting guides (furniture, electronics, clothing…) | **Deferred** | Medium | Static tips = commodity (ChatGPT can do it); POC built + removed |
| 5.2 | AI photo feedback (analyze photos, suggest improvements) | **Deferred** | Medium | Photo-quality coaching is the only non-redundant slice; revisit if users ask |
| 5.3 | Pricing recommendations from similar sold items | **Deferred** | Medium | Redundant with existing `suggestPrice` |
| 5.4 | "Why upgrade to Pro?" educational prompts in dashboard | **Deferred** | Medium | Marketing prompt; revisit post-launch |

> **Epic deferred:** most of POST-SMARTER overlaps existing features (AI generation, KI-Opt, suggestPrice). Critiquing AI-generated ads is circular; the only genuinely new slice is photo-quality coaching — revisit only if users request it.

## Part 7 — Epic: Repost via Delete + Re-create

> KA removed free bumping; deleted ads are unrecoverable (confirmed by testing).
> The only free repost = scrape original data → delete → re-create with photo re-upload.
> Full design + constraints + captured selectors in [docs/REPOST-DELETE-RECREATE.md](REPOST-DELETE-RECREATE.md).

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 7.1 | Phase 0 — Firebase Storage + snapshot schema | **Superseded — not needed** | High | The plan was to pre-snapshot photos to Storage. What actually got built instead: `extension/src/background/repost-engine.ts`'s `fetchOriginalAdData` scrapes the original ad's live data (incl. photo URLs) fresh at repost time — no storage layer needed. |
| 7.2 | Phase 1 — Snapshot + full-size photo backup | **Done (different approach)** | High | `fetchOriginalAdData` + `downloadPhoto`/`uploadPhotos` in `repost-engine.ts` scrape and re-upload photos directly at repost time, achieving the same goal without a separate backup step. |
| 7.3 | Phase 2 — Re-create from snapshot (fill form + re-upload photos + category picker) | **Done** | High | `executeRepostFullFlow` in `repost-engine.ts`: category picker (`setCategory`), dynamic attributes, photo upload, price/shipping/title fill, submit — all implemented and this is the repost mechanism in production use today (both scheduled and manual reposts). |
| 7.4 | Phase 3 — Wire delete↔recreate with verify guards + new-adId migration | **Done** | High | `executeRepostFullFlow` deletes the old ad only `AFTER_PUBLISH` (default), i.e. only once the new listing is confirmed live — never deletes without a successful re-create first. |

> This epic is done, just via a leaner technical path than originally planned
> (scrape-at-repost-time instead of a persistent Storage snapshot). Still true:
> fragile against KA form redesigns, ban-risk if reposted too frequently.

## Part 6 — Security & Anti-Ban

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 6.1 | IP proxy rotation to prevent bans (automation) | **Deferred** | Medium | Not needed at low volume; per-user sticky German residential IPs when bans appear (see issue #22) |
| 6.2 | Manual testing of main features before production | Pending | High | Test scenarios reviewed earlier in dev; needs a formal pass |
