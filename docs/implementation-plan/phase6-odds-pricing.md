# Phase 6: Odds Integration & Pricing (Future - Post-MVP)

## Overview

Phase 6 is a **deferred phase** that will add odds integration, value/edge computation, and market coherence constraints. This phase is explicitly **not part of the MVP** and is documented here to ensure the architecture remains ready for future implementation.

**Status:** DEFERRED (not blocking Phases 1-5)

## Why Deferred?

- MVP focuses on probability predictions and insights
- Odds integration requires a reliable odds feed at runtime
- Market coherence constraints add complexity not needed for initial launch
- Kelly/value features require odds data to be meaningful

## Future Scope

### 6.1 Odds Ingestion & Normalization

**Goal:** Ingest and normalize odds from external feed(s)

#### Sub-tasks:

1. **Odds Feed Integration**
   - Connect to odds provider API
   - Fetch pre-match odds for supported markets
   - Handle multiple bookmakers (if available)

2. **Odds Schema & Caching**
   - Define odds schema (decimal odds, implied probability)
   - Cache odds with appropriate TTL
   - Track odds timestamps for staleness detection

3. **De-Juicing (Remove Overround)**
   - Calculate implied probabilities from odds
   - Remove bookmaker margin (overround)
   - Compute "fair" implied probabilities

#### Key Interfaces (Draft):

```typescript
interface OddsData {
  fixtureId: number;
  market: 'MATCH_RESULT' | 'BTTS' | 'OVER_2_5' | string;
  bookmaker?: string;
  odds: {
    home?: number; // Decimal odds
    draw?: number;
    away?: number;
    yes?: number;
    no?: number;
  };
  impliedProbabilities: {
    home?: number;
    draw?: number;
    away?: number;
    yes?: number;
    no?: number;
  };
  overround: number; // e.g., 1.05 = 5% margin
  fairProbabilities: {
    home?: number;
    draw?: number;
    away?: number;
    yes?: number;
    no?: number;
  };
  timestamp: string;
  isStale: boolean;
}
```

---

### 6.2 Value & Edge Computation

**Goal:** Calculate value (edge) by comparing model probabilities to market odds

#### Sub-tasks:

1. **Edge Calculation**
   - Edge = modelProbability - fairImpliedProbability
   - Positive edge = potential value bet
   - Negative edge = avoid or skip

2. **Expected Value (EV)**
   - EV = (modelProbability × odds) - 1
   - Only recommend bets with positive EV

3. **Kelly Criterion Integration**
   - Calculate optimal bet size: `f* = (p × b - q) / b`
   - Apply fractional Kelly (e.g., 0.25x-0.5x) for safety
   - Integrate with Phase 4.5 Kelly-aware confidence

4. **Value Thresholds**
   - HIGH confidence: edge > 5%
   - MEDIUM confidence: edge 2-5%
   - LOW confidence: edge < 2%
   - SKIP: negative edge or insufficient data

#### Key Interfaces (Draft):

```typescript
interface ValueAnalysis {
  market: string;
  modelProbability: number;
  fairImpliedProbability: number;
  edge: number; // modelProb - fairImplied
  expectedValue: number; // (modelProb × odds) - 1
  kellyFraction: number;
  recommendedBetSize: number; // Fraction of bankroll
  recommendation: 'BET' | 'SKIP' | 'AVOID';
  confidenceAdjustment: 'UPGRADE' | 'MAINTAIN' | 'DOWNGRADE';
}
```

---

### 6.3 Market Coherence Constraints

**Goal:** Ensure predictions across markets are internally consistent (no arbitrage)

#### Sub-tasks:

1. **Define Coherence Constraints**
   - 1X2 probabilities must sum to 100%
   - BTTS YES + BTTS NO must sum to 100%
   - Over 2.5 + Under 2.5 must sum to 100%
   - Cross-market: BTTS probability should be consistent with goal expectations

2. **Constraint Validation**
   - After raw predictions, check for constraint violations
   - Log violations with severity

3. **Coherence Adjustment Layer**
   - Minimal adjustment to satisfy constraints
   - Minimize KL divergence or L2 distance from raw probabilities
   - Apply bounds (never exceed 80% or below 20%)

4. **Arbitrage Detection**
   - Detect internal arbitrage opportunities (shouldn't exist)
   - Alert if detected (indicates model error)

---

### 6.4 Offered Odds Generation (Optional)

**Goal:** Convert fair probabilities to offered odds with configurable margin

#### Sub-tasks:

1. **Margin Application**
   - Apply configurable overround per market/league
   - Example: 5% margin → divide fair prob by 1.05

2. **Odds Formatting**
   - Convert to decimal odds
   - Round to standard odds increments

**Note:** This is only needed if Outscore becomes a pricing engine, not just an insights product.

---

### 6.5 Odds Staleness & Fallback

**Goal:** Handle stale odds and feed failures gracefully

#### Sub-tasks:

1. **Staleness Detection**
   - Define staleness threshold (e.g., odds > 30 min old)
   - Flag stale odds in response

2. **Fallback Behavior**
   - If odds unavailable: disable value/edge features, show predictions only
   - If odds stale: downgrade confidence, show warning

---

## Integration Points

- **Phase 4.5:** Kelly-aware confidence already exists; odds data enables it
- **Phase 5:** API response can include value/edge fields when odds available
- **ML Phase 6:** Risk-adjusted predictions can use real odds

## Dependencies

- Reliable odds feed provider
- Phases 1-5 complete (MVP stable)

## Architecture Readiness

The following should be kept in mind during MVP development to ease future odds integration:

1. **Response structure:** Reserve fields for future value/edge data in Phase 5 response
2. **Configuration:** Keep Kelly thresholds configurable even if not used
3. **Adjustment system:** Phase 4.5 unified helper should support odds-aware adjustments
4. **Caching:** Design cache keys to accommodate odds versioning

## Implementation Checklist (Future)

### Odds Ingestion
- [ ] Select odds feed provider
- [ ] Implement odds fetch and caching
- [ ] Implement de-juicing logic
- [ ] Handle multiple bookmakers

### Value Computation
- [ ] Implement edge calculation
- [ ] Implement EV calculation
- [ ] Integrate Kelly Criterion
- [ ] Define value thresholds

### Market Coherence
- [ ] Define coherence constraints
- [ ] Implement constraint validation
- [ ] Implement coherence adjustment layer
- [ ] Implement arbitrage detection

### Testing
- [ ] Unit tests for de-juicing
- [ ] Unit tests for value calculation
- [ ] Unit tests for coherence constraints
- [ ] Integration tests with real odds

---

## Notes

- This phase is explicitly **post-MVP**
- Architecture should remain ready but implementation is deferred
- When implementing, start with Phase 6.1-6.2 (odds + value), then 6.3 (coherence)
- Phase 6.4 (offered odds) is only needed for bookmaker-style pricing

