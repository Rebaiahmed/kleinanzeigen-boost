#!/bin/bash

# Set TEST_EMAIL and TEST_PASSWORD in your shell before running, e.g.:
#   TEST_EMAIL=you@example.com TEST_PASSWORD=yourpassword ./test_endpoints.sh
if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
  echo "Set TEST_EMAIL and TEST_PASSWORD env vars before running this script." >&2
  exit 1
fi

# 1. Login to get Cookie
echo "1. Logging in..."
curl -s -c cookie.txt -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"'"$TEST_EMAIL"'","password":"'"$TEST_PASSWORD"'"}' > /dev/null

echo "Got JWT Cookie."

# 2. Sync Ads to populate the database
echo -e "\n2. Syncing ads..."
SYNC_RES=$(curl -s -b cookie.txt -X POST http://localhost:3000/api/ads/sync)
AD_ID=$(echo $SYNC_RES | grep -o '"id":"[^"]*' | head -n 1 | grep -o '[^"]*$')

if [ -z "$AD_ID" ]; then
  echo "Sync failed or no ads returned!"
  echo "Response: $SYNC_RES"
  exit 1
fi
echo "Sync successful. Using Ad ID: $AD_ID"

# 3. Test Ads Actions
echo -e "\n3. Testing Activate Ad..."
curl -s -X POST http://localhost:3000/api/ads/activate/$AD_ID -b cookie.txt

echo -e "\n\n4. Testing Pause Ad..."
curl -s -X POST http://localhost:3000/api/ads/pause/$AD_ID -b cookie.txt

echo -e "\n\n5. Testing Reserve Toggle..."
curl -s -X POST http://localhost:3000/api/ads/reserve/$AD_ID -b cookie.txt

echo -e "\n\n6. Testing Auto-Repost Toggle..."
curl -s -X POST http://localhost:3000/api/ads/toggle-repost/$AD_ID -b cookie.txt

# 4. Test AI Endpoints
echo -e "\n\n7. Testing AI Price Check..."
curl -s -X POST http://localhost:3000/api/ai/price -H "Content-Type: application/json" -b cookie.txt -d '{"adId":"'"$AD_ID"'"}'

echo -e "\n\n8. Testing AI Optimize..."
curl -s -X POST http://localhost:3000/api/ai/optimize -H "Content-Type: application/json" -b cookie.txt -d '{"adId":"'"$AD_ID"'"}'

echo -e "\n\n9. Testing AI Schedule..."
curl -s -X POST http://localhost:3000/api/ai/schedule -H "Content-Type: application/json" -b cookie.txt -d '{"adId":"'"$AD_ID"'","interval":"daily"}'

# 5. Testing Delete
echo -e "\n\n10. Testing Delete Ad..."
curl -s -X POST http://localhost:3000/api/ads/delete/$AD_ID -b cookie.txt

echo -e "\n\nDone."
