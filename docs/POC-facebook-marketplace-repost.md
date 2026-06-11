# POC: Facebook Marketplace Repost / "Neu stellen"

**Status:** Exploration (feature flag `FEATURES.FACEBOOK_MARKETPLACE_REPOST`, default **OFF**)
**Branch:** `poc/facebook-marketplace-repost`

## Goal
Offer the same "push my listing back to the top" value on Facebook Marketplace
that AnzeigenBoost already gives on Kleinanzeigen.

## Why this is hard (honest assessment)
- **No public API.** Facebook has no listing API for private/individual sellers.
  Everything must be done by driving the page DOM from a content script.
- **Hostile, volatile DOM.** Marketplace is React with obfuscated, hash-like
  class names (`x1n2onr6`, …) and **localized** ARIA labels. Selectors break
  whenever FB ships UI changes — which is often. This is the #1 maintenance cost
  seen across every FB-automation extension.
- **Anti-spam / ban risk.** Rapid create/delete/renew is exactly what FB's spam
  systems watch for. Aggressive automation → checkpoints, listing removal, or
  account bans. Any feature here must stay **strictly user-initiated, one
  listing at a time, with a conservative cooldown**.
- **Photos.** A normal web page cannot re-attach photos to a file input
  (`.files` is read-only). A **content script can** (construct a `DataTransfer`),
  but that only matters for full delete-and-relist, not for native renew.

## Approach — lowest risk first

### Tier 1 (this POC) — automate FB's *own* renew control
Many listings expose a native **"Renew" / "Erneut anbieten" / "Wieder
verfügbar"** action. Tier 1 simply finds that control and one-clicks it on the
user's behalf. We create/delete nothing, so the ban surface is minimal — we're
just saving clicks.

Implemented in `extension/src/content/facebook-marketplace.ts`:
- Detects the `/marketplace/you|selling` page.
- Finds each listing card via `a[href*="/marketplace/item/<id>"]`.
- Looks for a native renew control by localized accessible text.
- Injects a "🔄 Neu stellen" button (FB-blue outline) per card.
- **24h per-listing cooldown** + confirm dialog before acting.

### Tier 2 (future, NOT in POC) — delete-and-relist
For listings FB won't renew, recreate the listing (with photo re-attach via
`DataTransfer`). Higher ban risk, more brittle, separate flag. Out of scope here.

## Open questions to validate against the live DOM
1. Does the "Renew" control reliably exist for active listings, or only for
   expired ones? (Logged to console when the flag is on.)
2. Are the `a[href*="/marketplace/item/"]` + card selectors stable enough?
3. What is FB's real tolerance — how often can a user renew before a checkpoint?
4. Localization: confirm the German labels ("Erneut anbieten", etc.).

## How to test
1. Set `FACEBOOK_MARKETPLACE_REPOST: true` in `extension/src/config/features.ts`.
2. `npm run build` in `extension/`, load `dist/` unpacked.
3. Open `facebook.com/marketplace/you/selling`, open the console.
4. Confirm the POC log appears and the button is injected on listing cards.
5. Inspect a real listing's renew control; paste its `outerHTML` back to refine
   `findRenewControl()` selectors.

## Recommendation
Ship Tier 1 only if validation shows the native renew control is common and
FB tolerates user-paced clicks. Treat Tier 2 (delete-and-relist) as a separate,
explicitly-consented, heavily-rate-limited feature — or not at all. The durable
differentiator remains Kleinanzeigen, where the DOM is stable and the platform
is more tolerant.
