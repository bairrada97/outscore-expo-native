# API Testing Guide

After deployment, you can test your API using the following endpoints. Replace `YOUR_WORKER_URL` with your actual Cloudflare Workers URL (e.g., `outscore-api.outscore.workers.dev`).

## ⚠️ Important: User-Agent Header Required

The API has bot protection enabled. **You must include a User-Agent header** in your requests, or they will be blocked with `{"error":"access_denied","message":"Access denied"}`.

**For curl requests, add the `-A` flag:**
```bash
curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  https://outscore-api.outscore.workers.dev/health
```

Or use the `-H` flag:
```bash
curl -H "User-Agent: MyApp/1.0" \
  https://outscore-api.outscore.workers.dev/health
```

## 🔍 Base URL

```
https://outscore-api.outscore.workers.dev
```

## 📋 Available Endpoints

### 1. Health Check
**GET** `/health`

Simple health check endpoint to verify the API is running.

```bash
curl -H "User-Agent: MyApp/1.0" https://outscore-api.outscore.workers.dev/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

### 2. Metrics
**GET** `/metrics`

Get API metrics and statistics.

```bash
curl -H "User-Agent: MyApp/1.0" https://outscore-api.outscore.workers.dev/metrics
```

**Expected Response:**
```json
{
  "status": "ok",
  "metrics": {
    // Metrics data
  }
}
```

---

### 3. Get Fixtures (Today's Matches)
**GET** `/fixtures`

Get today's fixtures in UTC timezone (default).

```bash
curl -H "User-Agent: MyApp/1.0" https://outscore-api.outscore.workers.dev/fixtures
```

**With timezone:**
```bash
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?timezone=Europe/Lisbon"
```

**Expected Response:**
```json
{
  "status": "success",
  "date": "2025-01-15",
  "timezone": "Europe/Lisbon",
  "source": "API",
  "matchCount": {
    "original": 150,
    "filtered": 145
  },
  "data": [
    {
      "country": "England",
      "leagues": [
        {
          "league": {
            "id": 39,
            "name": "Premier League",
            "country": "England",
            "logo": "https://...",
            "flag": "https://...",
            "season": 2024,
            "round": "Regular Season - 20"
          },
          "matches": [
            {
              "fixture": {
                "id": 123456,
                "referee": "John Smith",
                "timezone": "UTC",
                "date": "2025-01-15T15:00:00+00:00",
                "timestamp": 1736956800,
                "venue": {
                  "id": 123,
                  "name": "Old Trafford",
                  "city": "Manchester"
                },
                "status": {
                  "long": "Match Finished",
                  "short": "FT",
                  "elapsed": 90
                }
              },
              "teams": {
                "home": {
                  "id": 33,
                  "name": "Manchester United",
                  "logo": "https://...",
                  "winner": true
                },
                "away": {
                  "id": 50,
                  "name": "Manchester City",
                  "logo": "https://...",
                  "winner": false
                }
              },
              "goals": {
                "home": 2,
                "away": 1
              },
              "score": {
                "fulltime": {
                  "home": 2,
                  "away": 1
                },
                "halftime": {
                  "home": 1,
                  "away": 0
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

### 4. Get Fixtures for Specific Date
**GET** `/fixtures?date=YYYY-MM-DD`

Get fixtures for a specific date. This is useful for:
- Historical matches (past dates)
- Future scheduled matches (upcoming dates)
- Specific dates in different timezones

**Basic Examples:**

```bash
# Get fixtures for January 15, 2025 (UTC timezone)
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?date=2025-01-15"

# Get fixtures for a specific date with timezone
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?date=2025-01-15&timezone=America/New_York"

# Get fixtures for tomorrow
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?date=2025-01-16"

# Get fixtures for yesterday
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?date=2025-01-14"
```

**More Examples:**

```bash
# Historical match (last week)
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?date=2025-01-08&timezone=Europe/Lisbon"

# Future match (next week)
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?date=2025-01-22&timezone=Asia/Tokyo"

# Specific date in different timezone
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?date=2025-01-20&timezone=America/Los_Angeles"
```

**Parameters:**
- `date` (optional): Date in `YYYY-MM-DD` format. If omitted, returns today's fixtures.
- `timezone` (optional): IANA timezone (e.g., `Europe/Lisbon`, `America/New_York`). Defaults to `UTC`.

**Note:** The date parameter accepts any valid date in `YYYY-MM-DD` format. You can query:
- **Past dates** - Historical matches
- **Today** - Current day's matches (or omit `date` parameter)
- **Future dates** - Upcoming scheduled matches

---

### 5. Get Live Fixtures
**GET** `/fixtures?live=all`

Get all currently live matches.

```bash
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?live=all"

# With timezone
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?live=all&timezone=Europe/Lisbon"
```

---

## 🔍 Quick Cache Source Testing

To quickly check cache sources without seeing all the match data, use the provided test script:

```bash
# Test today's fixtures (UTC)
cd apps/backend
./test-cache.sh

# Test today's fixtures (Lisbon timezone)
./test-cache.sh "" "Europe/Lisbon"

# Test specific date
./test-cache.sh "2025-01-15" "UTC"

# Test specific date with timezone
./test-cache.sh "2025-01-15" "America/New_York"
```

**Or use curl to extract just the source:**

```bash
# Get only the source from headers
curl -s -H "User-Agent: MyApp/1.0" \
  -H "Accept: application/json" \
  "https://outscore-api.outscore.workers.dev/fixtures" \
  | jq '{source: .source, date: .date, timezone: .timezone, matchCount: .matchCount}'

# Or check the X-Source header
curl -s -I -H "User-Agent: MyApp/1.0" \
  "https://outscore-api.outscore.workers.dev/fixtures" \
  | grep -i "x-source"
```

## 🧪 Example Test Commands

### Test 1: Health Check
```bash
curl -H "User-Agent: MyApp/1.0" https://outscore-api.outscore.workers.dev/health
```

### Test 2: Today's Fixtures (UTC)
```bash
curl -H "User-Agent: MyApp/1.0" https://outscore-api.outscore.workers.dev/fixtures
```

### Test 3: Today's Fixtures (Lisbon Timezone)
```bash
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?timezone=Europe/Lisbon"
```

### Test 4: Specific Date
```bash
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?date=2025-01-20&timezone=America/New_York"
```

### Test 5: Live Matches
```bash
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?live=all"
```

### Test 6: Pretty Print JSON (using jq)
```bash
curl -H "User-Agent: MyApp/1.0" "https://outscore-api.outscore.workers.dev/fixtures?timezone=Europe/Lisbon" | jq
```

---

## 📊 Response Headers

The API includes helpful headers:

- `X-Source`: Data source (`API`, `KV`, `R2`, `Edge`, `Stale Cache`)
- `X-Timezone`: Timezone used for the response
- `X-Response-Time`: Request processing time in milliseconds
- `Cache-Control`: Cache directives based on data type
- `X-RateLimit-Limit`: Rate limit (60 requests/minute)
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Seconds until rate limit resets

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Invalid timezone provided"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Not found"
}
```

### 429 Too Many Requests
```json
{
  "status": "error",
  "message": "API rate limit exceeded. Please try again later."
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

---

## 🔍 Testing Tips

1. **First Request**: The first request will be slower as it fetches from the external API and caches the data.

2. **Subsequent Requests**: Should be much faster (<50ms) as they're served from cache (Edge/KV/R2).

3. **Cache Sources**: Check the `X-Source` header to see where the data came from:
   - `Edge` - Fastest (<10ms) - Edge cache hit
   - `KV` - Fast (~10-20ms) - KV namespace hit
   - `R2` - Moderate (~50-100ms) - R2 bucket hit
   - `API` - Slowest (200-500ms) - External API call

4. **Rate Limiting**: The API limits `/fixtures` endpoints to 60 requests per minute per IP.

5. **Timezone Validation**: Only valid IANA timezones are accepted (e.g., `Europe/Lisbon`, `America/New_York`, `Asia/Tokyo`).

---

## 🚀 Quick Test Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="https://outscore-api.outscore.workers.dev"
USER_AGENT="MyApp/1.0"

echo "1. Health Check:"
curl -s -H "User-Agent: $USER_AGENT" "$BASE_URL/health" | jq
echo "\n"

echo "2. Today's Fixtures (UTC):"
curl -s -H "User-Agent: $USER_AGENT" "$BASE_URL/fixtures" | jq '.status, .source, .matchCount'
echo "\n"

echo "3. Today's Fixtures (Lisbon):"
curl -s -H "User-Agent: $USER_AGENT" "$BASE_URL/fixtures?timezone=Europe/Lisbon" | jq '.status, .source, .timezone, .matchCount'
echo "\n"

echo "4. Live Matches:"
curl -s -H "User-Agent: $USER_AGENT" "$BASE_URL/fixtures?live=all" | jq '.status, .source, .matchCount'
```

Make it executable and run:
```bash
chmod +x test-api.sh
./test-api.sh
```

