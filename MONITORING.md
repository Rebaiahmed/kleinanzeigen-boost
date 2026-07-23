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
independent of any deploy, hitting the same `/api/health` endpoint via the
same `scripts/health-check.sh`.

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

## Part 3 — Notification

Two layers, in order of effort:

1. **GitHub's own failed-workflow-run notification** — works today with zero
   setup, as long as your GitHub notification settings actually deliver
   Actions failures to you (Settings → Notifications → Actions). Worth
   double-checking this is on, since the fact that it didn't get noticed for
   6.5 days suggests either it wasn't enabled or the email got lost in
   volume.
2. **Slack/Discord webhook** (optional, already wired up in
   `uptime-check.yml`) — add a repo secret named `SLACK_WEBHOOK_URL` or
   `DISCORD_WEBHOOK_URL` (Settings → Secrets and variables → Actions → New
   repository secret) and the scheduled check will post directly to that
   channel on failure. Safe no-op until you add one — nothing breaks if you
   skip this.

**My actual recommendation**, given what already failed silently once:
don't rely on GitHub notifications alone. Either set up UptimeRobot (its
alerting is independent of GitHub and purpose-built for this), or at minimum
add a Slack/Discord webhook secret so a failure posts somewhere you actually
look. Ideally both — they cover different gaps (UptimeRobot catches
between-deploy downtime from outside GitHub entirely; the webhook makes
in-repo failures, like a bad deploy, impossible to miss).

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
