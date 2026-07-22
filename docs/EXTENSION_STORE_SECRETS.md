# Cross-Browser Extension Publishing — Secrets Setup

Every secret below is only needed for `.github/workflows/deploy-extension.yml`
(Chrome). Firefox and Edge stay manual submissions in this pass (see
[`FIREFOX_ADDON_SUBMISSION.md`](FIREFOX_ADDON_SUBMISSION.md) and
[`EDGE_STORE_LISTING.md`](EDGE_STORE_LISTING.md) for why) — no new secrets
needed for them.

All secrets go to: **GitHub repo → Settings → Secrets and variables →
Actions → New repository secret**.

| Variable | Used for | Where to get it | Workflow |
|---|---|---|---|
| `CHROME_EXTENSION_ID` | Identifies which Chrome Web Store item to upload/publish to | Chrome Web Store Developer Dashboard, your item's URL (`.../detail/<this-id>`) | `deploy-extension.yml` |
| `CHROME_CLIENT_ID` | OAuth2 client ID for the Chrome Web Store API | Google Cloud Console, OAuth client credentials | `deploy-extension.yml` |
| `CHROME_CLIENT_SECRET` | OAuth2 client secret, paired with the client ID above | Google Cloud Console, same OAuth client | `deploy-extension.yml` |
| `CHROME_REFRESH_TOKEN` | Long-lived token the workflow exchanges for a short-lived access token on every run | Generated once via a one-time OAuth consent flow (steps below) | `deploy-extension.yml` |

Already-existing secrets in the repo (used by other workflows, not touched by
this work): `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_TOKEN`, `VPS_HOST`,
`VPS_USER`, `VPS_SSH_KEY`.

## Step-by-step: getting the four Chrome secrets

### 1. `CHROME_EXTENSION_ID`

1. Go to https://chrome.google.com/webstore/devconsole and sign in with the
   Google account that owns (or will own) the AnzeigenBoost listing.
2. If the extension isn't published yet, click **New Item**, upload the zip
   from `npm run build && npm run package:zip` once by hand to create the
   listing (this first upload has to be manual — the API can only update an
   *existing* item, not create one).
3. Open the item. The ID is the string in the dashboard URL right after
   `/detail/`, e.g. `https://chrome.google.com/webstore/devconsole/.../abcdefghijklmnopabcdefghijklmnop`.
   Copy that string.
4. GitHub → repo → **Settings → Secrets and variables → Actions → New
   repository secret** → Name: `CHROME_EXTENSION_ID` → Value: paste it → **Add secret**.

### 2. `CHROME_CLIENT_ID` and `CHROME_CLIENT_SECRET`

1. Go to https://console.cloud.google.com/ and either select an existing
   project or create a new one (top-left project dropdown → **New Project**
   → name it e.g. "AnzeigenBoost Extension Publish").
2. In the left sidebar: **APIs & Services → Library**. Search for
   "Chrome Web Store API" and click **Enable**.
3. **APIs & Services → OAuth consent screen**. Choose **External**, fill in
   the required app name/support email fields, and add your own Google
   account under **Test users** (this app never goes through Google's
   verification review since only you use it — "Testing" publish status is
   fine and stays that way indefinitely for personal-use OAuth clients).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Desktop app**.
   - Name it anything, e.g. "extension-publish-cli".
5. After creation, a dialog shows the **Client ID** and **Client secret** —
   copy both immediately (the secret won't be shown in full again, though you
   can regenerate it later from the same Credentials page if you lose it).
6. GitHub → **Settings → Secrets and variables → Actions**:
   - New secret `CHROME_CLIENT_ID` → paste the Client ID.
   - New secret `CHROME_CLIENT_SECRET` → paste the Client secret.

### 3. `CHROME_REFRESH_TOKEN`

This is the fiddly one — it's a one-time manual OAuth flow you run on your
own machine to mint a token the workflow can reuse forever (until revoked).

1. Build the consent URL by substituting your `CHROME_CLIENT_ID` from step 2
   into this template, then open it in a browser:
   ```
   https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/chromewebstore&response_type=code&access_type=offline&prompt=consent
   ```
2. Sign in with the same Google account that owns the Chrome Web Store item,
   approve the consent screen. Google will show you an authorization
   **code** on the page (the `urn:ietf:wg:oauth:2.0:oob` redirect displays it
   directly instead of redirecting to a URL, since this is a CLI-style app).
3. Copy that code, then run this in a terminal (replace the three
   placeholders — client id/secret from step 2, code from step above):
   ```bash
   curl -s -X POST https://oauth2.googleapis.com/token \
     -d client_id=YOUR_CLIENT_ID \
     -d client_secret=YOUR_CLIENT_SECRET \
     -d code=YOUR_AUTH_CODE \
     -d grant_type=authorization_code \
     -d redirect_uri=urn:ietf:wg:oauth:2.0:oob
   ```
4. The JSON response includes a `"refresh_token"` field — copy its value
   (a long string starting with `1//`).
5. GitHub → **Settings → Secrets and variables → Actions → New repository
   secret** → Name: `CHROME_REFRESH_TOKEN` → Value: paste it → **Add secret**.

Once all four secrets exist, `deploy-extension.yml` can be run via **Actions
tab → Build & Deploy Chrome Extension → Run workflow**.

## The manual approval gate — one more setting required

The workflow's `publish` job is gated behind a GitHub Environment named
`publish-to-chrome-web-store`, but the environment itself and its required
reviewers have to be configured once in the UI (this can't be done through
the workflow file):

1. GitHub → repo → **Settings → Environments → New environment**.
2. Name it exactly `publish-to-chrome-web-store` (must match the
   `environment:` value in `deploy-extension.yml`).
3. Under **Deployment protection rules**, check **Required reviewers** and
   add yourself (and anyone else who should be able to approve a live
   publish).
4. Save.

With this configured: triggering the workflow runs `build-and-upload`
(builds, tags a release, uploads a draft to the Chrome Web Store — nothing
public yet), then the `publish` job pauses with a "Review deployments"
banner in the Actions run until an approved reviewer clicks **Approve and
deploy**. Only then does the actual publish call fire.

## Order of manual steps to finish this

1. Create the Chrome Web Store listing once by hand (if not already done) —
   needed before `CHROME_EXTENSION_ID` exists.
2. Set up the Google Cloud OAuth client → get `CHROME_CLIENT_ID` /
   `CHROME_CLIENT_SECRET`.
3. Run the one-time OAuth consent flow → get `CHROME_REFRESH_TOKEN`.
4. Add all four secrets in GitHub repo settings.
5. Create the `publish-to-chrome-web-store` GitHub Environment with required
   reviewers.
6. Test the pipeline: **Actions → Build & Deploy Chrome Extension → Run
   workflow**, confirm it stops at the approval gate, approve it, confirm it
   publishes.
7. For Firefox/Edge: submit manually via addons.mozilla.org and Microsoft
   Partner Center using the zips from `npm run package:zip:firefox` /
   `npm run package:zip:edge`, and the listing copy in
   `CHROME_STORE_LISTING.md` (directly reusable for both).
