# Repost via Delete + Re-create — Design & Build Plan

**Status:** Planned epic (decided 2026-06-11). High effort, fragile, ban-risk.

## Why this exists (the hard constraints we confirmed)
- Kleinanzeigen **removed free bumping**. The only "move to top" on an ad card is
  the **paid "Hochschieben" (€2.99)** (`#my-manageitems-bumpup-<adId>`).
- **Deleted ads are unrecoverable** — manual delete does NOT offer an
  "Erneut einstellen" with retained photos (confirmed by testing: after delete,
  KA redirects to `tab=PROJECTS` and the ad is gone). So a re-list approach is
  impossible.
- Therefore the only way to keep a **free** repost is: **snapshot the ad →
  delete it → create a brand-new ad from the snapshot (re-uploading photos)**.
- ⚠️ This is what competitor tools do. It is **fragile** (breaks on every KA form
  redesign), **ban-risk** if frequent, **loses the ad's age/stats/URL**, and
  **deletes real ads** — so it must be bulletproof.

## Current gaps in our data (why we must scrape live)
- **No Firebase Storage** configured in the backend yet → nowhere to store photos.
- Sync (`ads.service.importAds`) stores only the **first thumbnail URL**
  (`image = ad.adImage || ... || ad.pictureUrls?.[0]`). We do **not** keep all
  photo URLs, nor category id, price-type, location, or shipping. So the rebuild
  data must come from the **edit page at repost time**, not stored sync data.

## Known-good selectors (captured from live DOM)
- Ad card: `li[data-testid="ad-card"][data-adid="<adId>"]`
- Delete button (in card footer): `button` containing `<span>Löschen</span>` (svg `data-title="trashOutline"`)
- Delete confirm modal button: `#delete-celebration-sbmt` (text "Ja, Anzeige löschen")
- Edit page: `/p-anzeige-bearbeiten.html?adId=<adId>` (full form, pre-filled)
- Create page: `/p-anzeige-aufgeben.html`
- After delete redirect: `m-meine-anzeigen.html?actMsg=DEL_MSG&...&tab=PROJECTS`

## Create form selectors (captured from p-anzeige-aufgeben-schritt2.html)
- Ad type: `#ad-type-OFFER` / `#ad-type-WANTED` (name=`adType`, default OFFER)
- Title: `#ad-title` (name=`title`, maxlength 65). Blurring it auto-suggests category.
- Category: hidden `input[name="categoryId"]` + "Wähle deine Kategorie" link
  (`#ad-category-suggestions a`). React picker — hidden value alone won't register.
- Price: `#ad-price-amount` (name=`priceAmount`, max 8)
- Price type: hidden `input[name="priceType"]` (FIXED) + combobox `#ad-price-type`
- Description: `#ad-description` (name=`description`, max 4000)
- Photos: `input[type="file"][accept*="image"]` (multiple) → `setInputFiles` target
- PLZ/City/Name: `#ad-zip-code`, `#ad-city` (readonly), `#ad-name` (readonly) —
  AUTO-FILLED from the account, no handling needed
- Hidden: `input[name="locationId"]`, `_csrf`, `adId`, `posterType`, `trackingId`
- Submit: button containing `<span>Anzeige aufgeben</span>`
  (also "Entwurf speichern", "Vorschau")
- Edit page reuses this SAME form pre-filled → it's the snapshot source for fields.
- Open challenge: setting category on a fresh post (rely on title auto-suggest, or
  drive the picker modal — to be solved in debug mode).

## Still NEEDED (capture from live DOM before building)
- **Edit page** (`p-anzeige-bearbeiten.html?adId=X`): selectors for category,
  title, description, price + price-type (VB/Festpreis), location/PLZ, shipping,
  and the **photo gallery** (so we can read every image URL).
- **Create page** (`p-anzeige-aufgeben.html`): the **`<input type="file">`** for
  photos, title/description/price inputs, the **category picker** flow, and the
  final submit button ("Anzeige aufgeben").

## Build phases (safe-first)

### Phase 0 — Foundations
- Add Firebase **Storage** access to `firebase.service` (bucket getter).
- New Firestore: `users/{id}/ads/{adId}` gains `repostSnapshots` or a top-level
  `adBackups/{adId}` doc.

### Phase 1 — Snapshot + photo backup (NON-destructive; build & test first)
Worker step, run with a `dryRun` that **stops before deleting**:
1. Go to the edit page, scrape every field + **all photo URLs**.
2. Download each photo at full size (swap KA image URL `rule=$_2.JPG` → largest
   variant, e.g. `$_57.JPG`/`$_59.JPG`).
3. Upload photos to Firebase Storage; save a snapshot doc (fields + photo refs).
4. Return the snapshot for verification. ✅ deletes nothing.

### Phase 2 — Re-create from snapshot (test on a throwaway ad)
1. Open create form, fill from snapshot.
2. **Re-upload** the saved photos via `setInputFiles`.
3. Drive the category picker (hierarchical — the tricky part).
4. Submit; capture the **new adId** from the success URL/page.

### Phase 3 — Wire together with guards
`snapshot → assert snapshot complete (photos present!) → delete →
assert deleted → re-create → assert new ad live → update our DB (old id → new id,
move repostLogs/schedule, refresh dashboard)`.
**Hard rule:** never call delete unless the snapshot (with photos) succeeded.

## Safety rules (non-negotiable)
- No delete without a verified complete snapshot (photos downloaded + stored).
- One ad at a time, human-like delays, per-ad cooldown (already in scheduler).
- On any failed assertion: stop, log the step, surface a clear error; never leave
  a half state silently.
- Keep the snapshot/backup even on success (audit + recovery).

## Open risks
- KA form redesigns will break Phase 2 regularly (ongoing maintenance).
- Category mapping (name → KA hierarchical picker) is the hardest selector work.
- Frequent delete+create may trigger KA anti-spam → account bans.
- The backed-up photo is KA's hosted full-size JPG, not the seller's true original
  file (good enough to re-upload, but not byte-identical).
