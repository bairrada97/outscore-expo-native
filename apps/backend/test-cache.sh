#!/bin/bash

# Simple script to test cache sources without overwhelming output
# Usage: ./test-cache.sh [date] [timezone]

BASE_URL="https://outscore-api.outscore.workers.dev"
USER_AGENT="CacheTester/1.0"

# Parse arguments
DATE="${1:-}"
TIMEZONE="${2:-UTC}"

# Build URL
if [ -z "$DATE" ]; then
  URL="$BASE_URL/fixtures?timezone=$TIMEZONE"
  echo "🧪 Testing: Today's fixtures (timezone: $TIMEZONE)"
else
  URL="$BASE_URL/fixtures?date=$DATE&timezone=$TIMEZONE"
  echo "🧪 Testing: Date $DATE (timezone: $TIMEZONE)"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Make request and capture response
RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" -H "User-Agent: $USER_AGENT" "$URL")

# Extract parts
HTTP_CODE=$(echo "$RESPONSE" | tail -n 2 | head -n 1)
RESPONSE_TIME=$(echo "$RESPONSE" | tail -n 1)
JSON_BODY=$(echo "$RESPONSE" | sed '$d' | sed '$d')

# Parse JSON (using grep/sed as fallback if jq not available)
if command -v jq &> /dev/null; then
  SOURCE=$(echo "$JSON_BODY" | jq -r '.source // "unknown"')
  STATUS=$(echo "$JSON_BODY" | jq -r '.status // "unknown"')
  DATE_RESP=$(echo "$JSON_BODY" | jq -r '.date // "unknown"')
  MATCH_COUNT=$(echo "$JSON_BODY" | jq -r '.matchCount.filtered // 0')
  ORIGINAL_COUNT=$(echo "$JSON_BODY" | jq -r '.matchCount.original // 0')
else
  # Fallback parsing without jq
  SOURCE=$(echo "$JSON_BODY" | grep -o '"source":"[^"]*"' | cut -d'"' -f4)
  STATUS=$(echo "$JSON_BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  DATE_RESP=$(echo "$JSON_BODY" | grep -o '"date":"[^"]*"' | cut -d'"' -f4)
  MATCH_COUNT=$(echo "$JSON_BODY" | grep -o '"filtered":[0-9]*' | cut -d':' -f2)
  ORIGINAL_COUNT=$(echo "$JSON_BODY" | grep -o '"original":[0-9]*' | cut -d':' -f2)
fi

# Display results
echo ""
if [ "$STATUS" = "success" ]; then
  echo "✅ Status: $STATUS"
else
  echo "❌ Status: $STATUS"
  echo "Error: $(echo "$JSON_BODY" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Cache Source: $SOURCE"
echo "📅 Date: $DATE_RESP"
echo "🌍 Timezone: $TIMEZONE"
echo "⚽ Matches: $MATCH_COUNT (filtered) / $ORIGINAL_COUNT (original)"
# Convert response time to milliseconds
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME" | awk '{printf "%.0f", $1 * 1000}')
echo "⏱️  Response Time: ${RESPONSE_TIME_MS}ms"
echo "🔢 HTTP Status: $HTTP_CODE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Color code the source
case "$SOURCE" in
  "Edge"|"Edge Cache")
    echo "💚 Edge Cache - Fastest! (<100ms expected)"
    ;;
  "KV")
    echo "💙 KV Cache - Fast (~10-20ms expected)"
    ;;
  "R2")
    echo "💛 R2 Cache - Moderate (~50-100ms expected)"
    ;;
  "API")
    echo "🔴 External API - Slowest (200-500ms expected)"
    echo "   (This is normal for first request or cache miss)"
    ;;
  "Stale Cache")
    echo "🟡 Stale Cache - Fallback data"
    ;;
  *)
    echo "❓ Unknown source: $SOURCE"
    ;;
esac

echo ""

