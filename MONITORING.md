# Production Monitoring

Why this exists, and what it actually catches.

## The incident this is responding to

On **2026-07-15 at 23:28 UTC**, the `feat/monetization-stripe` merge deployed
to production. The backend crash-looped on startup (`TypeError:
stripe_1.default is not a constructor` — missing `esModuleInterop` in
`backend/tsconfig.json` broke the Stripe SDK's CommonJS/ESM interop), and
separately `backend/package-lock.json` was missing the linux-x64 binary for
`sharp`, which would have broken image processing even once the Stripe issue
was fixed.

The deploy workflow's health check **did fail** on that deploy, and on every
subsequent deploy attempt for the next 6.5 days — that part worked. But a
failed GitHub Actions run with nobody watching it is silent in practice. The
backend stayed down, returning `502` from nginx, from **2026-07-15 23:28 UTC
until 2026-07-22 11:01 UTC**, when PR #61 (the `esModuleInterop` fix) finally
deployed successfully. That's the gap this setup closes — not "detect the
failure" (that already worked), but "make the failure impossible to miss,
and self-heal automatically where possible."

## Part 1 — Post-deploy health check gate (`deploy-backend.yml`)

Already existed in a basic form (curl + retry loop). What changed:

- **Automatic rollback.** Before touching anything, the deploy script now
  records the current commit SHA and backs up the current `backend/dist/`
  on the VPS. If the health check fails after the new deploy, a rollback
  step automatically resets to that commit, restores the backed-up `dist/`
  (fast — no rebuild needed), restarts PM2, and re-runs the health check to
  confirm the rollback actually worked. **This alone would have turned the
  6.5-day outage into a ~2-minute one** — the very first failed deploy
  (2026-07-15 23:28 UTC) would have rolled itself back to the last commit
  that was live 3 minutes earlier (PR #53, which deployed and passed health
  checks at 23:25 UTC), instead of leaving the broken build running.
- **Concurrency guard.** A `concurrency: group: backend-deploy` block
  prevents two deploys from racing and stomping each other's rollback
  point — this is a real, observed failure mode elsewhere in this repo (see
  the frontend deploy race between PRs #64/#65/#59 on 2026-07-23).
- **Loud failure summary.** Every failure path writes a `$GITHUB_STEP_SUMMARY`
  block with manual rollback commands, so even if auto-rollback itself can't
  recover (e.g. the very first deploy ever, with no rollback point yet), the
  next person to look at the run has exact copy-pasteable recovery steps.

## Part 2 — Scheduled uptime check (`uptime-check.yml`)

The deploy gate only checks health immediately after a deploy. It would
**not** have caught, say, the VPS running out of disk, PM2 crash-looping
hours after a clean deploy, or an expired cert — anything that breaks
production between deploys. This workflow runs on a 5-minute cron,
independent of any deploy, checking BOTH `https://api.anzeigenboost.de/api/health`
(backend) and `https://anzeigenboost.de` (frontend dashboard) via the same
`scripts/health-check.sh`.

Alerts are **transition-only** — one message when a service goes down, one
when it recovers, never a repeat "still down" every 5 minutes during an
ongoing outage. State (`up`/`down` per service) lives in
`.github/uptime-state.json`, committed back to `main` only when a status
actually changes, so the workflow is silent (zero commits) during normal
operation.

**Recommendation: also set up a real third-party monitor (UptimeRobot).**
This GitHub Actions workflow is a good zero-signup baseline, but it has one
structural weakness the incident already exposed: it depends on you actually
noticing a failed GitHub Actions run, which is the same channel that failed
silently for 6.5 days. A dedicated uptime monitor is worth the 5-minute
signup because:

- It alerts through channels independent of GitHub entirely (email, SMS,
  push notification, or its own Slack/Discord integration).
- Free tier (UptimeRobot) covers 50 monitors at 5-minute intervals — more
  than enough for one health endpoint.
- It's purpose-built for "tell me the second this goes down," which is
  exactly the gap that mattered here — GitHub Actions cron is a fine
  fallback, but it's not what it's designed for.

**Setup (5 minutes, optional but recommended):**
1. Sign up free at https://uptimerobot.com.
2. Add a new **HTTP(s)** monitor, URL `https://api.anzeigenboost.de/api/health`,
   interval 5 minutes.
3. Add your email (and optionally SMS/push) as an alert contact.

If you'd rather not sign up anywhere new, the GitHub Actions workflow above
covers the same ground without any external account.

## Part 3 — Slack alerting

Two independent alert sources, both posting to the same Slack channel:

1. **Deploy/publish failures** — every deploy/publish workflow
   (`deploy-backend`, `deploy-frontend`, `deploy-automation`, and both jobs
   of `deploy-extension`) posts on failure via the reusable
   `.github/actions/notify-slack-failure` composite action. Message includes
   the workflow name, which step failed, the branch/commit, and a direct
   link to the failed run. `deploy.yml` (the older, disabled, manual-only
   pipeline superseded by the four above) is intentionally not wired up.
2. **Uptime transitions** — `uptime-check.yml` (Part 2 above) posts once on
   down, once on recovery, for backend and frontend independently.

Both reuse the **same** `SLACK_WEBHOOK_URL` repo secret — deliberately a
**new, dedicated channel** (e.g. `#deploys` or `#alerts`), not the existing
`ALERT_WEBHOOK_URL` used by the backend's AI-cost/credit-refund monitoring
(`backend/src/common/admin-alert.util.ts`,
`backend/src/monitoring/credit-monitor.service.ts`). That channel is
business/cost alerting and has been noisy enough during testing to bury
things in it — deploy and uptime alerts need to be reliably seen, so they
get their own quiet channel instead of competing with that noise. If you'd
rather consolidate, you can always point `SLACK_WEBHOOK_URL` at the same
webhook as `ALERT_WEBHOOK_URL` later — nothing about this wiring assumes a
dedicated channel, it's just the recommendation.

### Setting up `SLACK_WEBHOOK_URL` (one-time, ~5 minutes)

1. In Slack, create the target channel first if it doesn't exist yet (e.g.
   `#deploys`).
2. Go to https://api.slack.com/apps → **Create New App** → **From scratch**.
   Name it something like "AnzeigenBoost Alerts", pick your workspace.
3. In the app's settings sidebar: **Incoming Webhooks** → toggle **Activate
   Incoming Webhooks** to on.
4. Click **Add New Webhook to Workspace**, pick the `#deploys` channel you
   created, **Allow**.
5. Copy the generated Webhook URL (`https://hooks.slack.com/services/...`).
6. GitHub → repo → **Settings → Secrets and variables → Actions → New
   repository secret** → Name: `SLACK_WEBHOOK_URL` → Value: paste it → **Add
   secret**.

That's it — no code change needed, every alert step already reads this
secret and is a safe no-op (with a logged skip message) until it exists.

Also still worth having as a baseline, independent of Slack: **GitHub's own
failed-workflow-run notification** — works today with zero setup, as long as
your GitHub notification settings actually deliver Actions failures to you
(Settings → Notifications → Actions). Worth double-checking this is on,
since the fact that the original outage didn't get noticed for 6.5 days
suggests either it wasn't enabled or the email got lost in volume.

**My actual recommendation**: set up `SLACK_WEBHOOK_URL` (5 minutes, covers
both deploy failures and uptime transitions) *and* consider UptimeRobot on
top of it for the uptime piece specifically — UptimeRobot's alerting runs
entirely outside GitHub/Slack, so it's the one layer that survives if GitHub
Actions itself has an outage or the Slack webhook silently breaks.

## Manual rollback (if automatic rollback can't recover)

```bash
ssh <VPS_USER>@<VPS_HOST>
cd /root/kleinanzeigen-boost
cat /root/.anzeigenboost-last-good-sha   # commit that was last healthy
git reset --hard "$(cat /root/.anzeigenboost-last-good-sha)"
cd backend && npm ci && npm run build
pm2 restart anzeigenboost-api --update-env && pm2 save
curl -fsS https://api.anzeigenboost.de/api/health
```
