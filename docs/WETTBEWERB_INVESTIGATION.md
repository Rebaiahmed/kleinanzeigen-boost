# Wettbewerb (Competitor Tracker) — Pre-Launch Investigation

Investigation date: see git log for this file's introducing commit.
Flag: `FEATURE_WETTBEWERB_ENABLED` (backend `.env`), default `false` — **left OFF**, not changed by this investigation.

The code already lives on `main` (no separate unmerged branch) — the earlier plan referenced `feature/wettbewerb-tab`, but that work has already been merged.

## Checklist vs. original spec

| Item | Status | Notes |
|---|---|---|
| Search form: keyword + PLZ + radius + Prüfintervall | ✅ Fully built | `frontend/src/components/wettbewerb/SearchForm.tsx` |
| Radius dropdown = exact spec values `[0,5,10,20,30,50,100,150,200]` | ✅ Fully built | `frontend/src/config/wettbewerbConstants.ts` — matches byte-for-byte |
| Inline validation (empty keyword, invalid PLZ, generic-keyword warning) | ✅ Fully built | Real German-PLZ range validation (`isValidGermanPlzRange`), denylist of generic terms (sofa, tisch, auto, etc.) |
| "Wie funktioniert das?" guide modal, auto-opens first visit, ✕ + "Verstanden" | ✅ Fully built | `WettbewerbGuideModal.tsx` + auto-open logic in `Wettbewerb.tsx` (waits for real `hasSeenWettbewerb`, not the placeholder default, to avoid reopening for returning users) |
| Usage pill ("X von Y kostenlosen Suchen genutzt") | ✅ Fully built | `Wettbewerb.tsx:71` |
| Saved search card: keyword/PLZ/radius/interval tag + last-checked timestamp | ✅ Fully built | `SavedSearchCard.tsx`, relative-time formatter |
| Verdict box: rank badge + price **range** with reasoning, CTA tied to repost engine | ✅ Fully built | `priceRangeLow/High` + separate `suggestedPriceLow/High` (not a single number); "Preis übernehmen" and "Jetzt neu inserieren" buttons call `applySuggestedPrice`/`triggerRepost` → real `adsService.repostAd()` |
| Competitor table: top 5, own row highlighted, real off-podium rank | ✅ Fully built | `topCompetitors` capped at 5, `isOwn` → green row + "DU" badge; if user's ad ranks >5, real rank shown as separate text, never faked into the top-5 list (see `matchOwnAds()` doc comment) |
| No charts/graphs | ✅ Confirmed | Table + badges + text only, no chart library imported anywhere in the Wettbewerb components |
| Empty-state card with credit-cost upsell copy | ✅ Fully built | `EmptyStateUpsellCard.tsx`, `first-time`/`quota-used` variants |
| Scheduled job per search, default 2 days, self-hosted Playwright | ✅ Fully built | Cron in `scheduler.service.ts:674` (`*/30 * * * *`), calls `WettbewerbService.performCheck()` → `automationService.callAutomationWorker('scrape-search', ...)` → real Playwright scrape in `automation/src/wettbewerb-search.ts` against the live `kleinanzeigen.de/s-...` search page. **Not** a paid scraping API. |
| Credit deduction: 1 free, 5 credits/additional, real integration | ⚠️ **Was stubbed — fixed in this session** | See "Gap found & fixed" below |
| "🔔 Neue Konkurrenz erkannt" new-listing alert | ❌ **Not present at all** | Zero references anywhere in the codebase. Never built — planning/spec only, as suspected. |

## Gap found & fixed: credits was a hard-coded stub

`backend/src/wettbewerb/wettbewerb-credits.stub.ts` (now deleted) always threw `501 CREDITS_NOT_AVAILABLE` for any 2nd+ saved search — its own comment explained this was a placeholder until `feature/credits-stripe` merged. **That branch has since merged** (a real `CreditsService` with `.reserve()`/`.confirm()`/`.refund()` already exists at `backend/src/credits/credits.service.ts` and is used by `ai.service.ts` and `scheduler.service.ts`) — but nobody went back and did the Wettbewerb swap. Net effect before this fix: **every user was hard-capped at exactly 1 saved search, permanently**, regardless of credit balance.

Fixed in this session:
- Added `competitor_tracking: 5` to `CREDIT_COSTS` (`backend/src/config/credit-costs.constants.ts`)
- `WettbewerbModule` now imports `CreditsModule` instead of providing the stub
- `WettbewerbService.createSavedSearch()` calls the real `creditsService.reserve(userId, 'competitor_tracking', ...)` for the 2nd+ search, then `confirm(true)` once the search doc write succeeds (or `confirm(false)` to refund if the write fails) — reservation pattern, not a plain deduct, so a crash between reserve and doc-write self-heals via `CreditsService.cleanupStaleReservations()` (already running on its own cron tick)
- `canCreateFreeSearch`/`markFreeSearchUsed` (plain Firestore bookkeeping, never needed a credits system) moved into `WettbewerbService` directly, unchanged behavior
- Stale TODO comments in `feature-flags.ts` and `wettbewerb.constants.ts` referencing the now-deleted stub updated

This was the only functional gap found. Everything else in the checklist above was already fully built.

## Staleness assessment

- **Not on a separate branch** — already merged into `main`. No "commits behind" to speak of; it's current by definition.
- **Credits integration**: was stale (built against a stub, real system landed later, swap never happened) — **now fixed**, see above.
- **Scraping vs. Kleinanzeigen's current site structure**: the scraper targets the public **search-results** page (`kleinanzeigen.de/s-{keyword}/k0l{plz}r{radius}`, selectors like `article.aditem[data-adid]`), which is a completely different page/DOM from the **category-picker/ad-creation form** that the recent category-taxonomy work (`kleinanzeigen-categories.json`) touched. Those two are unrelated Kleinanzeigen surfaces — the taxonomy work does not affect this scraper either way.
  **Caveat**: I cannot confirm from static code alone whether Kleinanzeigen's search-results DOM structure has drifted since the selectors were last verified — that requires a live test run. The scraper does fail safely if it has (`SCRAPE_MALFORMED_PAGE`, explicitly documented as "the intended failure mode, not a bug to silently paper over," which then flips the search to `status: 'error'` after 3 consecutive failures rather than looping silently) — but "fails safely" isn't the same as "confirmed still working." **Recommend a live smoke test against a real keyword/PLZ before enabling**, not just trusting the code review.

## Scraping load estimate

Formula, since I don't have live access to your production user count:

```
searches_per_check_cycle = (active_users_with_wettbewerb_enabled) × (avg_saved_searches_per_user)
scrapes_per_day ≈ searches_per_check_cycle × (24h / avg_check_interval_days_in_hours)
```

With the shipped defaults (2-day interval, 1 free search/user, so `avg_saved_searches_per_user` starts at ~1 for anyone who hasn't paid for more):

- **10 users** → ~10 searches → ~5 scrapes/day
- **50 users** → ~50 searches → ~25 scrapes/day
- **200 users** → ~200 searches → ~100 scrapes/day

Each scrape is one Playwright page load against Kleinanzeigen's public search page (anonymous, no login) via the same `AUTOMATION_WORKER_URL` worker that already handles repost automation. The code already has a **shared IP-block cooldown**: if Kleinanzeigen blocks the scraper's IP, `wettbewerb.service.ts` sets a global 15-minute pause (`meta/wettbewerbMeta.pausedUntil`) affecting all users' checks, not just the one that triggered it — so there's already a self-throttling safety net.

**To get your real current user count**: `GET /api/admin/users-usage` (admin-key-gated, `backend/src/admin/`) returns every user. I didn't query this myself — that's a live production data pull I'm not going to do without you explicitly asking for it run against prod.

At any user count under a few hundred, this is a small, incremental load next to the existing repost cron (which already runs every 15 minutes for every user with `autoRepost` on) — not a meaningful new burden on the automation worker. Worth re-checking this estimate once you have real adoption numbers post-launch.

## Soft-launch / per-user targeting

**Does not exist.** `FEATURE_WETTBEWERB_ENABLED` (and every other flag) is a single global boolean served identically to all users via `GET /api/config/feature-flags` (`backend/src/config/config.controller.ts`) — no allowlist, no percentage rollout, no per-user override anywhere in the codebase.

If you want a real soft launch (a handful of users first, not all-or-nothing), that's a small follow-up feature, not something this investigation built: e.g. an allowlist Firestore doc or user-doc field checked alongside the global flag. I did not build this since it wasn't in the bug-fix checklist and is a product decision (who's in the allowlist, how it's managed) — flagging it as a prerequisite if you want a real soft launch rather than a global flip.

## Recommendation

**Not yet safe to flip globally**, for one reason only: the credits gap (now fixed in this branch, needs review + merge) was a real, user-facing bug — every non-first search was permanently broken. With that fixed:

- Functionality: complete, matches spec, well-built (defensive error handling, atomic locking, no fake data).
- The only unbuilt spec item ("Neue Konkurrenz erkannt" alert) is a nice-to-have, not a blocker.
- Scraping load at realistic near-term user counts is small and self-throttling.
- **Before flipping globally**: (1) merge this credits fix, (2) do one live smoke-test scrape to confirm the DOM selectors still match Kleinanzeigen's current search-results page, (3) decide whether you want real soft-launch targeting built first, since it doesn't exist today and this is a good candidate for a staged rollout given it's untested against live traffic.
