# Atomic Date Transition Implementation

This module implements the atomic date transition pattern described in `.cursor/backend-architecture-plan.md` section "Date Transition Management".

## Purpose

This is a **minimal runnable example** for reviewer validation. It demonstrates:

1. ✅ KV-based distributed lock with check-before-set semantics
2. ✅ Idempotency key pattern to prevent duplicate operations
3. ✅ HEAD verification before/after all R2 operations
4. ✅ Exponential backoff retry on transient failures
5. ✅ Compensating rollback actions on failure
6. ✅ Atomic cleanup of KV entries (lock + idempotency key)
7. ✅ Edge cache invalidation for all timezones

## Implementation Pattern

The `atomicTransitionDate` function implements a 13-step atomic operation:

1. **Acquire distributed lock** - Prevents concurrent transitions
2. **Check idempotency key** - Prevents duplicate operations
3. **Create idempotency key** - Track operation status
4. **HEAD-verify source exists** - Before copy
5. **Perform R2 copy** - Copy file to destination
6. **HEAD-verify destination exists** - After copy
7. **HEAD-verify source still exists** - Before delete
8. **Delete source** - Remove from old location
9. **Verify source deletion** - Confirm deletion succeeded
10. **Clean up KV entries** - Remove old location keys
11. **Invalidate Edge Cache** - Clear timezone-specific caches
12. **Update idempotency key** - Mark as completed
13. **Release lock** - Atomic cleanup

## Error Handling

- **Transient errors**: Retried with exponential backoff (max 3 attempts, max delay 30s)
- **Permanent errors**: Fail immediately, perform rollback, mark as failed
- **Lock conflicts**: Return immediately (another worker is handling it)
- **Idempotent operations**: Return success if already completed

## Rollback Actions

On failure, the system performs compensating rollback:

1. Delete destination blob if copy succeeded but delete failed
2. Mark operation as failed in idempotency key
3. Schedule retry (optional - could be handled by external scheduler)
4. Always release lock

## Usage Example

```typescript
import { atomicTransitionDate } from './atomic-transition';
import { commonTimezones } from '../timezones';

const result = await atomicTransitionDate(
  '2026-01-15',
  'future',
  'today',
  {
    FOOTBALL_KV: env.FOOTBALL_KV,
    FOOTBALL_CACHE: env.FOOTBALL_CACHE,
    WORKER_ID: env.WORKER_ID,
  },
  commonTimezones
);

if (result.success) {
  console.log(`Transition completed: ${result.operationId}`);
} else {
  console.error(`Transition failed: ${result.reason} - ${result.message}`);
}
```

## Testing

To validate correctness:

1. Test concurrent transitions (multiple workers)
2. Test idempotency (same operation twice)
3. Test failure scenarios (network errors, missing files)
4. Test rollback (verify destination deleted on failure)
5. Test retry logic (transient errors)
6. Test lock expiration (worker crash simulation)

## Integration

This module can replace the existing `handleFixturesDateTransition` function in `fixtures-strategy.ts` once validated. The existing function lacks atomicity guarantees and proper error handling.

## ADR Note

This implementation pattern ensures atomicity through distributed locks and idempotency keys. The pattern is designed to handle concurrent transitions across multiple Cloudflare Workers while preventing race conditions and ensuring data consistency.

