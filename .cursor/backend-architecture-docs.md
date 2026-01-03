# Outscore Backend Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Multi-Layer Caching Strategy](#multi-layer-caching-strategy)
5. [Module Structure](#module-structure)
6. [API Endpoints](#api-endpoints)
7. [Data Flow](#data-flow)
8. [Security](#security)
9. [Scheduled Tasks & Background Refresh](#scheduled-tasks--background-refresh)
10. [Quota Management](#quota-management)
11. [Data Transformation Pipeline](#data-transformation-pipeline)
12. [Date Transition Management](#date-transition-management)
13. [Cloudflare Configuration](#cloudflare-configuration)
14. [Metrics & Monitoring](#metrics--monitoring)

---

## Overview

The Outscore backend is a high-performance API built on **Cloudflare Workers** using the **Hono** framework. It serves football fixtures data with sub-50ms response times through an aggressive multi-layer caching strategy while minimizing third-party API calls.

### Key Design Goals

- **< 50ms response times** for cached requests
- **95%+ cache hit rate** to minimize API quota usage
- **Timezone-aware data delivery** - fixtures grouped by user's local date
- **Real-time updates** for live matches via 15-second background refresh
- **Atomic quota tracking** using Durable Objects to prevent race conditions

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Cloudflare Workers | Edge computing, global distribution |
| Framework | Hono | Lightweight, fast web framework |
| Caching (L1) | Cloudflare Cache API | Edge cache, fastest layer (<10ms) |
| Caching (L2) | Cloudflare KV | Hot data store (currently disabled due to 60s min TTL) |
| Caching (L3) | Cloudflare R2 | Cold storage, persistent cache |
| State | Durable Objects | Atomic counters, alarm scheduling |
| Validation | Zod | Request parameter validation |
| Date Handling | date-fns, date-fns-tz | Timezone transformations |
| External API | API-Football (RapidAPI) | Football fixtures data source |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT REQUEST                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE EDGE NETWORK                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Secure    │  │    CORS     │  │    Bot      │  │    Rate Limiter     │ │
│  │   Headers   │→ │  Middleware │→ │  Protection │→ │   (60 req/min)      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HONO APPLICATION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   /health          → Health check endpoint                                  │
│   /metrics         → Performance metrics                                    │
│   /fixtures        → Football fixtures (main endpoint)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-LAYER CACHE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 1: Edge Cache (Cache API)                           <10ms    │   │
│  │ • Stores transformed, timezone-specific responses                   │   │
│  │ • Key: fixtures:{date}:{timezone}:{live}                           │   │
│  │ • TTL: 15s (today), 1h (future), 24h (historical)                  │   │
│  │ • Stale-while-revalidate: 30s                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │ MISS                                         │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 2: KV (Currently Disabled)                          ~20ms    │   │
│  │ • Requires 60s min TTL (incompatible with 15s live updates)        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │ MISS                                         │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 3: R2 Storage (Cold Cache)                        ~50-100ms  │   │
│  │ • Stores raw UTC data (not timezone-transformed)                   │   │
│  │ • Folder structure: today/, historical/, future/                   │   │
│  │ • Key: {location}/fixtures-{date}.json                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │ MISS                                         │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 4: Third-Party API                               200-500ms   │   │
│  │ • API-Football via RapidAPI                                        │   │
│  │ • Daily limit: 70,000 calls                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DATA TRANSFORMATION                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Timezone Filtering → Filter fixtures for user's local date             │
│  2. Grouping          → Country → League → Matches                         │
│  3. Formatting        → Apply timezone to match times                      │
│  4. Sorting           → Countries, leagues, matches by name/time           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          JSON RESPONSE                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Layer Caching Strategy

### Layer 1: Edge Cache (Cloudflare Cache API)

The fastest cache layer, storing **transformed** responses per timezone.

```typescript
// Cache key format
const edgeCacheKey = `https://api.outscore.live/fixtures?date=${date}&timezone=${timezone}&live=${live}`;

// TTL Strategy
const edgeTTL = {
  today: 15,           // 15 seconds
  tomorrow: 15,        // 15 seconds (can change frequently)
  historical: 86400,   // 24 hours
  future: 3600,        // 1 hour
};
```

**Key Features:**
- Stores fully transformed `FormattedFixturesResponse` objects
- Timezone-specific caching (each timezone gets its own cache entry)
- Uses stale-while-revalidate (SWR) pattern for seamless updates

### Layer 2: KV Storage (Currently Disabled)

**Note:** KV is disabled because Cloudflare KV has a minimum TTL of 60 seconds, which is incompatible with the 15-second refresh interval for live data.

### Layer 3: R2 Storage (Cold Cache)

Persistent storage for raw UTC data with folder-based organization.

```typescript
// R2 folder structure
const r2Structure = {
  'today/': 'fixtures-2026-01-03.json',
  'historical/': 'fixtures-2026-01-02.json',
  'future/': 'fixtures-2026-01-04.json',
};
```

**Key Features:**
- Stores **raw UTC fixtures** (not timezone-transformed)
- Automatic date transitions move files between folders
- TTL enforced via custom metadata
- Live data files have `-live` suffix: `today/fixtures-2026-01-03-live.json`

### Cache Strategy Configuration

```typescript
// From cache-strategies.ts
const CACHE_STRATEGIES = {
  fixtures: {
    ttlMode: 'dynamic',
    dynamicTTL: (params) => getFixturesTTL(params.date, params.live === 'true'),
    swr: 30,           // Stale-while-revalidate: 30 seconds
    useKV: false,      // Disabled due to 60s min TTL
    useR2: true,
    useEdge: true,
  },
};
```

---

## Module Structure

```
apps/backend/
├── src/
│   ├── index.ts                      # Main entry point, Hono app setup
│   │
│   ├── modules/
│   │   ├── cache/
│   │   │   ├── index.ts              # Cache module exports
│   │   │   ├── cache-manager.ts      # Multi-layer cache coordinator
│   │   │   ├── cache-strategies.ts   # TTL and strategy configuration
│   │   │   ├── edge-cache.ts         # Cloudflare Cache API provider
│   │   │   ├── kv-provider.ts        # Cloudflare KV provider
│   │   │   ├── r2-provider.ts        # R2 storage provider
│   │   │   ├── fixtures-strategy.ts  # Fixtures-specific caching logic
│   │   │   ├── provider.interface.ts # Cache provider interface
│   │   │   └── types.ts              # Cache types and enums
│   │   │
│   │   ├── fixtures/
│   │   │   ├── index.ts              # Fixtures module exports
│   │   │   ├── fixtures.routes.ts    # Route handlers with Zod validation
│   │   │   ├── fixtures.service.ts   # Business logic for fetching fixtures
│   │   │   ├── utils.ts              # Filtering and formatting utilities
│   │   │   ├── timezone.utils.ts     # Timezone transformation helpers
│   │   │   └── date.utils.ts         # Date manipulation utilities
│   │   │
│   │   ├── scheduler/
│   │   │   ├── index.ts              # Scheduler exports
│   │   │   └── refresh-scheduler.ts  # Background refresh logic
│   │   │
│   │   ├── security/
│   │   │   ├── index.ts              # Security module exports
│   │   │   ├── rate-limiter.ts       # IP-based rate limiting
│   │   │   ├── cors.ts               # CORS configuration
│   │   │   ├── bot-protection.ts     # Bot/scraper blocking
│   │   │   └── secure-headers.ts     # Security headers (HSTS, CSP, etc.)
│   │   │
│   │   └── timezones/
│   │       ├── index.ts              # Timezone validation
│   │       └── timezones.json        # Valid timezone list
│   │
│   ├── pkg/
│   │   └── util/
│   │       └── football-api.ts       # Third-party API client
│   │
│   └── utils/
│       ├── index.ts                  # Utils exports
│       ├── metrics.ts                # Metrics and logging
│       ├── quota-manager.ts          # Quota tracking interface
│       ├── quota-durable-object.ts   # Atomic quota counter (DO)
│       └── refresh-scheduler-do.ts   # 15-second refresh scheduler (DO)
│
├── wrangler.toml                     # Cloudflare Workers config
├── package.json
└── tsconfig.json
```

---

## API Endpoints

### GET /health

Health check endpoint (bypasses security middleware).

```json
{
  "status": "ok",
  "timestamp": "2026-01-03T12:00:00.000Z"
}
```

### GET /metrics

Returns performance metrics for monitoring.

```json
{
  "status": "ok",
  "metrics": {
    "cache": {
      "edgeHits": 1250,
      "edgeMisses": 45,
      "r2Hits": 30,
      "r2Misses": 15,
      "apiCalls": 15,
      "hitRate": "96.52%"
    },
    "responseTimes": {
      "under10ms": 800,
      "under50ms": 400,
      "under100ms": 50,
      "p50Bucket": "<10ms"
    },
    "requests": {
      "total": 1300,
      "errors": 2,
      "errorRate": "0.15%"
    },
    "uptime": 3600000
  }
}
```

### GET /fixtures

Main endpoint for fetching football fixtures.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `date` | string | No | Today (UTC) | Date in YYYY-MM-DD format |
| `timezone` | string | No | `UTC` | IANA timezone (e.g., `Europe/Lisbon`) |
| `live` | `all` | No | - | Fetch live matches only |

**Example Request:**
```
GET /fixtures?date=2026-01-03&timezone=Europe/London
```

**Example Response:**
```json
{
  "status": "success",
  "date": "2026-01-03",
  "timezone": "Europe/London",
  "source": "Edge Cache",
  "matchCount": {
    "original": 847,
    "filtered": 423
  },
  "data": [
    {
      "name": "England",
      "flag": "https://media.api-sports.io/flags/gb.svg",
      "leagues": [
        {
          "id": 39,
          "name": "Premier League",
          "logo": "https://media.api-sports.io/football/leagues/39.png",
          "matches": [
            {
              "id": 1234567,
              "date": "2026-01-03",
              "time": "15:00",
              "timestamp": 1735916400,
              "timezone": "UTC",
              "status": {
                "short": "NS",
                "long": "Not Started",
                "elapsed": null
              },
              "teams": {
                "home": {
                  "id": 33,
                  "name": "Manchester United",
                  "logo": "https://media.api-sports.io/.../33.png",
                  "winner": null
                },
                "away": {
                  "id": 40,
                  "name": "Liverpool",
                  "logo": "https://media.api-sports.io/.../40.png",
                  "winner": null
                }
              },
              "goals": { "home": null, "away": null },
              "score": {
                "fulltime": { "home": null, "away": null },
                "penalty": { "home": null, "away": null }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Response Headers:**

| Header | Description |
|--------|-------------|
| `X-Source` | Cache layer that served the response (Edge Cache, KV, R2, API) |
| `X-Timezone` | Timezone used for transformation |
| `X-Response-Time` | Response time in milliseconds |
| `Cache-Control` | Browser cache hints |
| `X-RateLimit-*` | Rate limiting information |

---

## Data Flow

### Request Flow for Fixtures

```
1. Request arrives at Cloudflare Edge
   └─▶ Security middleware stack (headers, CORS, bot protection, rate limiting)

2. Route handler validates query parameters
   └─▶ Zod schema validates date, timezone, live params

3. Check for date transitions
   └─▶ Move files between R2 folders if UTC date changed

4. Check Edge Cache
   └─▶ HIT: Return transformed response immediately
   └─▶ MISS: Continue to next layer

5. Determine dates to fetch based on timezone
   └─▶ Non-UTC timezones may need adjacent days
   └─▶ Example: Tokyo (UTC+9) at 2 AM needs previous UTC day

6. For each required date:
   └─▶ Check R2 for raw UTC data
   └─▶ MISS: Fetch from third-party API
   └─▶ Cache raw data in R2 (non-blocking)

7. Combine and transform fixtures
   └─▶ Filter by user's local date
   └─▶ Group by Country → League → Matches
   └─▶ Format times to user's timezone
   └─▶ Sort alphabetically and by time

8. Cache transformed response in Edge Cache
   └─▶ Non-blocking via ctx.waitUntil()

9. Return JSON response with metadata
```

### Request Deduplication

The cache manager implements request deduplication to prevent duplicate API calls during concurrent requests:

```typescript
// From cache-manager.ts
const inFlightRequests = new Map<string, Promise<unknown>>();

export const withDeduplication = async <T>(
  cacheKey: string,
  fetchFn: () => Promise<T>
): Promise<T> => {
  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    console.log(`🔄 [Dedup] Reusing in-flight request for ${cacheKey}`);
    return existing as Promise<T>;
  }

  const promise = fetchFn().finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, promise);
  return promise;
};
```

---

## Security

### Middleware Stack

The security middleware is applied in this order:

1. **Secure Headers** - Adds security HTTP headers
2. **CORS** - Validates and sets CORS headers
3. **Bot Protection** - Blocks known bots and scrapers
4. **Rate Limiting** - IP-based request throttling

### Secure Headers

```typescript
// From secure-headers.ts
const headers = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

### CORS Configuration

```typescript
// Allowed origins (from environment or defaults)
const defaultOrigins = [
  'https://outscore.live',
  'https://www.outscore.live',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://10.0.2.2:3000', // Android emulator
];
```

### Bot Protection

```typescript
// Blocked patterns
const knownBotPatterns = [
  'bot', 'spider', 'crawl', 'scrape', 'headless',
  'selenium', 'phantomjs', 'puppeteer', 'semrush',
  'ahrefs', 'dotbot', 'bingbot', 'yandex', 'baidu',
  'python-requests', 'go-http-client', 'wget', 'curl',
];

// Also enforces:
// - Non-empty User-Agent
// - CF-Connecting-IP header when behind Cloudflare (production)
```

### Rate Limiting

```typescript
// Configuration
const rateLimitConfig = {
  limit: 60,           // Max requests
  windowSec: 60,       // Per minute
  skip: (ctx) => ctx.req.path === '/health', // Exclude health checks
};

// Response headers
'X-RateLimit-Limit': '60'
'X-RateLimit-Remaining': '45'
'X-RateLimit-Reset': '1735916460' // Unix timestamp

// When exceeded: 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 32
}
```

---

## Scheduled Tasks & Background Refresh

### Refresh Scheduler Durable Object

Cloudflare cron has a minimum interval of 1 minute, but live matches need 15-second updates. This is solved using a **Durable Object alarm chain**.

```typescript
// From refresh-scheduler-do.ts
const REFRESH_INTERVAL_MS = 15_000; // 15 seconds

class RefreshSchedulerDurableObject {
  async alarm(): Promise<void> {
    // 1. Refresh today's fixtures
    await refreshTodayFixtures(this.env);
    
    // 2. Schedule next alarm in 15 seconds
    await this.state.storage.setAlarm(Date.now() + REFRESH_INTERVAL_MS);
  }
}
```

### Cron Trigger (Failsafe)

A cron trigger runs every minute as a failsafe to ensure the DO alarm chain is running:

```toml
# wrangler.toml
[triggers]
crons = ["* * * * *"]  # Every minute
```

### Scheduled Tasks

| Task | Frequency | Description |
|------|-----------|-------------|
| `refreshTodayFixtures` | Every 15s | Fetches fresh data, updates Edge + R2 cache |
| `refreshLiveFixtures` | Every 15s | Updates live match data |
| `prefetchTomorrowFixtures` | Daily | Pre-warms cache for next day |
| `cleanupOldCacheData` | Daily (2 AM) | Deletes files older than 30 days |
| `checkFixturesDateTransition` | On request | Moves files between R2 folders at midnight UTC |

### Refresh Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    REFRESH SCHEDULER DO                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌─────────────┐                                             │
│   │ Alarm fires │                                             │
│   │ (every 15s) │                                             │
│   └──────┬──────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────────┐                                        │
│   │ Check date       │                                        │
│   │ transition       │                                        │
│   └────────┬─────────┘                                        │
│            │                                                   │
│            ▼                                                   │
│   ┌──────────────────┐                                        │
│   │ Fetch from       │                                        │
│   │ Football API     │                                        │
│   └────────┬─────────┘                                        │
│            │                                                   │
│            ▼                                                   │
│   ┌──────────────────┐                                        │
│   │ Store raw UTC    │                                        │
│   │ data in R2       │                                        │
│   └────────┬─────────┘                                        │
│            │                                                   │
│            ▼                                                   │
│   ┌──────────────────┐                                        │
│   │ Pre-generate     │   ┌────────────────────────────────┐  │
│   │ Edge responses   │──▶│ UTC, London, Lisbon, Paris,   │  │
│   │ for common TZs   │   │ Berlin, NYC, Tokyo, Sydney... │  │
│   └────────┬─────────┘   └────────────────────────────────┘  │
│            │                                                   │
│            ▼                                                   │
│   ┌──────────────────┐                                        │
│   │ Schedule next    │                                        │
│   │ alarm (+15s)     │                                        │
│   └──────────────────┘                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Quota Management

### Overview

The Football API has a daily limit of 70,000 calls. The quota is tracked atomically using a **Durable Object** to prevent race conditions under concurrent requests.

### Quota Durable Object

```typescript
// From quota-durable-object.ts
interface QuotaConfig {
  dailyLimit: number;      // 70,000
  hourlyLimit: number;     // 3,000
  alertThreshold: number;  // 0.8 (80%)
}

class QuotaDurableObject {
  async increment(): Promise<IncrementResponse> {
    // Atomically increment counters
    state.dailyCalls++;
    state.hourlyCalls++;
    
    return {
      allowed: dailyRemaining >= 0 && hourlyRemaining >= 0,
      dailyRemaining,
      hourlyRemaining,
      shouldAlert: dailyPercentage >= this.config.alertThreshold,
    };
  }
}
```

### Input Validation

The `/configure` endpoint validates configuration payloads:

```typescript
// Validation ranges
const CONFIG_VALIDATION = {
  dailyLimit: { min: 1, max: 10_000_000 },
  hourlyLimit: { min: 1, max: 1_000_000 },
  alertThreshold: { min: 0, max: 1 },
};

// Requirements:
// - Content-Type: application/json
// - All fields required (dailyLimit, hourlyLimit, alertThreshold)
// - Fields must be numbers
// - dailyLimit/hourlyLimit must be integers
// - hourlyLimit <= dailyLimit
// - No unknown keys allowed
```

### Usage Pattern

```typescript
// Recommended: Atomic check-and-reserve
const quotaManager = new QuotaManager(env.QUOTA_DO);
const result = await quotaManager.recordCall();

if (!result.allowed) {
  throw new Error('Quota exceeded');
}

// Proceed with API call
await getFootballApiFixtures(...);
```

---

## Data Transformation Pipeline

### Raw API Response → Formatted Response

```
┌─────────────────────────────────────────────────────────────┐
│ RAW API RESPONSE                                            │
│ {                                                           │
│   "response": [                                             │
│     { "fixture": {...}, "league": {...}, "teams": {...} }   │
│   ]                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: TIMEZONE FILTERING                                  │
│ filterFixturesByTimezone(fixtures, requestedDate, timezone) │
│ • Maps UTC timestamps to user's local date                  │
│ • Returns only fixtures matching the requested date         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: GROUPING & FORMATTING                               │
│ formatFixtures(fixtures, timezone)                          │
│ • Groups by Country → League → Match                        │
│ • Formats times to user's timezone (HH:mm)                  │
│ • Sorts countries/leagues alphabetically                    │
│ • Sorts matches by timestamp                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ FORMATTED RESPONSE                                          │
│ [                                                           │
│   {                                                         │
│     "name": "England",                                      │
│     "flag": "...",                                          │
│     "leagues": [                                            │
│       {                                                     │
│         "id": 39,                                           │
│         "name": "Premier League",                           │
│         "matches": [...]                                    │
│       }                                                     │
│     ]                                                       │
│   }                                                         │
│ ]                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Timezone Fetch Strategy

When the user's timezone differs from UTC, adjacent days may need to be fetched:

```typescript
// From timezone.utils.ts
const getDatesToFetch = (requestedDate, timezone, currentHour) => {
  // User is late in their day (ahead of UTC)
  if (currentHour >= 20) {
    return [yesterday, requestedDate]; // Need previous UTC day
  }
  
  // User is early in their day (behind UTC)
  if (currentHour <= 4) {
    return [requestedDate, tomorrow]; // Need next UTC day
  }
  
  // Safe zone: fetch all three to be safe
  return [yesterday, requestedDate, tomorrow];
};
```

---

## Date Transition Management

At midnight UTC, fixtures need to move between R2 folders:

### Folder Transitions

```
Before midnight (Jan 2):
  today/fixtures-2026-01-02.json
  future/fixtures-2026-01-03.json
  
After midnight (Jan 3):
  historical/fixtures-2026-01-02.json  ← Moved from today/
  today/fixtures-2026-01-03.json       ← Moved from future/
  future/fixtures-2026-01-04.json      ← New (fetched on request)
```

### Transition Process

```typescript
// From fixtures-strategy.ts
const handleFixturesDateTransition = async (env, oldDate, newDate) => {
  // 1. Move old "today" to "historical"
  await moveToHistorical(r2Provider, oldDate);
  
  // 2. Move "future" newDate to "today"
  await moveFromFuture(r2Provider, newDate);
  
  // 3. Ensure tomorrow is in "future"
  await ensureInFuture(r2Provider, tomorrow);
  
  // 4. Clean up duplicates
  await cleanupR2Duplicates(r2Bucket, oldDate, 'historical');
  await cleanupR2Duplicates(r2Bucket, newDate, 'today');
  
  // 5. Delete old KV entries
  await deleteKVEntriesForDate(kv, oldDate);
  
  // 6. Invalidate Edge Cache for affected dates
  await invalidateEdgeCacheForDate(oldDate, commonTimezones);
  await invalidateEdgeCacheForDate(newDate, commonTimezones);
};
```

### KV-Based State Tracking

```typescript
const DATE_TRANSITION_KEY = 'fixtures:date-transition:current-utc-date';

// On each request, check if date changed
const currentDate = getCurrentUtcDate();
const storedDate = await kv.get(DATE_TRANSITION_KEY);

if (storedDate !== currentDate) {
  await kv.put(DATE_TRANSITION_KEY, currentDate);
  await handleFixturesDateTransition(env, storedDate, currentDate);
}
```

---

## Cloudflare Configuration

### wrangler.toml

```toml
name = "outscore-api"
main = "src/index.ts"
compatibility_date = "2025-03-07"
compatibility_flags = ["nodejs_compat"]

# R2 bucket for storing match data (cold storage)
[[r2_buckets]]
binding = "FOOTBALL_CACHE"
bucket_name = "outscore-match-data"
preview_bucket_name = "outscore-match-data-dev"

# KV namespace for hot data
[[kv_namespaces]]
binding = "FOOTBALL_KV"
id = "bd0f2fadda52416db9ba5ce58974f6b4"
preview_id = "058faa4190274550bf7edabe699718f1"

# Durable Objects
[[durable_objects.bindings]]
name = "QUOTA_DO"
class_name = "QuotaDurableObject"

[[durable_objects.bindings]]
name = "REFRESH_SCHEDULER_DO"
class_name = "RefreshSchedulerDurableObject"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["QuotaDurableObject", "RefreshSchedulerDurableObject"]

# Environment variables
[vars]
FOOTBALL_API_URL = "https://api-football-v1.p.rapidapi.com/v3"

# Rate limiting
[[ratelimits]]
name = "OUTSCORE_RATE_LIMITER"
namespace_id = "1001"

[ratelimits.simple]
limit = 100
period = 60

# Cron triggers (failsafe for DO alarm chain)
[triggers]
crons = ["* * * * *"]

# Observability
[observability]
enabled = true
head_sampling_rate = 0.1
```

### Environment Bindings

| Binding | Type | Description |
|---------|------|-------------|
| `FOOTBALL_CACHE` | R2 Bucket | Cold storage for fixtures |
| `FOOTBALL_KV` | KV Namespace | Hot data, state tracking |
| `QUOTA_DO` | Durable Object | Atomic quota tracking |
| `REFRESH_SCHEDULER_DO` | Durable Object | 15-second refresh scheduling |
| `FOOTBALL_API_URL` | Env Var | Third-party API base URL |
| `RAPIDAPI_KEY` | Secret | API authentication key |
| `APPROVED_ORIGINS` | Env Var | Comma-separated CORS origins |

---

## Metrics & Monitoring

### Tracked Metrics

```typescript
interface CacheMetrics {
  edgeHits: number;
  edgeMisses: number;
  kvHits: number;
  kvMisses: number;
  r2Hits: number;
  r2Misses: number;
  apiCalls: number;
}

interface ResponseTimeBuckets {
  under10ms: number;
  under50ms: number;
  under100ms: number;
  under500ms: number;
  over500ms: number;
}
```

### Response Time Tracking

Every request is logged with its response time, grouped into latency buckets:

```typescript
const logRequest = (path, method, statusCode, durationMs, source) => {
  recordResponseTime(durationMs);
  
  if (statusCode >= 500) {
    recordError();
  }
  
  logEvent('request', {
    path,
    method,
    statusCode,
    durationMs,
    source,
  });
};
```

### Target Performance

| Metric | Target | Description |
|--------|--------|-------------|
| p50 Response Time | < 10ms | Edge cache hit |
| p95 Response Time | < 50ms | R2 cache hit |
| p99 Response Time | < 200ms | API fallback |
| Cache Hit Rate | > 95% | Edge + R2 combined |
| Error Rate | < 1% | 5xx responses |
| API Quota Usage | < 10% | ~6,000 calls/day |

---

## Summary

The Outscore backend is optimized for **speed** and **efficiency**:

1. **Multi-layer caching** ensures most requests are served from Edge Cache (<10ms)
2. **Request deduplication** prevents duplicate API calls under concurrent load
3. **15-second background refresh** via Durable Object alarms keeps data fresh
4. **Atomic quota tracking** prevents race conditions and quota overruns
5. **Timezone-aware transformations** deliver localized data to users
6. **Comprehensive security** protects against bots, abuse, and attacks

The architecture is designed to scale globally via Cloudflare's edge network while maintaining the 70,000 daily API call budget.

