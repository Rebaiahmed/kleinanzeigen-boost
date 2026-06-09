# Backend Deployment (VPS)

Automated on every push to `main` that touches `backend/**`, via
[`.github/workflows/deploy-backend.yml`](../.github/workflows/deploy-backend.yml).
Also runnable manually (Actions tab → "Deploy Backend to VPS" → Run workflow, or
the SSH commands below).

| Detail | Value |
|--------|-------|
| VPS IP | `178.105.216.147` |
| SSH user | `root` |
| Backend port | `3000` |
| Repo path on server | `/root/kleinanzeigen-boost` |
| PM2 process name | `anzeigenboost-api` |

---

## 1. Required GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `178.105.216.147` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | The **private** SSH key (full contents) authorized on the VPS |

**Generate a dedicated deploy key** (don't reuse a personal key) — locally:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f deploy_key -N ""
# Add the PUBLIC key to the server:
ssh-copy-id -i deploy_key.pub root@178.105.216.147
#   (or: cat deploy_key.pub | ssh root@178.105.216.147 'cat >> ~/.ssh/authorized_keys')
# Paste the PRIVATE key (deploy_key contents) into the VPS_SSH_KEY secret.
# Then delete the local copies: rm deploy_key deploy_key.pub
```

---

## 2. One-time server setup

> 💡 **Shortcut:** run [`scripts/provision-vps.sh`](../scripts/provision-vps.sh) on a
> fresh Ubuntu/Debian VPS to install Node 20, PM2, nginx, Google Chrome, the
> browser libraries, and the firewall in one go. Then do the clone + `.env` +
> build/start steps below.


```bash
ssh root@178.105.216.147

apt update && apt upgrade -y

# Node.js 20 + PM2 + nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx
npm install -g pm2

# Clone (HTTPS) into the path the workflow expects
cd /root
git clone https://github.com/Rebaiahmed/kleinanzeigen-boost.git
cd kleinanzeigen-boost/backend
npm ci

# Production .env — fill in real values (validateEnv refuses to boot without these)
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
JWT_SECRET=__generate_with: openssl rand -hex 64__
INTERNAL_SECRET=__generate_with: openssl rand -hex 32__
ADMIN_API_KEY=__generate_with: openssl rand -hex 24__
GEMINI_API_KEY=__your_AIza..._key__
OPENROUTER_API_KEY=__your_key__
AUTOMATION_WORKER_URL=https://__your_worker__
FIREBASE_PROJECT_ID=kleinanzeigen-app
FIREBASE_CLIENT_EMAIL=__your_firebase_client_email__
FIREBASE_PRIVATE_KEY="__your_firebase_private_key__"
MONETIZATION_ENABLED=false
EOF

# Build + start
npm run build
pm2 start dist/main.js --name anzeigenboost-api
pm2 save
pm2 startup    # run the command it prints, to survive reboots

# Firewall
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw allow 3000
ufw --force enable
```

> ⚠️ `JWT_SECRET` and `INTERNAL_SECRET` are **mandatory in production** — the app
> fails fast on startup if they're missing or set to the dev defaults.

---

## 2b. Automation worker (Playwright, port 3001)

Runs as a second PM2 process on the same VPS. Auto-deployed by
[`deploy-automation.yml`](../.github/workflows/deploy-automation.yml) on pushes to
`automation/**`. One-time setup:

```bash
cd /root/kleinanzeigen-boost/automation
npm ci
npx playwright install --with-deps chromium   # browser + system libs
# .env — must share INTERNAL_SECRET with the backend so they authenticate each other
cat > .env << 'EOF'
PORT=3001
INTERNAL_SECRET=__same_value_as_backend__
EOF
npm run build
pm2 start dist/index.js --name anzeigenboost-automation
pm2 save
```

The backend reaches it via `AUTOMATION_WORKER_URL` (e.g. `http://127.0.0.1:3001`
if same box, or an https URL if separate). Port 3001 should **not** be public —
keep it behind localhost/nginx.

## 3. Manual deploy (when not using the workflow)

```bash
ssh root@178.105.216.147 '
  set -e
  cd /root/kleinanzeigen-boost && git fetch origin main && git reset --hard origin/main
  cd backend && npm ci && npm run build
  pm2 restart anzeigenboost-api --update-env || pm2 start dist/main.js --name anzeigenboost-api
  pm2 save
'
```

The workflow uses `git reset --hard origin/main` (not `git pull`) so a drifted
server tree never blocks a deploy. `.env` and `dist/` are gitignored, so they're
preserved.

---

## 4. Nginx reverse proxy (optional — `https://api.anzeigenboost.de`)

```nginx
# /etc/nginx/sites-available/anzeigenboost-api
server {
    listen 80;
    server_name api.anzeigenboost.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/anzeigenboost-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# HTTPS via Let's Encrypt
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.anzeigenboost.de
```

Point the `api` DNS A record to `178.105.216.147` first. With nginx in front you
can close port 3000 in the firewall (`ufw delete allow 3000`) and set the
frontend's `VITE_API_URL` to `https://api.anzeigenboost.de/api`.

---

## 5. Verify

```bash
curl http://178.105.216.147:3000/api/health   # {"status":"ok","timestamp":"..."}
pm2 status                                     # anzeigenboost-api = online
pm2 logs anzeigenboost-api                      # tail logs
```

The deploy workflow runs the same `/api/health` check automatically and fails if
the backend doesn't come back up.
