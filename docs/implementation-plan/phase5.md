# Phase 5: API Endpoint (Week 3)

**Reference:** See "Phase 5: API Endpoint" section in `betting-insights-algorithm.md`

## Overview

Phase 5 implements the main API endpoint that exposes betting insights predictions. This phase integrates all previous phases into a single, well-structured API endpoint with proper caching, error handling, and response formatting.

## Dependencies

- **Phase 1:** Core Data Layer (Data fetching)
- **Phase 2:** Pattern Detection (Patterns)
- **Phase 3:** Insight Generation (Insights)
- **Phase 3.5:** Match Type Detection (Match type)
- **Phase 4:** Market Predictions (Predictions)
- **Phase 4.5:** Probability Caps (Caps)
- **Phase 4.6:** Algorithm Refinements (Refinements)

## Sub-Phases

### 5.1 API Route Implementation

**Reference:** See "5.1 API Route Implementation" in `betting-insights-algorithm.md`

**Goal:** Create main API endpoint for betting insights

#### Sub-tasks:

1. **Route Handler**
   - Create `/api/fixtures/:fixtureId/insights` endpoint
   - Validate fixtureId parameter
   - Handle errors gracefully

2. **Match Details Fetching**
   - Fetch match details from API-Football
   - Handle match not found
   - Extract match context (round, league, formations)

3. **Match Type Detection**
   - Detect match type (league, cup, international, friendly)
   - Get domestic leagues for international matches
   - Apply match type context

4. **Team Data Fetching**
   - Fetch home team data
   - Fetch away team data
   - Fetch H2H data
   - Use domestic league context for international matches

5. **Pattern Detection**
   - Detect patterns for home team
   - Detect patterns for away team
   - Detect H2H patterns

6. **Insight Generation**
   - Generate insights for home team
   - Generate insights for away team
   - Generate H2H insights

7. **Market Predictions**
   - Generate BTTS prediction
   - Generate Over 2.5 prediction
   - Generate Match Result prediction
   - Generate First Half prediction

8. **Response Building**
   - Build structured response
   - Include match context
   - Include team context
   - Include predictions
   - Include insights

#### Files to Create:

- `apps/backend/src/modules/betting-insights/routes/insights.routes.ts` - Route handler
- `apps/backend/src/modules/betting-insights/services/insights.service.ts` - Business logic
- `apps/backend/src/modules/betting-insights/types.ts` - Add API response types
- Extend `apps/backend/src/modules/betting-insights/index.ts` - Export routes

#### Validation Criteria:

- ✅ Route handler works correctly
- ✅ Match details fetched correctly
- ✅ Match type detected correctly
- ✅ Team data fetched correctly
- ✅ Patterns detected correctly
- ✅ Insights generated correctly
- ✅ Predictions generated correctly
- ✅ Response structure is correct

---

### 5.2 Caching Strategy

**Reference:** See "API Endpoint & Caching" section in `betting-insights-algorithm.md`

**Goal:** Implement caching for insights endpoint, reusing the existing fixtures TTL/invalidation behavior

#### Sub-tasks:

1. **Cache Key Generation**
   - Generate cache key: `insights:${fixtureId}`
   - Namespace for insights but follow fixtures conventions

2. **Cache Check**
   - Check Edge Cache first
   - Check R2 storage if Edge Cache miss
   - Return cached response if valid

3. **Cache Storage & TTL (Reuse Fixtures Behavior)**
   - **Reuse the same TTL strategy already implemented for fixture detail endpoints** (see `fixtures.routes.ts`)
   - TTL varies by fixture status:
     - **Live matches:** short cache (15s max-age, 30s SWR)
     - **Finished matches:** long cache (7 days)
     - **45 min before kickoff:** short cache (15s) for lineups
     - **8 hours before:** 1 hour cache
     - **7 days before:** 6 hour cache
     - **Further future:** 24 hour cache
   - Use stale-while-revalidate pattern

4. **Cache Invalidation (Reuse Fixtures Behavior)**
   - Invalidation follows the same triggers as fixtures:
     - Match state transitions (scheduled → live → finished)
     - Significant updates (lineups, events)
   - No custom invalidation logic needed—rely on TTL expiry

#### Files to Create:

- `apps/backend/src/modules/betting-insights/cache/insights-cache.ts` - Caching logic (wraps existing patterns)
- Extend `apps/backend/src/modules/cache/cache-strategies.ts` - Add insights strategy (if needed)

#### Validation Criteria:

- ✅ Cache keys generated correctly with `insights:` namespace
- ✅ Cache check works correctly
- ✅ Cache storage works correctly
- ✅ **TTLs match existing fixtures behavior** (no custom TTL scheme)
- ✅ Stale-while-revalidate works
- ✅ Cache headers follow same pattern as fixtures routes

---

### 5.3 Response Structure

**Reference:** See "5.3 Response Structure" in `betting-insights-algorithm.md`

**Goal:** Define and implement response structure

#### Sub-tasks:

1. **Match Information**
   - Match ID, teams, date, league
   - Match status and context

2. **Team Context**
   - Home team: form, position, days since last match, motivation, Mind/Mood/DNA
   - Away team: form, position, days since last match, motivation, Mind/Mood/DNA

3. **Match Context**
   - Round, early season flag, formations, formation stability
   - H2H match count, safety flags

4. **Predictions**
   - All market predictions with probabilities, confidence, insights
   - Alternative bet suggestions

5. **Insights**
   - Top 5 home team insights
   - Top 5 away team insights
   - Top 3 H2H insights

6. **Metadata**
   - Generated timestamp
   - Overall confidence
   - Cache source

#### Files to Create:

- `apps/backend/src/modules/betting-insights/types.ts` - Add InsightsResponse interface
- `apps/backend/src/modules/betting-insights/utils/response-builder.ts` - Response building logic

#### Validation Criteria:

- ✅ Response structure matches specification
- ✅ All required fields included
- ✅ Optional fields handled correctly
- ✅ Data types are correct
- ✅ Response is JSON-serializable

---

### 5.4 Error Handling

**Goal:** Implement comprehensive error handling

#### Sub-tasks:

1. **Match Not Found**
   - Return 404 with appropriate message
   - Log error

2. **API Errors**
   - Handle API-Football errors
   - Return 502 with appropriate message
   - Log error with context

3. **Data Errors**
   - Handle missing data gracefully
   - Return partial response if possible
   - Log warnings

4. **Validation Errors**
   - Validate fixtureId format
   - Return 400 for invalid input
   - Provide helpful error messages

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/error-handler.ts` - Error handling logic
- Extend route handler with error middleware

#### Validation Criteria:

- ✅ Match not found returns 404
- ✅ API errors return 502
- ✅ Data errors handled gracefully
- ✅ Validation errors return 400
- ✅ Error messages are helpful
- ✅ Errors are logged correctly

---

### 5.5 Response Headers

**Goal:** Set appropriate response headers

#### Sub-tasks:

1. **Cache Headers**
   - Set Cache-Control header
   - Set CDN-Cache-Control header
   - Set appropriate max-age

2. **Content Headers**
   - Set Content-Type: application/json
   - Set appropriate charset

3. **Custom Headers**
   - Set X-Source header (cache layer)
   - Set X-Response-Time header
   - Set X-Generated-At header

#### Files to Create:

- Extend route handler to set headers
- Use existing header utilities from fixtures module

#### Validation Criteria:

- ✅ Cache headers set correctly
- ✅ Content headers set correctly
- ✅ Custom headers set correctly
- ✅ Headers follow existing patterns

---

## Key Data Structures

### InsightsResponse Interface

```typescript
interface InsightsResponse {
  match: {
    fixtureId: string;
    homeTeam: string;
    awayTeam: string;
    date: string;
    league: {
      id: number;
      name: string;
      round?: string;
    };
  };
  context: {
    homeTeam: {
      form: string;
      position: number;
      daysSinceLastMatch: number;
      motivation: string;
      mind: {
        efficiencyIndex: number;
        tier: 1 | 2 | 3 | 4;
      };
      mood: {
        tier: 1 | 2 | 3 | 4;
        isSleepingGiant: boolean;
        isOverPerformer: boolean;
      };
      dna: {
        mostPlayedFormation: string;
        under25Percentage: number;
        lateStarter: boolean;
      };
    };
    awayTeam: { /* same structure */ };
    match: {
      round?: string;
      earlySeason: boolean;
      homeFormation?: string;
      awayFormation?: string;
      formationStability: {
        home: FormationStability;
        away: FormationStability;
      };
    };
    h2h: {
      matchCount: number;
      isLimited: boolean;
    };
    safetyFlags: {
      home: SafetyFlags;
      away: SafetyFlags;
    };
  };
  predictions: MarketPrediction[];
  insights: {
    home: Insight[];
    away: Insight[];
    h2h: Insight[];
  };
  meta: {
    generatedAt: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    source: 'Edge Cache' | 'R2' | 'API';
    // Versioning for traceability (see Acceptance Gates section)
    algorithmVersion: string;
    weightsVersion: string;
    configHash: string;
  };
}
```

## Implementation Checklist

### API Route Implementation
- [ ] Create route handler
- [ ] Implement match details fetching
- [ ] Implement match type detection
- [ ] Implement team data fetching
- [ ] Implement pattern detection
- [ ] Implement insight generation
- [ ] Implement market predictions
- [ ] Implement response building

### Caching Strategy
- [ ] Implement cache key generation
- [ ] Implement cache check
- [ ] Implement cache storage
- [ ] Implement cache invalidation
- [ ] Test cache hit/miss scenarios

### Response Structure
- [ ] Define InsightsResponse interface
- [ ] Implement response builder
- [ ] Include all required fields
- [ ] Handle optional fields
- [ ] Test response structure

### Error Handling
- [ ] Implement match not found handling
- [ ] Implement API error handling
- [ ] Implement data error handling
- [ ] Implement validation error handling
- [ ] Test error scenarios

### Response Headers
- [ ] Set cache headers
- [ ] Set content headers
- [ ] Set custom headers
- [ ] Test headers

### Integration
- [ ] Integrate with existing Hono app
- [ ] Add route to main index.ts
- [ ] Test end-to-end flow
- [ ] Test with real match IDs
- [ ] Performance testing

### Testing
- [ ] Unit tests for route handler
- [ ] Unit tests for service logic
- [ ] Unit tests for response builder
- [ ] Integration tests for full flow
- [ ] Test caching behavior
- [ ] Test error scenarios
- [ ] Test with various match types
- [ ] Test with international matches
- [ ] Performance tests

## Acceptance Gates (Launch Readiness)

Before launching the insights endpoint, the following criteria must be met:

### Versioning & Traceability

The API response `meta` object must include:

```typescript
meta: {
  generatedAt: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: 'Edge Cache' | 'R2' | 'API';
  // NEW: Versioning fields for traceability
  algorithmVersion: string;    // e.g., "1.0.0" - bump on logic changes
  weightsVersion: string;      // e.g., "2024-01-10" - bump on ML weight updates
  configHash: string;          // Short hash of algorithm config for debugging
}
```

### Performance Gates
- [ ] **Cached response < 100ms (p95)**
- [ ] **Uncached response < 500ms (p95)**
- [ ] **Cache hit rate > 80%** (after warm-up period)
- [ ] **Error rate < 1%**

### Calibration Gates (Per-Market)
- [ ] **Brier Score meets Phase 4 baseline** - No degradation from capping/adjustments
- [ ] **ECE < 0.10** - Well-calibrated probabilities
- [ ] **League-stratified validation** - Top 5 leagues must pass individually (prevent "global average looks fine" while one league is broken)

### Data Quality Gates
- [ ] **Missing data handling tested** - Endpoint returns partial response or appropriate error
- [ ] **API-Football failure handling tested** - Graceful degradation on upstream errors
- [ ] **Rate limit handling tested** - 429 returned appropriately

### Monitoring & Kill-Switch
- [ ] **Logging enabled** - All predictions logged with fixtureId, predictions, adjustments
- [ ] **Metrics endpoint available** - Brier score, ECE, cap-hit rate, error rate
- [ ] **Kill-switch documented** - Procedure to disable insights endpoint without affecting fixtures

## Notes

- Follow existing backend architecture patterns (similar to fixtures module)
- Use existing cache infrastructure (Edge Cache, R2)
- Use existing error handling patterns
- Response structure should be comprehensive but not overwhelming
- **Caching reuses the existing fixtures TTL/invalidation behavior** (see `fixtures.routes.ts` for reference)
- No custom TTL scheme—insights inherits the same status-aware caching as fixture detail
- Error handling should be graceful and informative
- Response headers should follow existing patterns (X-Source, Cache-Control, etc.)
- Integration with existing Hono app should be seamless
- Performance target: <100ms for cached responses, <500ms for uncached

## API Endpoint Specification

### GET /api/fixtures/:fixtureId/insights

**Parameters:**
- `fixtureId` (path): Fixture ID from API-Football (consistent with existing fixtures endpoint vocabulary)

**Response:**
- 200: InsightsResponse
- 404: Fixture not found
- 400: Invalid fixtureId
- 502: API error

**Example Request:**
```
GET /api/fixtures/1234567/insights
```

**Example Response:**
```json
{
  "match": {
    "fixtureId": "1234567",
    "homeTeam": "Manchester United",
    "awayTeam": "Liverpool",
    "date": "2026-01-03",
    "league": {
      "id": 39,
      "name": "Premier League",
      "round": "Regular Season - 20"
    }
  },
  "context": { /* ... */ },
  "predictions": [ /* ... */ ],
  "insights": { /* ... */ },
  "meta": {
    "generatedAt": "2026-01-03T12:00:00.000Z",
    "confidence": "HIGH",
    "source": "Edge Cache",
    "algorithmVersion": "1.0.0",
    "weightsVersion": "2026-01-01",
    "configHash": "a1b2c3d4"
  }
}
```

