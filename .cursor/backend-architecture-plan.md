Backend Architecture Plan for Outscore
Architecture Overview
The backend will use a multi-layer caching strategy to achieve <50ms response times while minimizing third-party API calls:

Client Request
    ↓
Cloudflare Edge Cache (Cache API) - <10ms if hit
    ↓ (miss)
Cloudflare Worker (Hono)
    ↓
Cloudflare KV (hot data) - ~10-20ms if hit
    ↓ (miss)
R2 Cache Check - ~50-100ms if hit
    ↓ (miss)
Third-party Football API - 200-500ms
    ↓
Store in KV (hot) + R2 (cold) + Edge Cache
    ↓
Transform for timezone
    ↓
Return to client
Key Enhancement: Added Cloudflare KV as a middle layer for frequently accessed data (today's matches), providing faster access than R2 while keeping costs low.

Key Components
1. Multi-Layer Caching Strategy
Layer 1: Cloudflare Cache API (Edge Cache)

Fastest layer (<10ms response time)
Cache transformed responses per timezone
Cache key format: fixtures:{date}:{timezone}:{live}
TTL: 15s for today, 1h for historical/future
Use stale-while-revalidate pattern
Layer 2: R2 Storage (Persistent Cache)

Store raw UTC data (not timezone-transformed)
Cache key format: {location}/fixtures-{date}.json (today/historical/future)
TTL: 15s for today, 1h for others
Used when Edge Cache misses
Layer 3: Background Refresh

Scheduled worker refreshes today's data every 15s
Uses waitUntil to update cache without blocking response
Prevents quota exhaustion from concurrent requests
2. Cache Key Strategy
Edge Cache Keys (timezone-aware):

fixtures:{date}:{timezone}:{live} - Transformed response
Example: fixtures:2026-01-01:Europe/Lisbon:false
R2 Keys (UTC-only):

today/fixtures-{date}.json - Today's UTC data
historical/fixtures-{date}.json - Past UTC data  
future/fixtures-{date}.json - Future UTC data
today/fixtures-{date}-live.json - Live matches
3. Data Transformation Pipeline
Third-Party API Response:

Returns flat array of Fixture[] objects
Each fixture contains: league info, teams, scores, dates (UTC)
Raw structure: { response: Fixture[] }
Transformation Steps (from inspiration folder):

Fetch Raw Data: Get Fixture[] array from API/cache
Timezone Filtering: filterFixturesByTimezone() - Filter fixtures to match requested date in user's timezone
Grouping & Formatting: formatFixtures() - Transform flat array into grouped structure:
Country → Leagues → Matches
Apply timezone transformation to match times/dates
Sort countries alphabetically
Sort leagues alphabetically  
Sort matches by timestamp
Final Response: FormattedFixturesResponse (array of countries with nested leagues and matches)
Storage Strategy:

KV/R2: Store raw Fixture[] arrays (UTC data, no transformation)
Edge Cache: Store final transformed FormattedFixturesResponse (grouped structure, timezone-applied)
Single UTC dataset reduces storage costs
Transformation happens after cache retrieval
Edge cache provides fast timezone-specific grouped responses
Transformation Flow:

Check Edge Cache for timezone-specific grouped response
If miss, check KV for raw UTC Fixture[] data
If miss, check R2 for raw UTC Fixture[] data
If miss, fetch from third-party API
Store raw data in KV + R2
Apply timezone filtering (filterFixturesByTimezone)
Apply grouping/formatting (formatFixtures)
Cache transformed grouped response in Edge Cache
Return grouped response to client
4. Cache TTL Strategy
Today's Data (UTC today):

Edge Cache: 15s TTL, stale-while-revalidate: 30s
R2: 15s TTL
Background refresh: Every 15s
Tomorrow's Data:

Edge Cache: 15s TTL (as you suggested)
R2: 1h TTL
Reason: Matches can change, but less frequently than today
Historical Data:

Edge Cache: 1h TTL
R2: 24h TTL
Reason: Historical data rarely changes
Future Data (>1 day):

Edge Cache: 1h TTL
R2: 24h TTL
5. Performance Optimizations
Response Compression:

Use gzip compression for responses >1KB
Cloudflare automatically handles this, but ensure JSON is minified
Request Deduplication:

Track in-flight requests per cache key
Reuse pending promises to avoid duplicate API calls
Critical for high-traffic scenarios
Parallel Processing:

Fetch multiple dates in parallel when needed
Transform timezone in parallel for multiple requests
Background Refresh:

Use Cloudflare Cron Triggers for scheduled refreshes
Refresh today's data every 15s
Use waitUntil to update cache without blocking
6. Quota Management
Daily API Call Estimation:

Background refresh: ~5,760 calls/day (every 15s)
Cache hit rate target: 95%+ (Edge Cache + R2)
Expected API calls: ~6,000/day (well under 70k limit)
Strategies:

Aggressive Edge Cache (15s for today)
Background refresh prevents on-demand API calls
Request deduplication prevents concurrent duplicate calls
Smart cache invalidation based on date transitions
7. File Structure
apps/backend/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── modules/
│   │   ├── cache/
│   │   │   ├── edge-cache.ts      # Cloudflare Cache API wrapper
│   │   │   ├── kv-provider.ts     # Cloudflare KV provider
│   │   │   ├── r2-provider.ts     # R2 cache provider (existing)
│   │   │   ├── cache-manager.ts   # Multi-layer cache coordinator
│   │   │   ├── types.ts           # Cache types
│   │   │   └── provider.interface.ts
│   │   ├── fixtures/
│   │   │   ├── fixtures.routes.ts  # Route handlers
│   │   │   ├── fixtures.service.ts # Business logic
│   │   │   ├── cache.service.ts   # Cache operations
│   │   │   ├── timezone.utils.ts  # Timezone transformations
│   │   │   ├── date.utils.ts      # Date utilities
│   │   │   └── utils.ts           # Formatting utilities
│   │   ├── security/
│   │   │   ├── rate-limiter.ts    # Rate limiting middleware
│   │   │   ├── auth.ts            # Authentication middleware
│   │   │   ├── bot-protection.ts  # Bot protection (existing)
│   │   │   └── cors.ts            # CORS configuration
│   │   └── scheduler/
│   │       └── refresh-scheduler.ts # Background refresh logic
│   ├── pkg/
│   │   └── util/
│   │       └── football-api.ts    # Third-party API client
│   └── utils/
│       ├── compression.ts          # Response compression
│       ├── request-dedup.ts       # Request deduplication
│       └── quota-manager.ts       # API quota tracking
├── wrangler.toml                   # Cloudflare config
├── package.json
└── tsconfig.json
8. Implementation Details
Edge Cache Implementation:

Use caches.default (Cloudflare Cache API)
Cache transformed responses with proper cache keys
Implement stale-while-revalidate pattern
Set appropriate Cache-Control headers
Cache Manager:

Coordinate between Edge Cache and R2
Handle cache invalidation
Manage request deduplication
Track cache hit/miss metrics
Background Refresh:

Use Cloudflare Cron Triggers (scheduled events)
Refresh today's UTC data every 15s
Update KV, R2, and Edge Cache in parallel
Handle date transitions automatically
Date Transition Management (Critical - Single Reference Per Date):

Principle: Each date exists in only ONE folder at a time (future → today → historical)
Known Issue: The inspiration folder's handleFixturesDateTransition had duplication bugs - needs refactoring
Improved Transition Logic (to be implemented):
Atomic Operations: Use transaction-like pattern to ensure move operations complete fully
Verification Steps: After each move, verify source file is deleted and destination exists
Retry Logic: If move fails, retry with exponential backoff
Cleanup Pass: Run periodic cleanup to detect and fix any duplicates
Lock Mechanism: Use KV to track in-progress transitions and prevent race conditions
Transition Flow:
When date moves future/ → today/: 
Copy to today folder
Verify copy succeeded
Delete from future folder
Verify deletion succeeded
Clean up KV entries
When date moves today/ → historical/: Same atomic pattern
Check for duplicates before and after transitions
KV Cleanup: Remove KV entries atomically when moving between folders
Edge Cache: Invalidate all timezone-specific entries for transitioning dates
Error Handling: If transition fails, log error and retry on next operation
Storage Layers Affected: R2 (move files), KV (delete old keys), Edge Cache (invalidate)
Request Deduplication:

Track in-flight requests by cache key
Reuse promises for concurrent requests
Prevent duplicate API calls
9. Security & Rate Limiting
Inbound Rate Limiting:

Cloudflare Rate Limiter: 100 requests/60s per IP (primary defense)
Application-level: hono-rate-limiter with sliding window
Per-endpoint limits: /fixtures (60/min), /fixtures?live=all (30/min)
Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After
Store rate limit state in KV for distributed workers
Outbound Rate Limiting (API Quota):

Daily quota: 70,000 calls/day
Background refresh: ~5,760 calls/day
Target: <6,000 calls/day (95%+ cache hit rate)
Token bucket algorithm: Allow bursts up to 3,000 calls/hour
Monitor and alert at 80% quota threshold
Security Measures:

Authentication: Optional API key auth for sensitive endpoints
CORS: Whitelist approved origins from environment
Input Validation: Zod schemas for all parameters, timezone validation
Bot Protection: User-Agent validation, block known bots, Cloudflare header checks
Secure Headers: HSTS, X-Content-Type-Options, X-Frame-Options, CSP
DDoS Protection: Cloudflare automatic mitigation + rate limiting
Error Handling: Generic errors to clients, detailed logs server-side only
Secrets Management: Cloudflare Secrets for API keys, never log secrets
Security Monitoring:

Track failed auth attempts, rate limit violations, bot detections
Monitor suspicious patterns, API quota usage
Alert on security events (spikes, failures, quota thresholds)
10. Monitoring & Observability
Performance Metrics:

Cache hit rates (Edge Cache vs KV vs R2 vs API)
Response times (p50, p95, p99)
API quota usage
Error rates
Date transition events
Security Metrics:

Failed authentication attempts
Rate limit violations per IP
Bot detection events
Suspicious request patterns
Logging:

Cache operations (hit/miss per layer)
API calls (with timestamps)
Timezone transformations
Background refresh events
Security events (rate limits, bot blocks)
10. Cost Optimization
Cloudflare Workers:

Free tier: 100k requests/day
Paid: $5/month for 10M requests
R2 Storage:

Free tier: 10GB storage, 1M Class A operations
Paid: $0.015/GB storage, $4.50/million Class A ops
Estimated Monthly Cost:

50k users: ~$5-10/month (within free tier)
100k users: ~$10-20/month
Implementation Steps
Setup Edge Cache Layer
Create edge cache wrapper with Cache API
Implement cache key generation
Add stale-while-revalidate support
Refactor Cache Manager
Create multi-layer cache coordinator
Implement cache hierarchy (Edge → R2 → API)
Add request deduplication
Update Fixtures Service
Integrate Edge Cache for transformed responses
Keep R2 for UTC data storage
Update cache invalidation logic
Implement Background Refresh
Setup Cloudflare Cron Triggers
Create refresh scheduler
Update cache on schedule
Add Request Deduplication
Track in-flight requests
Reuse promises for concurrent requests
Optimize Response Handling
Add compression support
Optimize JSON serialization
Add proper cache headers
Testing & Monitoring
Test cache hit rates
Monitor response times
Track API quota usage