# AnzeigenBoost — Roadmap & Task Tracker

Status legend: **Pending** · **In Progress** · **Done**
Priority: **High** · **Medium** · **Low**

> Notes flag what already exists in the codebase so work isn't duplicated.
> An importable version lives in [`roadmap.csv`](roadmap.csv).

---

## Part 1 — DevOps & Infrastructure

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 1.1 | Create VPS server + add credentials to GitHub Actions secrets | Pending | High | — |
| 1.2 | Buy domain (e.g. anzeigenboost.de) | Pending | High | Referenced in README + landing canonical/OG tags |
| 1.3 | Test GitHub Actions deployment workflow | Pending | High | Workflows exist: `.github/workflows/deploy-*.yml` — need a live run |
| 1.4 | Test Firebase deployment (frontend) | Pending | High | `deploy-frontend.yml` + `frontend/firebase.json` already configured |
| 1.5 | Test landing page deployment | Pending | High | Landing is the `/` route of the frontend SPA; ships with 1.4 |
| 1.6 | Deploy backend to VPS | Pending | High | `validateEnv` will block boot without prod secrets (JWT_SECRET, etc.) |
| 1.7 | Deploy frontend to Firebase | Pending | High | Set `VITE_API_URL` to the https backend before deploy |
| 1.8 | Command to clean up Firestore data (for testing) | **Done** | Medium | `npm run cleanup:firestore -- --user <id>` or `--all --yes` (works in real + mock mode) |

## Part 2 — Chrome Extension

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 2.1 | Publish extension to Chrome Web Store | Pending | High | Update `ENDPOINTS.*` to prod URLs first; store listing copy drafted |
| 2.2 | Generate logo (icon + branding) | Pending | High | — |
| 2.3 | Prepare Kleinanzeigen profile (testing/demo) | Pending | Medium | — |

## Part 3 — Frontend & UX

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 3.1 | Add pagination for ads synchronization | **Done** | Medium | Client-side, 12/page (commit 047f917f) |
| 3.2 | Better loading spinner during sync | Pending | Medium | Small corner spinner exists; this is a polish pass |

## Part 4 — Documentation & Monetization

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 4.1 | Document AI credits/limits per plan (free/starter/pro) | **Done** | High | Documented in [docs/AI_AND_MONETIZATION.md](docs/AI_AND_MONETIZATION.md) |
| 4.2 | Document which AI models are used | **Done** | High | Documented in [docs/AI_AND_MONETIZATION.md](docs/AI_AND_MONETIZATION.md) |
| 4.3 | Document payment setup (Stripe/PayPal) | **In Progress** | High | Decision + integration plan documented (Stripe recommended); not yet implemented |
| 4.4 | Define monetization strategy (pricing, upgrade prompts, limits) | **In Progress** | High | Proposed tiers/pricing/prompts documented; pricing not yet validated or wired to payment |

## Part 5 — Epic: POST-SMARTER (Posting Tips & AI Photo Feedback)

> Teach users HOW to sell better (guides, photo feedback, pricing) to drive free → paid conversion.

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 5.1 | Category-specific posting guides (furniture, electronics, clothing…) | **Deferred** | Medium | Static tips = commodity (ChatGPT can do it); POC built + removed |
| 5.2 | AI photo feedback (analyze photos, suggest improvements) | **Deferred** | Medium | Photo-quality coaching is the only non-redundant slice; revisit if users ask |
| 5.3 | Pricing recommendations from similar sold items | **Deferred** | Medium | Redundant with existing `suggestPrice` |
| 5.4 | "Why upgrade to Pro?" educational prompts in dashboard | **Deferred** | Medium | Marketing prompt; revisit post-launch |

> **Epic deferred:** most of POST-SMARTER overlaps existing features (AI generation, KI-Opt, suggestPrice). Critiquing AI-generated ads is circular; the only genuinely new slice is photo-quality coaching — revisit only if users request it.

## Part 6 — Security & Anti-Ban

| #   | Task | Status | Priority | Notes |
|-----|------|--------|----------|-------|
| 6.1 | IP proxy rotation to prevent bans (automation) | **Deferred** | Medium | Not needed at low volume; per-user sticky German residential IPs when bans appear (see issue #22) |
| 6.2 | Manual testing of main features before production | Pending | High | Test scenarios reviewed earlier in dev; needs a formal pass |
