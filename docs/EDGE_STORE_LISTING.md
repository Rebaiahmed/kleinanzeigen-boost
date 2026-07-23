# Microsoft Edge Add-ons Listing — AnzeigenBoost

Confirms the assumption: Edge is Chromium-based and, for this extension,
submission is genuinely just a repackage — same manifest, same code, same
MV3 implementation, no divergent manifest keys used anywhere in this
codebase (`externally_connectable`, the one Chrome/Edge-shared key that
Firefox lacks, IS supported by Edge). `npm run build && npm run
package:zip:edge` produces the submission zip.

## What's directly reusable from [`CHROME_STORE_LISTING.md`](CHROME_STORE_LISTING.md)

Checked the actual listing copy (name, short/detailed description, screenshot
captions, promo tile caption, privacy practices) for Chrome-specific wording —
**none found**. The user-facing copy never mentions "Chrome" or "Chrome Web
Store" anywhere; it's already store-neutral. Every field is directly
copy-pasteable into Microsoft Partner Center as-is:

- Name, short description, detailed description
- Category (Partner Center's closest equivalent to "Productivity")
- Screenshots + captions, promo tile
- Privacy policy URL (`https://anzeigenboost.de/datenschutz`)
- Support/homepage URL
- Permission justifications (storage/cookies/alarms/notifications/host_permissions)

Only two "Chrome Web Store" mentions exist anywhere in the repo, and both are
internal doc titles/code comments, not user-facing copy — no fix needed there
either, just noting for completeness: `docs/CHROME_STORE_LISTING.md`'s own
title, and a one-line code comment in `frontend/src/pages/Datenschutz.tsx`.

## What's Edge-specific / needs separate handling

- **Partner Center account & submission flow** is separate from the Chrome
  Web Store's — see the step-by-step credential setup in the main cross-browser
  publishing report for how to get access.
- **Certification questionnaire**: Partner Center asks a few extra questions
  Chrome's dashboard doesn't (e.g. explicit "does this extension use remote
  code" and "does this collect Microsoft account data" — answer per the same
  facts already documented in Chrome's privacy practices section: no remote
  code, no Microsoft-account-specific data collection).
- **Review timeline**: typically faster than Chrome's (often 1–3 business
  days vs. Chrome's up to a week+), but budget for at least one review pass
  either way before it's live.

## Not automated in this pass

Edge submission itself stays **manual** for now (no GitHub Actions
auto-publish to Partner Center) — see the cross-browser publishing report's
Part 3/4 for why (Partner Center's API requires an Azure AD app registration
+ tenant setup that's a meaningfully bigger one-time lift than Chrome's OAuth
flow, and this extension doesn't ship frequently enough yet to justify
automating a second store's publish pipeline before the Chrome one has even
been used once). Revisit if Edge submission cadence picks up.
