#!/bin/bash
echo "1. Logging in via Playwright to grab fresh cookies..."
curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev_secret_key" \
  -d '{"email":"rebai.ahmed@outlook.com","password":"Vsv%SbqY8nGnJ4S"}' > login_response.json

echo "2. Extracting cookies..."
node -e "
const data = require('./login_response.json');
const fs = require('fs');
fs.writeFileSync('sync_payload.json', JSON.stringify({ cookies: data.cookies || [] }));
"

echo "3. Triggering Ad Sync Scraper..."
curl -s -X POST http://localhost:3001/sync \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev_secret_key" \
  -d @sync_payload.json
