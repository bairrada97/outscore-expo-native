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

Implementation Pattern: KV-Based Distributed Lock with Idempotency

1. Distributed Lock Pattern (KV-based):
   - Lock Key Format: `transition:lock:{date}:{fromLocation}:{toLocation}`
   - Lock Value: `{workerId}:{timestamp}` (identifies lock holder)
   - Lock TTL: 300s (5 minutes) - auto-expires if worker crashes
   - Check-Before-Set Semantics:
     ```
     currentLock = await kv.get(lockKey)
     if (currentLock !== null) {
       // Another worker is handling this transition
       return { success: false, reason: 'LOCKED' }
     }
     await kv.put(lockKey, lockValue, { expirationTtl: 300 })
     ```

2. Idempotency Key Pattern:
   - Idempotency Key Format: `transition:op:{date}:{fromLocation}:{toLocation}:{operationId}`
   - Operation ID: UUID v4 or timestamp-based unique identifier
   - Value: `{status: 'in_progress'|'completed'|'failed', startedAt, completedAt, error?}`
   - Purpose: Prevent duplicate transitions if same operation retries
   - Check before starting: If idempotency key exists with status 'completed', skip operation

3. Atomic Transition Operation Steps (Pseudo-code):

   ```
   async function transitionDate(date, fromLocation, toLocation, r2Bucket, kv, edgeCache) {
     const lockKey = `transition:lock:${date}:${fromLocation}:${toLocation}`
     const operationId = generateUUID()
     const idempotencyKey = `transition:op:${date}:${fromLocation}:${toLocation}:${operationId}`
     const workerId = `${env.WORKER_ID || 'unknown'}:${Date.now()}`
     const maxRetries = 3
     let attempt = 0
     
     // Step 1: Acquire distributed lock (with check-before-set)
     const currentLock = await kv.get(lockKey)
     if (currentLock !== null) {
       return { success: false, reason: 'LOCKED', message: 'Another worker is handling this transition' }
     }
     
     try {
       await kv.put(lockKey, workerId, { expirationTtl: 300 })
       
       // Step 2: Check idempotency key (prevent duplicate operations)
       const existingOp = await kv.get(idempotencyKey)
       if (existingOp?.status === 'completed') {
         return { success: true, reason: 'IDEMPOTENT', message: 'Operation already completed' }
       }
       
       // Step 3: Create idempotency key with 'in_progress' status
       await kv.put(idempotencyKey, JSON.stringify({
         status: 'in_progress',
         startedAt: new Date().toISOString(),
         workerId
       }), { expirationTtl: 600 })
       
       // Step 4: HEAD-verify source exists before copy
       const sourceKey = `${fromLocation}/fixtures-${date}.json`
       const sourceHead = await r2Bucket.head(sourceKey)
       if (!sourceHead) {
         throw new Error(`Source ${sourceKey} does not exist`)
       }
       
       // Step 5: Perform R2 copy operation
       const destKey = `${toLocation}/fixtures-${date}.json`
       const sourceObject = await r2Bucket.get(sourceKey)
       if (!sourceObject) {
         throw new Error(`Failed to read source ${sourceKey}`)
       }
       
       const sourceData = await sourceObject.text()
       const sourceMetadata = sourceObject.customMetadata || {}
       
       await r2Bucket.put(destKey, sourceData, {
         httpMetadata: { contentType: 'application/json' },
         customMetadata: {
           ...sourceMetadata,
           movedAt: new Date().toISOString(),
           originalKey: sourceKey,
           transitionId: operationId
         }
       })
       
       // Step 6: HEAD-verify destination exists after copy
       const destHead = await r2Bucket.head(destKey)
       if (!destHead) {
         throw new Error(`Destination ${destKey} was not created`)
       }
       
       // Step 7: HEAD-verify source still exists before delete
       const sourceHeadBeforeDelete = await r2Bucket.head(sourceKey)
       if (!sourceHeadBeforeDelete) {
         // Source was already deleted - rollback: delete destination
         await r2Bucket.delete(destKey)
         throw new Error(`Source ${sourceKey} was deleted during transition`)
       }
       
       // Step 8: Delete source
       await r2Bucket.delete(sourceKey)
       
       // Step 9: Verify source deletion succeeded
       const sourceHeadAfterDelete = await r2Bucket.head(sourceKey)
       if (sourceHeadAfterDelete) {
         // Deletion failed - rollback: delete destination, retry source deletion
         await r2Bucket.delete(destKey)
         await r2Bucket.delete(sourceKey) // Retry deletion
         throw new Error(`Source ${sourceKey} still exists after delete`)
       }
       
       // Step 10: Clean up KV entries for old location
       await deleteKVEntriesForDate(kv, date) // Removes fixtures:{date} and fixtures:{date}:live
       
       // Step 11: Invalidate Edge Cache for all timezones
       const commonTimezones = ['UTC', 'Europe/Lisbon', 'America/New_York', 'Asia/Tokyo', ...]
       await invalidateEdgeCacheForDate(date, commonTimezones)
       
       // Step 12: Update idempotency key to 'completed'
       await kv.put(idempotencyKey, JSON.stringify({
         status: 'completed',
         startedAt: new Date().toISOString(),
         completedAt: new Date().toISOString(),
         workerId
       }), { expirationTtl: 86400 }) // Keep for 24h for audit
       
       // Step 13: Release lock (atomic cleanup)
       await kv.delete(lockKey)
       
       return { success: true, operationId }
       
     } catch (error) {
       // Compensating Rollback Actions:
       try {
         // Rollback 1: If copy succeeded but delete failed, delete destination
         const destHead = await r2Bucket.head(destKey)
         if (destHead) {
           await r2Bucket.delete(destKey)
           console.log(`[ROLLBACK] Deleted destination ${destKey} due to failed transition`)
         }
         
         // Rollback 2: Mark operation as failed in idempotency key
         await kv.put(idempotencyKey, JSON.stringify({
           status: 'failed',
           startedAt: new Date().toISOString(),
           failedAt: new Date().toISOString(),
           error: error.message,
           workerId
         }), { expirationTtl: 86400 })
         
         // Rollback 3: Schedule retry (store failed operation for later retry)
         const retryKey = `transition:retry:${date}:${fromLocation}:${toLocation}`
         await kv.put(retryKey, JSON.stringify({
           date,
           fromLocation,
           toLocation,
           operationId,
           failedAt: new Date().toISOString(),
           attempt: attempt + 1,
           maxRetries
         }), { expirationTtl: 3600 }) // Retry within 1 hour
         
       } finally {
         // Always release lock
         await kv.delete(lockKey)
       }
       
       // Exponential backoff retry on transient failures
       if (isTransientError(error) && attempt < maxRetries) {
         const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000) // Max 30s
         await sleep(backoffMs)
         attempt++
         return transitionDate(date, fromLocation, toLocation, r2Bucket, kv, edgeCache) // Retry
       }
       
       throw error
     }
   }
   
   // Helper: Check if error is transient (network, timeout, rate limit)
   function isTransientError(error) {
     return error.message.includes('timeout') ||
            error.message.includes('network') ||
            error.message.includes('rate limit') ||
            error.code === 'ECONNRESET'
   }
   ```

4. Retry Mechanism with Exponential Backoff:
   - Initial delay: 1s
   - Backoff multiplier: 2x per attempt
   - Max delay: 30s
   - Max retries: 3 attempts
   - Only retry on transient errors (network, timeout, rate limits)
   - Permanent errors (file not found, permission denied) fail immediately

5. Compensating Rollback Actions:
   - If copy succeeds but delete fails:
     → Delete newly created destination blob
     → Mark operation as failed in idempotency key
     → Schedule retry for later
   - If copy fails:
     → No rollback needed (destination doesn't exist)
     → Mark operation as failed
     → Retry with backoff
   - If verification fails:
     → Rollback destination if it exists
     → Retry entire operation

6. Atomic Cleanup Pattern:
   - After successful transition:
     → Delete lock key (KV)
     → Update idempotency key to 'completed' (KV)
     → Delete old location KV entries (fixtures:{date}, fixtures:{date}:live)
   - Use KV batch operations where possible for atomicity
   - If cleanup fails, log error but don't fail operation (idempotency key tracks completion)

7. Edge Cache Invalidation:
   - After successful R2 transition:
     → Generate edge cache keys for all common timezones
     → Delete both live and non-live entries per timezone
     → Pattern: `fixtures:{date}:{timezone}:{live}`
   - Common timezones to invalidate: UTC, Europe/Lisbon, America/New_York, Asia/Tokyo, Europe/London, etc.
   - Use parallel invalidation for performance

8. Verification Requirements:
   - HEAD check source before copy (prevents copying non-existent files)
   - HEAD check destination after copy (verifies copy succeeded)
   - HEAD check source before delete (ensures source still exists)
   - HEAD check source after delete (verifies deletion succeeded)
   - All HEAD checks are mandatory - fail fast if verification fails

9. Storage Layers Affected:
   - R2: Move files between folders (future → today → historical)
   - KV: Delete old location keys, manage locks and idempotency keys
   - Edge Cache: Invalidate all timezone-specific entries for transitioning date

10. Error Handling:
    - Transient errors: Retry with exponential backoff (max 3 attempts)
    - Permanent errors: Fail immediately, mark as failed, schedule manual review
    - Lock conflicts: Return immediately (another worker is handling it)
    - Idempotent operations: Return success if already completed

ADR Note: This implementation pattern ensures atomicity through distributed locks and idempotency keys. The pattern is designed to handle concurrent transitions across multiple Cloudflare Workers while preventing race conditions and ensuring data consistency. A minimal runnable example PR should implement the KV lock, idempotency key pattern, HEAD verification, retry/backoff, rollback compensations, and cleanup for reviewer validation.
Request Deduplication:

Track in-flight requests by cache key
Reuse promises for concurrent requests
Prevent duplicate API calls
9. Security & Rate Limiting
Inbound Rate Limiting:

Cloudflare Rate Limiter: 100 requests/60s per IP (primary defense)
Application-level: hono-rate-limiter with fixed window
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