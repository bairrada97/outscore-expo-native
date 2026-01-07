# Backend Architecture Skill

## Overview
This skill provides comprehensive documentation of the Outscore backend architecture - a high-performance Cloudflare Workers-based API with multi-tier caching, timezone-aware data transformation, and sub-50ms response times.

## Core Architecture

### System Design
**Platform:** Cloudflare Workers (Edge Compute)
- V8 isolate runtime (not containers)
- Global edge network deployment
- Cold start: <1ms
- Request execution: 50ms (free tier), 50s (paid tier)

### Technology Stack

**Framework & Runtime:**
- **Hono v4.7.4** - Fast, lightweight web framework
- **TypeScript 5.8.2** - Strict type checking
- **ES2020** - Modern JavaScript features

**Storage & Caching:**
- **Cloudflare Cache API** - Edge caching (<10ms latency)
- **Cloudflare KV** - Key-value storage (10-20ms, disabled for fixtures)
- **Cloudflare R2** - Object storage (50-100ms, cold storage)
- **Durable Objects** - Atomic operations and sub-minute scheduling

**External APIs:**
- **Football API (RapidAPI)** - Match data provider

---

## Project Structure

### Directory Organization

```
apps/backend/
├── src/
│   ├── index.ts                     # Main Worker entry point
│   ├── modules/                     # Feature modules
│   │   ├── cache/                   # Multi-layer caching system
│   │   │   ├── cache-manager.ts     # Generic cache operations
│   │   │   ├── cache-strategies.ts  # TTL and caching strategies
│   │   │   ├── edge-cache.ts        # Edge Cache provider
│   │   │   ├── kv-provider.ts       # KV namespace provider
│   │   │   ├── r2-provider.ts       # R2 bucket provider
│   │   │   ├── fixtures-strategy.ts # Fixtures-specific caching
│   │   │   ├── atomic-transition.ts # Atomic date transition
│   │   │   ├── types.ts             # Cache type definitions
│   │   │   └── provider.interface.ts# Provider interface
│   │   ├── fixtures/                # Fixtures domain logic
│   │   │   ├── fixtures.routes.ts   # API route definitions
│   │   │   ├── fixtures.service.ts  # Business logic
│   │   │   ├── utils.ts             # Data transformation
│   │   │   ├── date.utils.ts        # Date handling
│   │   │   └── timezone.utils.ts    # Timezone logic
│   │   ├── scheduler/               # Background job scheduling
│   │   │   ├── refresh-scheduler.ts # 15-second refresh logic
│   │   │   └── index.ts
│   │   ├── security/                # Security middleware
│   │   │   ├── cors.ts              # CORS configuration
│   │   │   ├── rate-limiter.ts      # Rate limiting
│   │   │   ├── bot-protection.ts    # Bot detection
│   │   │   └── secure-headers.ts    # Security headers
│   │   └── timezones/               # Timezone utilities
│   │       └── index.ts
│   ├── utils/                       # Shared utilities
│   │   ├── quota-durable-object.ts  # Quota tracking DO
│   │   ├── refresh-scheduler-do.ts  # Scheduler DO
│   │   ├── quota-manager.ts         # Quota management
│   │   └── metrics.ts               # Metrics collection
│   └── pkg/util/                    # External API integration
│       └── football-api.ts          # Football API client
├── wrangler.toml                    # Cloudflare Workers configuration
├── package.json                     # Dependencies and scripts
└── tsconfig.json                    # TypeScript configuration
```

### Key Architectural Patterns

1. **Modular Domain-Driven Design** - Features organized into self-contained modules
2. **Middleware Pipeline** - Security → CORS → Bot Protection → Rate Limiting
3. **Provider Pattern** - Abstracted cache providers (Edge, KV, R2)
4. **Strategy Pattern** - Dynamic TTL and caching strategies per resource type
5. **Durable Objects** - Atomic operations and sub-minute scheduling
6. **Request Deduplication** - In-flight request tracking prevents duplicate API calls

---

## Caching System

### Three-Tier Cache Architecture

#### **Layer 1: Edge Cache (Fastest - <10ms)**
**Provider:** Cloudflare Cache API
**File:** [edge-cache.ts](../../../apps/backend/src/modules/cache/edge-cache.ts)

**Characteristics:**
- Stores timezone-transformed responses (not raw data)
- Response time: <10ms
- Distributed across Cloudflare's edge network
- Cache keys must be full URLs (Cache API requirement)
- TTL: 20 seconds (buffer over 15s scheduler)
- SWR: 0 seconds (no stale data for live matches)

**Usage:**
```typescript
// Edge Cache key format
https://api.outscore.live/fixtures?date=2026-01-06&timezone=America/New_York&live=true
```

#### **Layer 2: KV Store (Fast - 10-20ms)**
**Provider:** Cloudflare KV Namespace
**File:** [kv-provider.ts](../../../apps/backend/src/modules/cache/kv-provider.ts)

**Characteristics:**
- Stores raw UTC data (not timezone-transformed)
- **Currently DISABLED** for fixtures (60s min TTL conflicts with 15s refresh requirement)
- Still used for date transition state tracking
- 25MB value size limit
- Automatic expiration via `expirationTtl`

**Status:**
```typescript
// KV disabled for fixtures, but used for state tracking
const strategy = CACHE_STRATEGIES.fixtures;
const layers = strategy.layers; // ['edge', 'r2'] - KV excluded
```

#### **Layer 3: R2 Storage (Cold Storage - 50-100ms)**
**Provider:** Cloudflare R2 Object Storage
**File:** [r2-provider.ts](../../../apps/backend/src/modules/cache/r2-provider.ts)

**Characteristics:**
- Stores raw UTC data with folder structure
- Folder organization: `today/`, `historical/`, `future/`
- Key format: `{location}/fixtures-{date}.json` or `{location}/fixtures-{date}-live.json`
- No size limits, used for long-term storage
- TTL: 300 seconds (5 min staleness tolerance)

**Folder Structure:**
```
R2 Bucket: outscore-match-data/
├── today/
│   ├── fixtures-2026-01-06.json
│   └── fixtures-2026-01-06-live.json
├── historical/
│   └── fixtures-2026-01-05.json
└── future/
    └── fixtures-2026-01-07.json
```

### Cache Strategies

**File:** [cache-strategies.ts](../../../apps/backend/src/modules/cache/cache-strategies.ts)

**Resource Types and Configuration:**

| Resource | TTL Mode | TTL | Edge | KV | R2 | Use Case |
|----------|----------|-----|------|----|----|----------|
| fixtures | dynamic | 20s-24h | ✅ | ❌ | ✅ | Match data |
| fixtureDetail | dynamic | 15s-24h | ✅ | ❌ | ✅ | Single match |
| teams | static | 24h | ✅ | ❌ | ✅ | Team info |
| leagues | static | 24h | ✅ | ❌ | ✅ | League info |
| standings | static | 1h | ✅ | ❌ | ✅ | Standings |

**Dynamic TTL Logic:**

```typescript
// Fixtures TTL based on date
export const getFixturesTTL = (date: string, isLive: boolean): number => {
  if (isLive) return 20; // 20 seconds for live

  const today = getCurrentUtcDate();
  const yesterday = getYesterdayUtcDate();
  const tomorrow = getTomorrowUtcDate();

  // Hot data: frequent refresh
  if (date === today || date === yesterday || date === tomorrow) {
    return 20; // 20 seconds
  }

  // Historical: long-term caching
  if (date < yesterday) {
    return 86400; // 24 hours
  }

  // Future: standard caching
  return 3600; // 1 hour
};
```

### Cache Invalidation

**Date Transition Process:**
**File:** [fixtures-strategy.ts](../../../apps/backend/src/modules/cache/fixtures-strategy.ts)

```typescript
// Daily UTC midnight rollover
1. Move yesterday's data: today/ → historical/
2. Move today's data: future/ → today/
3. Ensure tomorrow is in future/
4. Clean up duplicates across all folders
5. Delete KV entries for old date
6. Invalidate Edge Cache for common timezones
```

**Atomic Operations:**
- Distributed lock pattern with idempotency keys
- Exponential backoff retry on transient failures
- Prevents duplicate transitions during concurrent requests

**Edge Cache Invalidation:**
```typescript
// Invalidate for all common timezones
const commonTimezones = [
  'UTC', 'America/New_York', 'Europe/London',
  'Europe/Lisbon', 'Asia/Tokyo', 'Australia/Sydney'
];

for (const timezone of commonTimezones) {
  const key = generateEdgeCacheKey({ date, timezone, live, baseUrl });
  await cache.delete(key);
}
```

### Request Deduplication

**File:** [cache-manager.ts](../../../apps/backend/src/modules/cache/cache-manager.ts)

```typescript
// Prevent duplicate API calls for same cache key
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

## API Routes & Endpoints

### Base URL
```
Production: https://outscore-api.outscore.workers.dev
Development: http://localhost:8787
```

### Middleware Pipeline

**Order:** Secure Headers → CORS → Bot Protection → Rate Limiting

1. **Secure Headers** - HSTS, X-Content-Type-Options, X-Frame-Options
2. **CORS** - Dynamic origin validation (production, development, Expo)
3. **Bot Protection** - User-agent validation, Cloudflare IP checks
4. **Rate Limiting** - 60 requests/minute per IP for `/fixtures*`

### Endpoints

#### **GET /health**
**Purpose:** Health check endpoint
**Middleware:** None (bypasses bot protection)

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-06T12:00:00.000Z"
}
```

#### **GET /metrics**
**Purpose:** API metrics and monitoring
**Middleware:** None (bypasses bot protection)

**Response:**
```json
{
  "cache": {
    "edgeHits": 1500,
    "kvHits": 0,
    "r2Hits": 50,
    "apiCalls": 200,
    "hitRate": "88.6%"
  },
  "responseTimes": {
    "under10ms": 1200,
    "under50ms": 300,
    "under100ms": 200,
    "under500ms": 50,
    "over500ms": 0,
    "p50Bucket": "<10ms"
  },
  "requests": {
    "total": 1750,
    "errors": 5,
    "errorRate": "0.3%"
  },
  "uptime": "3h 45m"
}
```

#### **GET /fixtures**
**Purpose:** Fetch football fixtures for a specific date
**File:** [fixtures.routes.ts](../../../apps/backend/src/modules/fixtures/fixtures.routes.ts)
**Service:** [fixtures.service.ts](../../../apps/backend/src/modules/fixtures/fixtures.service.ts)

**Query Parameters:**
- `date` (optional): `YYYY-MM-DD` format (defaults to today)
- `timezone` (optional): IANA timezone (defaults to UTC)
- `live` (optional): `"all"` for live matches only

**Validation:**
```typescript
// Zod schema validation
const fixturesQuerySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  timezone: z.string()
    .refine((tz) => isValidTimezone(tz), {
      message: 'Invalid timezone provided',
    })
    .default('UTC'),
  live: z.enum(['all']).optional(),
});
```

**Response:**
```json
{
  "status": "success",
  "date": "2026-01-06",
  "timezone": "Europe/Lisbon",
  "source": "Edge Cache",
  "matchCount": {
    "original": 150,
    "filtered": 145
  },
  "data": [
    {
      "name": "England",
      "flag": "https://...",
      "leagues": [
        {
          "id": 39,
          "name": "Premier League",
          "logo": "https://...",
          "matches": [...]
        }
      ]
    }
  ]
}
```

**Cache Headers:**
```
Cache-Control: public, max-age={TTL}, stale-while-revalidate={SWR}
X-Response-Time: 12ms
X-Source: Edge Cache
X-Timezone: Europe/Lisbon
```

**Error Response:**
```json
{
  "status": "error",
  "message": "API rate limit exceeded",
  "error": "Rate limit: 100 requests per day"
}
```

---

## Data Models & Types

### Shared Types Package
**Location:** `/packages/shared-types/`
**Main File:** [football-api.ts](../../../packages/shared-types/src/football-api.ts)

### Core Interfaces

**Raw API Response:**
```typescript
interface Fixture {
  fixture: {
    id: number;
    date: string;               // ISO 8601 (UTC)
    timestamp: number;          // Unix timestamp
    timezone: string;           // UTC
    status: {
      long: string;
      short: FixtureStatusShort;
      elapsed: number | null;
    };
    venue: {
      id: number | null;
      name: string;
      city: string;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: { /* same as home */ };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}
```

**Transformed Response:**
```typescript
type FormattedFixturesResponse = FormattedCountry[];

interface FormattedCountry {
  name: string;
  flag: string | null;
  leagues: FormattedLeague[];
}

interface FormattedLeague {
  id: number;
  name: string;
  logo: string;
  matches: FormattedMatch[];
}

interface FormattedMatch {
  id: number;
  date: string;        // YYYY-MM-DD in user's timezone
  time: string;        // HH:mm in user's timezone
  timestamp: number;   // Unix timestamp
  timezone: string;    // User's timezone
  status: {
    short: FixtureStatusShort;
    long: string;
    elapsed: number | null;
  };
  teams: {
    home: TeamInfo;
    away: TeamInfo;
  };
  score: {
    fulltime: Score;
    penalty: Score;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}
```

**Status Types:**
```typescript
type FixtureStatusShort =
  // Live
  | '1H' | '2H' | 'HT' | 'ET' | 'INT' | 'BT' | 'P'
  // Finished
  | 'FT' | 'AET' | 'PEN'
  // Not Started
  | 'NS'
  // Cancelled/Postponed
  | 'CANC' | 'PST' | 'ABD' | 'WO' | 'TBD';

const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'INT', 'BT', 'P'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
const NOT_STARTED_STATUSES = ['NS'];
```

### Data Transformation Pipeline

**File:** [utils.ts](../../../apps/backend/src/modules/fixtures/utils.ts)

**Pattern 1: Timezone Filtering**
```typescript
// Filter fixtures to match requested local date
export const filterFixturesByTimezone = (
  fixtures: Fixture[],
  requestedDate: string,
  timezone: string
): Fixture[] => {
  const fixturesByLocalDate = new Map<string, Fixture[]>();

  // Convert each fixture's UTC date to user's timezone
  for (const fixture of fixtures) {
    const localDate = formatInTimeZone(
      new Date(fixture.fixture.date),
      timezone,
      'yyyy-MM-dd'
    );

    const existing = fixturesByLocalDate.get(localDate) || [];
    fixturesByLocalDate.set(localDate, [...existing, fixture]);
  }

  // Return only fixtures matching requested date
  return fixturesByLocalDate.get(requestedDate) || [];
};
```

**Pattern 2: Hierarchical Grouping**
```typescript
// Group flat fixture list into nested structure
export const formatFixtures = (
  fixtures: Fixture[],
  timezone: string
): FormattedCountry[] => {
  const countryMap = new Map<string, FormattedCountry>();

  for (const fixture of fixtures) {
    const countryName = fixture.league.country;

    // Get or create country
    let country = countryMap.get(countryName);
    if (!country) {
      country = {
        name: countryName,
        flag: fixture.league.flag,
        leagues: [],
      };
      countryMap.set(countryName, country);
    }

    // Get or create league
    let league = country.leagues.find(l => l.id === fixture.league.id);
    if (!league) {
      league = {
        id: fixture.league.id,
        name: fixture.league.name,
        logo: fixture.league.logo,
        matches: [],
      };
      country.leagues.push(league);
    }

    // Add match
    league.matches.push(formatMatch(fixture, timezone));
  }

  // Sort: Countries → Leagues (alphabetically), Matches (chronologically)
  return Array.from(countryMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
};
```

---

## Performance Optimization

### TTL Constants

**File:** [types.ts](../../../apps/backend/src/modules/cache/types.ts)

```typescript
export const TTL = {
  SHORT: 20,        // 20 seconds for Edge Cache (buffer over 15s refresh)
  MEDIUM: 300,      // 5 minutes for not-started matches
  STANDARD: 3600,   // 1 hour for standings
  LONG: 86400,      // 24 hours for historical/static data
  KV_MIN: 60,       // Cloudflare KV minimum TTL
  R2_TODAY: 300,    // 5 min staleness window for R2
} as const;

export const SWR = {
  SHORT: 0,         // No stale data for live matches
  STANDARD: 7200,   // 2 hours for static data
} as const;
```

### Edge Cache Pre-warming

**Common Timezones:**
```typescript
const commonTimezones = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Lisbon',
  'Asia/Tokyo',
  'Australia/Sydney',
];

// Pre-generate transformed responses for all common timezones
const transformPromises = commonTimezones.map(async (timezone) => {
  const filtered = filterFixturesByTimezone(fixtures, today, timezone);
  const formatted = formatFixtures(filtered, timezone);
  await cacheSetEdgeOnly('fixtures', { date: today, timezone }, formatted);
});

await Promise.all(transformPromises);
```

### Stale-While-Revalidate Pattern

**File:** [fixtures.service.ts](../../../apps/backend/src/modules/fixtures/fixtures.service.ts)

```typescript
async fetchDateFixtures({ date, env }): Promise<{
  fixtures: Fixture[];
  source: string;
}> {
  // 1. Check cache first
  const cacheResult = await cacheGet(env, 'fixtures', { date });
  let staleFixtures: Fixture[] | null = null;

  if (cacheResult.data && !isStale(cacheResult.meta, 'fixtures', { date })) {
    return { fixtures: cacheResult.data, source: 'Cache' };
  }

  // Keep stale data as fallback
  staleFixtures = cacheResult.data;

  // 2. Try API fetch
  try {
    const response = await getFootballApiFixtures(date, env.FOOTBALL_API_URL, env.RAPIDAPI_KEY);

    // 3. Cache in background (non-blocking)
    ctx.waitUntil(cacheSet(env, 'fixtures', { date }, response.response));

    return { fixtures: response.response, source: 'API' };
  } catch (error) {
    // 4. Fallback to stale cache
    if (staleFixtures) {
      console.log(`⚠️ Using stale data as fallback for ${date}`);
      return { fixtures: staleFixtures, source: 'Stale Cache' };
    }

    throw error;
  }
}
```

---

## Background Jobs & Scheduling

### Durable Objects

#### **Refresh Scheduler Durable Object**
**File:** [refresh-scheduler-do.ts](../../../apps/backend/src/utils/refresh-scheduler-do.ts)

**Purpose:** 15-second refresh cycle using alarm-based scheduling

```typescript
const REFRESH_INTERVAL_MS = 15_000; // 15 seconds

export class RefreshSchedulerDurableObject {
  // Alarm handler - called every 15 seconds
  async alarm(): Promise<void> {
    try {
      // Refresh today's fixtures
      await refreshTodayFixtures(this.env);
    } catch (error) {
      console.error(`❌ [RefreshScheduler] Refresh failed:`, error);
    }

    // Schedule next alarm in 15 seconds (self-perpetuating chain)
    await this.state.storage.setAlarm(Date.now() + REFRESH_INTERVAL_MS);
  }

  // Start the alarm chain
  async start(): Promise<{ started: boolean; nextAlarm: number }> {
    const currentAlarm = await this.state.storage.getAlarm();

    if (currentAlarm) {
      return { started: false, nextAlarm: currentAlarm };
    }

    // Start immediately
    const nextAlarm = Date.now() + 1000;
    await this.state.storage.setAlarm(nextAlarm);

    return { started: true, nextAlarm };
  }
}
```

#### **Quota Durable Object**
**File:** [quota-durable-object.ts](../../../apps/backend/src/utils/quota-durable-object.ts)

**Purpose:** Atomic API quota tracking

```typescript
export class QuotaDurableObject {
  async increment(): Promise<IncrementResponse> {
    // Ensure state is up to date (handles day/hour rollovers)
    const state = await this.ensureState();

    // ATOMICALLY increment counters
    state.dailyCalls++;
    state.hourlyCalls++;
    state.lastUpdated = new Date().toISOString();

    // Save updated state
    await this.state.storage.put('quota', state);

    // Calculate remaining
    const dailyRemaining = this.config.dailyLimit - state.dailyCalls;
    const hourlyRemaining = this.config.hourlyLimit - state.hourlyCalls;

    const allowed = dailyRemaining >= 0 && hourlyRemaining >= 0;
    const shouldAlert = (state.dailyCalls / this.config.dailyLimit) >= this.config.alertThreshold;

    return {
      allowed,
      dailyRemaining: Math.max(0, dailyRemaining),
      hourlyRemaining: Math.max(0, hourlyRemaining),
      shouldAlert,
    };
  }
}
```

**Configuration:**
```typescript
const DEFAULT_CONFIG: QuotaConfig = {
  dailyLimit: 70000,     // API-Football daily limit
  hourlyLimit: 3000,     // API-Football hourly limit
  alertThreshold: 0.8,   // Alert at 80%
};
```

### Cron Jobs

**File:** `wrangler.toml`

```toml
# Cron acts as failsafe to ensure DO alarm chain is running
[triggers]
crons = ["* * * * *"]  # Every minute (failsafe)
```

**Scheduled Event Handler:**
**File:** [refresh-scheduler.ts](../../../apps/backend/src/modules/scheduler/refresh-scheduler.ts)

```typescript
export const handleScheduledEvent = async (
  event: ScheduledEvent,
  env: SchedulerEnv
): Promise<void> => {
  const scheduledTime = new Date(event.scheduledTime);
  const hour = scheduledTime.getUTCHours();

  // Run cleanup once per day at 2 AM UTC
  if (hour === 2) {
    const result = await cleanupOldCacheData(env, 30, 14);
    console.log(`✅ Cleanup: deleted ${result.deleted} files`);
  }

  // Ensure the DO alarm chain is running
  const id = env.REFRESH_SCHEDULER_DO.idFromName('default');
  const stub = env.REFRESH_SCHEDULER_DO.get(id);

  const response = await stub.fetch(new Request('https://do/ensure', { method: 'POST' }));
  const result = await response.json();

  if (result.started) {
    console.log(`🚀 Started DO alarm chain`);
  }
};
```

### Background Refresh Operations

**15-Second Refresh Cycle:**
```typescript
export const refreshTodayFixtures = async (env: SchedulerEnv): Promise<void> => {
  const today = getCurrentUtcDate();

  // 1. Check for date transition
  await checkFixturesDateTransition(env);

  // 2. Fetch fresh data from API
  const response = await getFootballApiFixtures(today, undefined, env.FOOTBALL_API_URL, env.RAPIDAPI_KEY);

  // 3. Store raw UTC data in R2
  await cacheSet(env, 'fixtures', { date: today }, response.response);

  // 4. Pre-generate Edge Cache for common timezones
  const transformPromises = commonTimezones.map(async (timezone) => {
    const filtered = filterFixturesByTimezone(response.response, today, timezone);
    const formatted = formatFixtures(filtered, timezone);
    await cacheSetEdgeOnly('fixtures', { date: today, timezone }, formatted);
  });

  await Promise.all(transformPromises);
};
```

**Daily Cleanup:**
```typescript
export const cleanupOldCacheData = async (
  env: FixturesCacheEnv,
  retentionDays: number = 30,
  futureDays: number = 14
): Promise<{ deleted: number; errors: number }> => {
  const today = getCurrentUtcDate();
  const cutoffDate = subDays(parseISO(today), retentionDays);
  const futureCutoffDate = addDays(parseISO(today), futureDays);

  let deleted = 0;

  // Clean up old historical data (older than 30 days)
  const historicalKeys = await r2Provider.list('historical/');
  for (const key of historicalKeys) {
    const fileDate = extractDateFromKey(key);
    if (fileDate && fileDate < cutoffDate) {
      await r2Provider.delete(key);
      deleted++;
    }
  }

  // Clean up old future data (beyond 14 days)
  const futureKeys = await r2Provider.list('future/');
  for (const key of futureKeys) {
    const fileDate = extractDateFromKey(key);
    if (fileDate && fileDate > futureCutoffDate) {
      await r2Provider.delete(key);
      deleted++;
    }
  }

  return { deleted, errors: 0 };
};
```

---

## Timezone Handling

### Timezone Conversion

**File:** [timezone.utils.ts](../../../apps/backend/src/modules/fixtures/timezone.utils.ts)

**Get Current Hour in Timezone:**
```typescript
import { formatInTimeZone } from 'date-fns-tz';

export const getCurrentHourInTimezone = (timezone: string): number => {
  const userNow = new Date();
  return parseInt(formatInTimeZone(userNow, timezone, 'HH'), 10);
};
```

**Multi-Date Fetching Strategy:**
```typescript
// Determine which dates to fetch based on timezone offset
export const getDatesToFetch = (
  requestedDate: string,
  timezone: string,
  currentHour: number
): TimezoneFetchStrategy => {
  // User ahead of UTC (positive offset) - late in their day
  if (currentHour >= 20) {
    return {
      datesToFetch: [getAdjacentDate(requestedDate, -1), requestedDate],
      reason: `User timezone ahead of UTC (${timezone}), fetching yesterday and today`,
    };
  }

  // User behind UTC (negative offset) - early in their day
  if (currentHour <= 4) {
    return {
      datesToFetch: [requestedDate, getAdjacentDate(requestedDate, 1)],
      reason: `User timezone behind UTC (${timezone}), fetching today and tomorrow`,
    };
  }

  // For users near UTC, fetch all three days for safety
  return {
    datesToFetch: [
      getAdjacentDate(requestedDate, -1),
      requestedDate,
      getAdjacentDate(requestedDate, 1),
    ],
    reason: `User timezone near UTC (${timezone}), fetching all three days`,
  };
};
```

**Example:**
```typescript
// User in Tokyo (UTC+9) requesting 2026-01-06 at 11 PM local time
// UTC time: 2 PM on 2026-01-06
// Strategy: Fetch yesterday (01-05) and today (01-06)
// Some matches at midnight local time are still on 01-05 in UTC
```

### Date Utilities

**File:** [date.utils.ts](../../../apps/backend/src/modules/fixtures/date.utils.ts)

**UTC Date Normalization:**
```typescript
export const normalizeToUtcDate = (date?: string): string => {
  if (!date) {
    const now = new Date();
    return format(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      'yyyy-MM-dd'
    );
  }

  return date;
};

export const getCurrentUtcDate = (): string => normalizeToUtcDate();
export const getYesterdayUtcDate = (): string => getAdjacentDate(getCurrentUtcDate(), -1);
export const getTomorrowUtcDate = (): string => getAdjacentDate(getCurrentUtcDate(), 1);
```

**Adjacent Date Calculation:**
```typescript
export const getAdjacentDate = (dateStr: string, offset: number): string => {
  const date = parseISO(dateStr);
  const adjacent = addDays(date, offset);
  return format(adjacent, 'yyyy-MM-dd');
};
```

---

## Error Handling

### Multi-Level Fallback Strategy

**Fallback Chain:**
```
1. Edge Cache (fresh) → HIT → Return
2. KV/R2 Cache (fresh) → HIT → Return
3. KV/R2 Cache (stale) → Keep as fallback
4. API Fetch → SUCCESS → Return
5. API Fetch → FAIL → Return stale data
6. No stale data → Throw error
```

**Implementation:**
```typescript
async fetchDateFixtures({ date, env }): Promise<{ fixtures: Fixture[]; source: string }> {
  // 1. Check cache
  const cacheResult = await cacheGet(env, 'fixtures', { date });
  let staleFixtures: Fixture[] | null = null;

  if (cacheResult.data && !isStale(cacheResult.meta, 'fixtures', { date })) {
    return { fixtures: cacheResult.data, source: cacheResult.source };
  }

  // 2. Keep stale data as fallback
  staleFixtures = cacheResult.data;

  // 3. Try API fetch
  try {
    const response = await getFootballApiFixtures(...);
    ctx.waitUntil(cacheSet(env, 'fixtures', { date }, response.response));
    return { fixtures: response.response, source: 'API' };
  } catch (error) {
    // 4. Fallback to stale cache
    if (staleFixtures) {
      console.log(`⚠️ Using stale data as fallback for ${date}`);
      return { fixtures: staleFixtures, source: 'Stale Cache' };
    }

    // 5. No fallback available
    throw error;
  }
}
```

### Error Classification

**File:** [fixtures.routes.ts](../../../apps/backend/src/modules/fixtures/fixtures.routes.ts)

```typescript
catch (error) {
  let errorMessage = 'Failed to fetch fixtures';
  let statusCode = 500;

  if (error instanceof Error) {
    if (error.message.includes('API rate limit')) {
      errorMessage = 'API rate limit exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message.includes('API request failed')) {
      errorMessage = 'External API request failed. Please try again later.';
      statusCode = 502;
    } else if (error.message.includes('Invalid timezone')) {
      statusCode = 400;
    }
  }

  return context.json({ status: 'error', message: errorMessage }, statusCode);
}
```

### Retry Logic

**Exponential Backoff for Date Transitions:**
```typescript
const retryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffMultiplier: 2,
};

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    await performOperation();
    break;
  } catch (error) {
    if (attempt === maxRetries) throw error;

    const delay = Math.min(
      initialDelay * Math.pow(backoffMultiplier, attempt - 1),
      maxDelay
    );
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### Circuit Breaker Pattern

**Quota Check Before API Call:**
```typescript
// Check quota before making API call
const quotaResult = await quotaManager.recordCall();

if (!quotaResult.allowed) {
  throw new Error(
    `API rate limit exceeded. Daily: ${quotaResult.dailyRemaining}, Hourly: ${quotaResult.hourlyRemaining}`
  );
}

// Proceed with API call
const response = await fetch(apiUrl, { headers });
```

---

## Security

### CORS Configuration

**File:** [cors.ts](../../../apps/backend/src/modules/security/cors.ts)

```typescript
export const corsMiddleware = (allowedOrigins?: string): MiddlewareHandler => {
  const origins = allowedOrigins?.split(',').map(o => o.trim()) || [];

  // Default allowed origins
  const defaultOrigins = [
    'https://outscore.live',
    'https://www.outscore.live',
    'http://localhost:8081',
    'http://localhost:19006',
  ];

  const allOrigins = [...defaultOrigins, ...origins];

  return async (context, next) => {
    const origin = context.req.header('origin');

    // Allow Expo Go development
    if (origin?.startsWith('http://192.168.') || origin?.includes('exp://')) {
      context.header('Access-Control-Allow-Origin', origin);
      context.header('Access-Control-Allow-Credentials', 'true');
    } else if (origin && allOrigins.includes(origin)) {
      context.header('Access-Control-Allow-Origin', origin);
      context.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (context.req.method === 'OPTIONS') {
      context.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      context.header('Access-Control-Allow-Headers', 'Content-Type');
      context.header('Access-Control-Max-Age', '86400');
      return context.text('', 204);
    }

    await next();
  };
};
```

### Rate Limiting

**File:** [rate-limiter.ts](../../../apps/backend/src/modules/security/rate-limiter.ts)

```typescript
// In-memory rate limiting with fixed window algorithm
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const rateLimiter = (config: RateLimiterConfig): MiddlewareHandler => {
  const { limit, windowSec } = config;
  const windowMs = windowSec * 1000;

  return async (context, next) => {
    const key = getClientIp(context);  // Uses CF-Connecting-IP
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    const remaining = Math.max(0, limit - entry.count);

    // Set rate limit headers
    context.header('X-RateLimit-Limit', limit.toString());
    context.header('X-RateLimit-Remaining', remaining.toString());
    context.header('X-RateLimit-Reset', String(Math.floor(entry.resetAt / 1000)));

    if (entry.count > limit) {
      return context.json({
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      }, 429);
    }

    await next();
  };
};

// Usage
app.use('/fixtures*', rateLimiter({ limit: 60, windowSec: 60 }));
```

**⚠️ Important:** Rate limiting is per-worker instance, not distributed across all workers.

### Bot Protection

**File:** [bot-protection.ts](../../../apps/backend/src/modules/security/bot-protection.ts)

```typescript
const BOT_USER_AGENTS = [
  'curl/', 'wget/', 'python-requests/', 'scrapy/', 'bot', 'crawler',
  'spider', 'scraper', 'postman', 'insomnia',
];

export const botProtection = (): MiddlewareHandler => {
  return async (context, next) => {
    const userAgent = context.req.header('user-agent') || '';

    // Block empty user agents
    if (!userAgent) {
      return context.json({ error: 'Missing user agent' }, 403);
    }

    // Block known bots
    const isBot = BOT_USER_AGENTS.some(bot =>
      userAgent.toLowerCase().includes(bot.toLowerCase())
    );

    if (isBot) {
      return context.json({ error: 'Bot access not allowed' }, 403);
    }

    // Validate Cloudflare IP header (ensures request came through Cloudflare)
    const cfConnectingIp = context.req.header('cf-connecting-ip');
    if (!cfConnectingIp) {
      console.warn('⚠️ Missing CF-Connecting-IP header');
      // Don't block in development
      if (process.env.NODE_ENV === 'production') {
        return context.json({ error: 'Invalid request source' }, 403);
      }
    }

    await next();
  };
};
```

### Secure Headers

**File:** [secure-headers.ts](../../../apps/backend/src/modules/security/secure-headers.ts)

```typescript
export const secureHeaders = (): MiddlewareHandler => {
  return async (context, next) => {
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('X-Frame-Options', 'DENY');
    context.header('X-XSS-Protection', '1; mode=block');
    context.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    await next();
  };
};
```

### Quota Management

**File:** [quota-manager.ts](../../../apps/backend/src/utils/quota-manager.ts)

**Atomic Quota Tracking:**
```typescript
export class QuotaManager {
  // Atomic check-and-reserve
  async recordCall(): Promise<{
    allowed: boolean;
    dailyRemaining: number;
    hourlyRemaining: number;
    shouldAlert: boolean;
  }> {
    const stub = this.getStub();

    // Atomic increment via Durable Object
    const response = await stub.fetch('https://quota.local/increment', {
      method: 'POST',
    });

    return await response.json();
  }

  // Get current status
  async getStatus(): Promise<QuotaStatus> {
    const stub = this.getStub();
    const response = await stub.fetch('https://quota.local/status');
    return await response.json();
  }
}

// Default configuration
const DEFAULT_CONFIG: QuotaConfig = {
  dailyLimit: 70000,     // API-Football daily limit
  hourlyLimit: 3000,     // API-Football hourly limit
  alertThreshold: 0.8,   // Alert at 80%
};
```

---

## Monitoring & Logging

### Structured Logging

**Emoji-Prefixed Log Levels:**
- ✅ Success operations
- ❌ Errors
- ⚠️ Warnings
- 🔍 Cache checks
- 🌐 API calls
- 📊 Response metrics
- 🔄 Background operations
- 🔴 Live data

**Example:**
```typescript
console.log(`✅ [Fixtures] Cache hit from ${source} for ${date}`);
console.error(`❌ [Fixtures] API fetch failed for ${date}:`, error);
console.log(`🔄 [Dedup] Reusing in-flight request for ${cacheKey}`);
```

### Metrics Collection

**File:** [metrics.ts](../../../apps/backend/src/utils/metrics.ts)

```typescript
interface Metrics {
  cache: {
    edgeHits: number;
    kvHits: number;
    r2Hits: number;
    apiCalls: number;
    hitRate: string;
  };
  responseTimes: {
    under10ms: number;
    under50ms: number;
    under100ms: number;
    under500ms: number;
    over500ms: number;
    p50Bucket: string;
  };
  requests: {
    total: number;
    errors: number;
    errorRate: string;
  };
  uptime: string;
}
```

**Per-Request Logging:**
```typescript
const logRequest = (
  path: string,
  method: string,
  status: number,
  durationMs: number,
  source?: string
) => {
  console.log(
    `📊 [${method}] ${path} - ${status} (${durationMs}ms)${source ? ` [${source}]` : ''}`
  );

  recordMetrics({ path, status, durationMs, source });
};
```

### Response Headers

**Debugging Headers:**
```typescript
// Added to every response
context.header('X-Response-Time', `${durationMs}ms`);
context.header('X-Source', source); // API, Cache, Edge Cache, Stale Cache
context.header('X-Timezone', timezone);

// Rate limit headers
context.header('X-RateLimit-Limit', '60');
context.header('X-RateLimit-Remaining', '45');
context.header('X-RateLimit-Reset', '1704556800');
```

### Cloudflare Observability

**Configuration:** `wrangler.toml`

```toml
[observability]
enabled = true
head_sampling_rate = 0.1  # Sample 10% of requests
```

---

## Configuration & Environment

### Environment Variables

**Cloudflare Bindings** (`wrangler.toml`)

```toml
[vars]
FOOTBALL_API_URL = "https://api-football-v1.p.rapidapi.com/v3"

# Secrets (set via `wrangler secret put`):
# - RAPIDAPI_KEY
# - APPROVED_ORIGINS (optional, comma-separated)
```

**Bindings:**
```toml
# KV Namespace
[[kv_namespaces]]
binding = "FOOTBALL_KV"
id = "..." # production ID
preview_id = "..." # development ID

# R2 Bucket
[[r2_buckets]]
binding = "FOOTBALL_CACHE"
bucket_name = "outscore-match-data"
preview_bucket_name = "outscore-match-data-dev"

# Durable Objects
[[durable_objects.bindings]]
name = "QUOTA_DO"
class_name = "QuotaDurableObject"

[[durable_objects.bindings]]
name = "REFRESH_SCHEDULER_DO"
class_name = "RefreshSchedulerDurableObject"
```

### Type-Safe Configuration

```typescript
interface Env extends FixturesEnv, SchedulerEnv {
  FOOTBALL_API_URL: string;
  RAPIDAPI_KEY: string;
  APPROVED_ORIGINS?: string;
  FOOTBALL_KV: KVNamespace;
  FOOTBALL_CACHE: R2Bucket;
  QUOTA_DO: DurableObjectNamespace;
  REFRESH_SCHEDULER_DO: DurableObjectNamespace;
}
```

### Secrets Management

**Best Practices:**
- API keys never in code (wrangler secrets)
- CORS origin validation
- Bot protection middleware
- Rate limiting per IP

**Setting Secrets:**
```bash
# Production
wrangler secret put RAPIDAPI_KEY
wrangler secret put APPROVED_ORIGINS

# Development
wrangler secret put RAPIDAPI_KEY --env preview
```

---

## Data Flow Diagrams

### Complete Request Lifecycle

```
1. Client Request
   ↓
2. Cloudflare Edge (HTTPS, DDoS protection)
   ↓
3. Worker Entry Point (index.ts)
   ↓
4. Middleware Pipeline
   ├─ Secure Headers
   ├─ CORS
   ├─ Bot Protection
   └─ Rate Limiting
   ↓
5. Route Handler (fixtures.routes.ts)
   ├─ Query Validation (Zod)
   └─ Call Service Layer
   ↓
6. Service Layer (fixtures.service.ts)
   ├─ Date Transition Check
   ├─ Request Deduplication
   └─ Multi-Date Fetching (timezone-based)
   ↓
7. Cache Check (3-tier)
   ├─ Edge Cache (<10ms)
   ├─ KV Cache (disabled)
   └─ R2 Storage (50-100ms)
   ↓
8. API Fetch (if cache miss)
   ├─ Quota Check (Durable Object)
   ├─ HTTP Request to Football API
   └─ Error Validation
   ↓
9. Data Transformation
   ├─ Timezone Filtering
   ├─ Hierarchical Grouping
   └─ Format Conversion
   ↓
10. Background Caching (ctx.waitUntil)
    ├─ Store raw UTC in R2
    └─ Store transformed in Edge Cache
    ↓
11. Response
    ├─ Add Cache Headers
    ├─ Add Debug Headers
    └─ Return JSON
```

### Cache Flow Diagram

```
Request with (date, timezone, live)
  ↓
Generate Edge Cache Key (URL format)
  ↓
Edge Cache Check
  ├─ HIT (fresh) → Return transformed data ✅
  └─ MISS
      ↓
  Generate R2 Cache Key
      ↓
  R2 Storage Check
  ├─ HIT (fresh)
  │   ↓
  │ Filter by Timezone
  │   ↓
  │ Transform to Hierarchy
  │   ↓
  │ Cache in Edge (async)
  │   ↓
  │ Return transformed data ✅
  └─ MISS → Keep stale data (if exists)
      ↓
  Quota Check (Durable Object)
  ├─ ALLOWED
  │   ↓
  │ Fetch from Football API
  │   ↓
  │ Store raw UTC in R2 (async)
  │   ↓
  │ Filter by Timezone
  │   ↓
  │ Transform to Hierarchy
  │   ↓
  │ Cache in Edge (async)
  │   ↓
  │ Return transformed data ✅
  └─ DENIED or API ERROR
      ↓
  Return stale data (if exists) ⚠️
      ↓
  Error (no fallback) ❌
```

---

## Code Examples

### Adding a New Endpoint

```typescript
// 1. Define route in fixtures.routes.ts
fixturesRouter.get('/leagues', async (context) => {
  const { leagueId } = context.req.query();

  // Validation
  const schema = z.object({
    leagueId: z.string().regex(/^\d+$/),
  });

  const params = schema.parse({ leagueId });

  // Call service layer
  const result = await fixturesService.getLeague(params.leagueId, context.env);

  return context.json(result);
});

// 2. Implement service method in fixtures.service.ts
async getLeague(leagueId: string, env: Env): Promise<League> {
  // Check cache
  const cacheResult = await cacheGet(env, 'leagues', { leagueId });

  if (cacheResult.data) {
    return cacheResult.data;
  }

  // Fetch from API
  const response = await getFootballApiLeague(leagueId, env.FOOTBALL_API_URL, env.RAPIDAPI_KEY);

  // Cache result
  await cacheSet(env, 'leagues', { leagueId }, response);

  return response;
}

// 3. Add cache strategy in cache-strategies.ts
export const CACHE_STRATEGIES: Record<ResourceType, CacheStrategyConfig> = {
  // ... existing strategies
  leagues: {
    keyGenerator: (params) => `leagues:${params.leagueId}`,
    getTTL: () => TTL.LONG, // 24 hours
    layers: ['edge', 'r2'],
  },
};
```

### Implementing Custom Middleware

```typescript
// custom-middleware.ts
import type { MiddlewareHandler } from 'hono';

export const customMiddleware = (config: CustomConfig): MiddlewareHandler => {
  return async (context, next) => {
    // Pre-processing
    const startTime = Date.now();

    // Call next middleware/handler
    await next();

    // Post-processing
    const duration = Date.now() - startTime;
    context.header('X-Processing-Time', `${duration}ms`);
  };
};

// Usage in index.ts
app.use('/api/*', customMiddleware({ ... }));
```

### Working with Durable Objects

```typescript
// Get Durable Object instance
const id = env.QUOTA_DO.idFromName('quota-tracker');
const stub = env.QUOTA_DO.get(id);

// Call Durable Object method
const response = await stub.fetch('https://quota.local/increment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'api-call' }),
});

const result = await response.json();
```

---

## File Reference

### Configuration Files
- [wrangler.toml](../../../apps/backend/wrangler.toml) - Cloudflare Workers configuration
- [package.json](../../../apps/backend/package.json) - Dependencies and scripts
- [tsconfig.json](../../../apps/backend/tsconfig.json) - TypeScript configuration

### Entry Points
- [index.ts](../../../apps/backend/src/index.ts) - Main Worker entry point

### Caching System (7 files)
- [cache-manager.ts](../../../apps/backend/src/modules/cache/cache-manager.ts) - Generic cache operations
- [cache-strategies.ts](../../../apps/backend/src/modules/cache/cache-strategies.ts) - TTL strategies
- [edge-cache.ts](../../../apps/backend/src/modules/cache/edge-cache.ts) - Edge Cache provider
- [kv-provider.ts](../../../apps/backend/src/modules/cache/kv-provider.ts) - KV provider
- [r2-provider.ts](../../../apps/backend/src/modules/cache/r2-provider.ts) - R2 provider
- [fixtures-strategy.ts](../../../apps/backend/src/modules/cache/fixtures-strategy.ts) - Fixtures caching
- [atomic-transition.ts](../../../apps/backend/src/modules/cache/atomic-transition.ts) - Date transitions
- [types.ts](../../../apps/backend/src/modules/cache/types.ts) - Cache type definitions
- [provider.interface.ts](../../../apps/backend/src/modules/cache/provider.interface.ts) - Provider interface

### Fixtures Module (5 files)
- [fixtures.routes.ts](../../../apps/backend/src/modules/fixtures/fixtures.routes.ts) - Route handlers
- [fixtures.service.ts](../../../apps/backend/src/modules/fixtures/fixtures.service.ts) - Business logic
- [utils.ts](../../../apps/backend/src/modules/fixtures/utils.ts) - Data transformation
- [date.utils.ts](../../../apps/backend/src/modules/fixtures/date.utils.ts) - Date handling
- [timezone.utils.ts](../../../apps/backend/src/modules/fixtures/timezone.utils.ts) - Timezone logic

### Security (4 files)
- [cors.ts](../../../apps/backend/src/modules/security/cors.ts) - CORS configuration
- [rate-limiter.ts](../../../apps/backend/src/modules/security/rate-limiter.ts) - Rate limiting
- [bot-protection.ts](../../../apps/backend/src/modules/security/bot-protection.ts) - Bot detection
- [secure-headers.ts](../../../apps/backend/src/modules/security/secure-headers.ts) - Security headers

### Background Jobs
- [refresh-scheduler.ts](../../../apps/backend/src/modules/scheduler/refresh-scheduler.ts) - Scheduler logic
- [refresh-scheduler-do.ts](../../../apps/backend/src/utils/refresh-scheduler-do.ts) - 15s alarm Durable Object
- [quota-durable-object.ts](../../../apps/backend/src/utils/quota-durable-object.ts) - Atomic quota tracking
- [quota-manager.ts](../../../apps/backend/src/utils/quota-manager.ts) - Quota management

### Utilities
- [metrics.ts](../../../apps/backend/src/utils/metrics.ts) - Metrics collection
- [football-api.ts](../../../apps/backend/src/pkg/util/football-api.ts) - Football API client

### Shared Types
- [index.ts](../../../packages/shared-types/index.ts) - Type exports
- [football-api.ts](../../../packages/shared-types/src/football-api.ts) - API type definitions

### Documentation
- [CLOUDFLARE_SETUP.md](../../../apps/backend/CLOUDFLARE_SETUP.md) - Deployment guide
- [API_TESTING.md](../../../apps/backend/API_TESTING.md) - Testing guide
- [ATOMIC_TRANSITION_README.md](../../../apps/backend/src/modules/cache/ATOMIC_TRANSITION_README.md) - Date transition docs

---

## Best Practices

### Architecture Principles

1. **Edge-First Design** - Serve from edge whenever possible
2. **Cache Aggressively** - Cache everything that doesn't change frequently
3. **Fail Gracefully** - Always have fallbacks (stale data, error responses)
4. **Non-Blocking Operations** - Use `ctx.waitUntil()` for cache writes
5. **Atomic Operations** - Use Durable Objects for state that needs atomicity
6. **Type Safety** - Leverage TypeScript strict mode and shared types
7. **Request Deduplication** - Prevent thundering herd problems
8. **Timezone Awareness** - Always consider timezone edge cases

### Performance Tips

1. **Pre-warm Edge Cache** - Generate responses for common timezones
2. **Use Short TTLs for Live Data** - 15-20 seconds for live matches
3. **Use Long TTLs for Historical Data** - 24 hours for finished matches
4. **Minimize API Calls** - Check quota before every call
5. **Parallelize Operations** - Use `Promise.all()` for independent tasks
6. **Monitor Cache Hit Rates** - Target >90% hit rate

### Security Checklist

- ✅ CORS configured with allowed origins
- ✅ Rate limiting enabled (60/min)
- ✅ Bot protection middleware
- ✅ Secure headers (HSTS, X-Frame-Options)
- ✅ Quota tracking to prevent overruns
- ✅ Input validation (Zod schemas)
- ✅ No secrets in code
- ✅ Cloudflare IP validation

### Deployment Workflow

```bash
# Development
npm run dev

# Deploy to preview
wrangler deploy --env preview

# Deploy to production
wrangler deploy

# View logs
wrangler tail

# Set secrets
wrangler secret put RAPIDAPI_KEY
```

---

*This skill provides comprehensive documentation of the Outscore backend architecture. All patterns, configurations, and best practices are documented here for consistent implementation and maintenance.*
