# STEP 1: 403 Forbidden Diagnosis — Current Status

## Critical Finding: Automation Service Currently DISABLED

**The scheduler is NOT actually calling the repost automation service.** (See `backend/src/scheduler/scheduler.service.ts` lines 360-362)

```typescript
// TEMPORARY: Automation service is broken, so skip it and notify instead.
// result = await this.automationService.callAutomationWorker('repost', { userId, adId, adData, cookies });
const result = { success: true };  // Fake success — no actual repost
```

This is a **temporary workaround**. The real repost automation is commented out because it fails with 403.

---

## What We Know

### 1. Where the 403 Occurs
The 403 error happens when the **Playwright headless browser** (running on the server) tries to interact with Kleinanzeigen pages:
- Session check at `https://www.kleinanzeigen.de/m-meine-anzeigen.html`
- Edit page at `https://www.kleinanzeigen.de/m-anzeige-bearbeiten.html?adId=...`
- Create page at `https://www.kleinanzeigen.de/p-anzeige-aufgeben.html`

### 2. Possible Root Causes (to be tested)
- **Bot Detection / Headless Browser Block** — Kleinanzeigen detects headless Playwright and blocks it
- **Missing CSRF Token / Security Header** — The headless browser doesn't send a required anti-CSRF token
- **Invalid/Expired Session Cookies** — The transferred cookies are stale or improperly formatted
- **IP-Based Blocking** — The server's IP is flagged as suspicious (repeated requests, automation patterns)
- **User-Agent Mismatch** — Playwright's default User-Agent is detected as non-browser

---

## Diagnostic Logging Added

Enhanced the `automation/src/repost.ts` with comprehensive logging to capture:
- ✅ HTTP response status codes (200, 403, 401, etc.)
- ✅ Response body first 500 chars (to identify 403 page type)
- ✅ Current page URL after each navigation
- ✅ Cookie names injected into the browser context
- ✅ Whether bot detection interstitial is shown
- ✅ Form field population success/failure

**Log prefix:** All new logs use `[repost]` tag for easy filtering.

---

## NEXT STEP: Trigger a Manual Repost to Collect Logs

### To Enable the Diagnostic:

1. **Uncomment the automation service call** in `backend/src/scheduler/scheduler.service.ts` line 361:
   ```typescript
   // Change from:
   const result = { success: true };
   // To:
   const result = await this.automationService.callAutomationWorker('repost', { userId, adId, adData, cookies });
   ```

2. **Deploy updated code**:
   ```bash
   git add backend automation docs
   git commit -m "STEP 1: Add 403 diagnostic logging to repost automation"
   git push
   # Then trigger a deploy on your VPS
   ```

3. **Trigger a manual repost via API**:
   ```bash
   # Assuming you have an ad ID and authentication token:
   curl -X POST https://api.anzeigenboost.de/api/ads/{adId}/repost \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json"
   ```

4. **Check automation worker logs**:
   ```bash
   ssh root@178.105.216.147
   # Check recent logs for [repost] prefix:
   pm2 logs anzeigenboost-automation | grep "\[repost\]"
   ```

### What to Look For in Logs:
- Line with `[repost] session_check:` — what HTTP status at session_check?
- Line with `403` — which URL returned 403?
- Line with `Response body (first 500 chars):` — what's on the 403 page?
- Line with `Page body (first 600 chars):` — page content after error

---

## Classification Logic (for reference)

The error classifier (`backend/src/common/repost-error.util.ts`) will map the error message to a code:
- `403_FORBIDDEN` → **New code** (needs to be added to the classifier once we see it)
- `SESSION_EXPIRED` → Cookies are stale/invalid
- `IP_BLOCKED` → Page shows "ungewöhnliche Aktivität" or rate-limit text
- `CAPTCHA_DETECTED` → Captcha iframe present
- `TIMEOUT` → Navigation took too long

---

## Acceptance Criteria for STEP 1

We have collected sufficient diagnostics to determine:
1. ✅ Which HTTP status the 403 returns
2. ✅ What the response body/page contains (login form? block page? captcha?)
3. ✅ Whether the issue is bot detection, expired session, or missing CSRF token
4. ✅ Which repost step fails first

Once the logs are captured, we'll know exactly what to fix.

---

## Timeline

- **Now:** Code is ready with diagnostics enabled
- **Next:** Deploy and trigger a manual repost
- **Then:** Analyze logs and identify root cause
- **Finally:** Build STEP 2 (hybrid architecture) on a working repost foundation
