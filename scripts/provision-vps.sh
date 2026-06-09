#!/usr/bin/env bash
#
# Provision a fresh Ubuntu/Debian VPS for AnzeigenBoost (backend + automation).
# Installs: Node 20, PM2, nginx, Google Chrome (for Playwright), browser libs, ufw.
# Idempotent — safe to re-run. Run as root:  bash provision-vps.sh
#
set -euo pipefail

echo "▶ Updating system…"
apt-get update -qq && apt-get upgrade -y -qq

echo "▶ Installing Node.js 20…"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "   node $(node -v), npm $(npm -v)"

echo "▶ Installing PM2…"
npm install -g pm2 >/dev/null 2>&1
pm2 -v

echo "▶ Installing nginx…"
apt-get install -y -qq nginx

echo "▶ Installing Google Chrome (Playwright uses it via CHROMIUM_PATH)…"
if ! command -v google-chrome-stable >/dev/null 2>&1; then
  wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb
  apt-get install -y -qq /tmp/chrome.deb
  rm -f /tmp/chrome.deb
fi
echo "   $(google-chrome-stable --version)"

echo "▶ Installing browser runtime libraries…"
apt-get install -y -qq \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2t64 libatspi2.0-0 fonts-liberation || true

echo "▶ Configuring firewall…"
ufw allow 22 >/dev/null 2>&1 || true
ufw allow 80 >/dev/null 2>&1 || true
ufw allow 443 >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true

echo ""
echo "✅ Provisioning complete. Next:"
echo "   1. git clone https://github.com/Rebaiahmed/kleinanzeigen-boost.git /root/kleinanzeigen-boost"
echo "   2. Create backend/.env  and  automation/.env  (see docs/DEPLOYMENT.md)"
echo "      automation/.env must set CHROMIUM_PATH=/usr/bin/google-chrome-stable"
echo "   3. Place backend/firebase-credentials.json"
echo "   4. Build + start both:"
echo "        cd /root/kleinanzeigen-boost/backend && npm ci && npm run build && pm2 start dist/main.js --name anzeigenboost-api"
echo "        cd ../automation && npm ci && npm run build && pm2 start dist/index.js --name anzeigenboost-automation"
echo "        pm2 save && pm2 startup"
echo "   5. nginx reverse proxy + certbot — see docs/DEPLOYMENT.md §4"
