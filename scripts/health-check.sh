#!/usr/bin/env bash
#
# Polls a health endpoint with retries, so a slow cold-start doesn't read as
# a real outage. Shared by the post-deploy gate (deploy-backend.yml) and the
# scheduled uptime monitor (uptime-check.yml) — one implementation, so a fix
# to the retry/backoff logic doesn't need to be made twice.
#
# Usage: health-check.sh <url> [max_attempts] [delay_seconds] [initial_delay_seconds]
# Exit 0 if a request ever returns HTTP 2xx, exit 1 if every attempt fails.
set -euo pipefail

URL="${1:?Usage: health-check.sh <url> [max_attempts] [delay_seconds] [initial_delay_seconds]}"
MAX_ATTEMPTS="${2:-6}"
DELAY="${3:-5}"
INITIAL_DELAY="${4:-5}"

echo "▶ Health-checking $URL (up to $MAX_ATTEMPTS attempts, ${DELAY}s apart, ${INITIAL_DELAY}s initial grace)…"
sleep "$INITIAL_DELAY"

for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  if RESPONSE=$(curl -fsS -m 10 "$URL" 2>&1); then
    echo "✅ Healthy on attempt $i/$MAX_ATTEMPTS: $RESPONSE"
    exit 0
  fi
  echo "Attempt $i/$MAX_ATTEMPTS failed: $RESPONSE"
  if [ "$i" -lt "$MAX_ATTEMPTS" ]; then
    sleep "$DELAY"
  fi
done

echo "❌ Health check failed after $MAX_ATTEMPTS attempts against $URL."
exit 1
