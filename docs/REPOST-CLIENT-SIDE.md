# Client-Side Repost (Extension) — Design

**Decided 2026-06-12.** Move repost OUT of the server-side Playwright worker and
INTO the Chrome extension, so it runs in the user's own browser with their real
session + home IP. This is how working competitor tools (kleinanzeigen-tool,
kleinanzeigen-bot) do it, and it sidesteps every problem the server approach hit
(cookie copying, SESSION_EXPIRED, identity mismatch, datacenter-IP ban risk).

## Why client-side
| | Server worker (old) | Extension (new) |
|---|---|---|
| Auth | copy cookies → breaks | user's real logged-in session |
| IP | datacenter → ban risk | user's home IP |
| Photos | download + re-upload | re-attach in-browser |
| Reliability | brittle | what competitors actually use |

Trade-off: the user's browser must be open when a repost runs (acceptable — the
competitor tools have the same limitation).

## Architecture
- **Background service worker** = orchestrator + scheduler (alarms already exist).
  Holds the per-ad state machine (content scripts reset on navigation).
- **Content script on kleinanzeigen.de** = does each page's DOM action and reports
  back. One content script, re-injected on every page load; the background tells
  it which step to run based on the current URL.

### Repost state machine (background-driven)
```
START → open/define KA tab
 → navigate manage page → content script clicks Löschen → confirm (#delete-celebration-sbmt)
 → navigate post form → content script fills fields + uploads photos → submit
 → read new adId from success URL → report back → update our DB (old→new id)
```
Guard: capture the ad's data + photos BEFORE delete; never delete without it.

## ✅ BREAKTHROUGH (2026-06-12): photo upload solved via CDP
Page JS / content-script `input.files` is hard-blocked by KA (confirmed:
`DataTransfer before=1 → input.files after=0`, no preview). BUT the extension's
`chrome.debugger` API (CDP) `DOM.setFileInputFiles` **works** — a test photo
attached and KA showed the preview. This is the same mechanism Playwright and
kleinanzeigen-bot use. So the full client-side repost is viable:
- Photos: `chrome.debugger` + `DOM.setFileInputFiles` (needs the file on disk →
  `chrome.downloads` the ad's images silently into a dedicated folder).
- Auth: user's real session. IP: user's home IP → **no proxies/rotation needed**.
- Requires `debugger` + `downloads` permissions (shows a "being debugged" banner
  during the op — acceptable for an explicit repost).

### Real build plan (all hard unknowns now resolved)
1. Capture ad data + download its photos (silent `chrome.downloads`).
2. Fill the post form (title/price/description — proven) + set category.
3. Attach photos via CDP `DOM.setFileInputFiles` (proven).
4. Delete the old ad (card `li[data-adid]` → Löschen → `#delete-celebration-sbmt`).
5. Submit ("Anzeige aufgeben"); capture new adId; update our DB; clean temp files.
6. Background state machine orchestrates across page navigations; dashboard shows
   progress (spinner → "refresh when done").
Guard: never delete until photos are downloaded + the new ad is ready to submit.

## The make-or-break unknown → Milestone 1 (DONE — see breakthrough above)
**Can a content script attach a file to KA's `<input type="file">`?**
Technique (works from an extension content script's isolated world):
```js
const dt = new DataTransfer();
dt.items.add(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
```
Milestone 1 validates this with a **canvas-generated test image** (no network, no
CORS) on the real post form. If KA shows the preview → the whole approach is
viable. If not → we stop and rethink before building anything else.

## Photos (after Milestone 1 proves upload works)
- Fetch the ad's full-size images in the **background worker** (has host
  permission → no CORS), pass bytes to the content script, which builds `File`s
  and attaches them. (Content-script direct fetch of img.kleinanzeigen.de may hit
  CORS, so route through background.)

## Form selectors (captured, see REPOST-DELETE-RECREATE.md)
title `#ad-title` · price `#ad-price-amount` · priceType `input[name=priceType]` ·
description `#ad-description` · photos `input[type=file][accept*=image]` ·
submit button `span:has-text("Anzeige aufgeben")` · category = title auto-suggest
(hard part). Delete: card `li[data-adid]` → "Löschen" → confirm `#delete-celebration-sbmt`.

## Milestones
1. **Prove photo upload** (canvas test image + fill fields) — non-destructive. ← now
2. Fetch + attach the ad's real photos (background fetch → content script).
3. Drive category (title auto-suggest / picker).
4. Full delete → recreate state machine in the background, with guards + new-id update.
5. Loading UX in the dashboard (spinner → "refresh when done").
```
