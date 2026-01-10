---
description: Betting insights algorithm and ML implementation guidelines
alwaysApply: true
---

# Betting Insights Algorithm Principles

**📋 Note:** When implementing betting insights features in the backend, you MUST also read `.cursor/rules/architecture-rules.mdc` to understand the backend structure and follow the architecture guidelines (module organization, caching strategies, API development patterns, etc.).

## Core Rules (Full Details: docs/betting-insights-Algorithm.md)

**You MUST read `docs/betting-insights-Algorithm.md` when:**

## Implementation Plans (Week-by-Week Phases)

**You MUST consult `docs/implementation-plan/` when:**

**⚠️ IMPORTANT:** The implementation plan files reference specific line numbers in `docs/betting-insights-Algorithm.md`. **Whenever the original algorithm document is modified, you MUST update the line number references in the corresponding implementation plan phase files** to ensure they point to the correct sections.

### Week-by-Week Implementation Phases

- **Phase 1 (Core Data Layer)** - See `docs/implementation-plan/phase1.md`
  - Implementing data fetching and caching
  - Building stats calculation functions
  - Setting up the foundation data layer
  - Creating helper functions for data processing

- **Phase 2 (Pattern Detection)** - See `docs/implementation-plan/phase2.md`
  - Implementing automatic pattern detection
  - Building team pattern analysis
  - Creating H2H pattern analysis
  - Setting up pattern matching systems

- **Phase 3 (Insight Generation)** - See `docs/implementation-plan/phase3.md`
  - Converting patterns to human-readable insights
  - Building template-based insight generation
  - Creating insight formatting systems

- **Phase 3.5 (Match Type Detection)** - See `docs/implementation-plan/phase3.5.md`
  - Implementing match type detection (league, cup, international)
  - Building match type-specific weight adjustments
  - Creating neutral venue detection
  - Implementing derby/rivalry detection
  - Handling post-international break effects
  - Building end-of-season dynamics
  - Applying league-specific characteristics

- **Phase 4 (Market Predictions)** - See `docs/implementation-plan/phase4.md`
  - Implementing BTTS prediction logic
  - Building Over/Under 2.5 prediction
  - Creating Match Result (1X2) prediction
  - Implementing First Half prediction
  - Building alternative bet suggestions

- **Phase 4.5 (Probability Swing Caps)** - See `docs/implementation-plan/phase4.5.md`
  - Implementing hard probability swing caps
  - Building confidence downgrade on large swings
  - Creating asymmetric weighting systems
  - Implementing Kelly-aware confidence
  - Setting up production monitoring

- **Phase 4.6 (Algorithm Refinements)** - See `docs/implementation-plan/phase4.6.md`
  - Refining match result predictions
  - Integrating rest advantage calculations
  - Applying opponent quality weighting
  - Implementing weighted scoring rates
  - Building fixture congestion features

- **Phase 5 (API Endpoint)** - See `docs/implementation-plan/phase5.md`
  - Building main API endpoint
  - Designing response structure
  - Implementing caching strategy
  - Setting up endpoint validation

### ML Model Training Phases

- **ML Phase 1 (Historical Data Integration)** - See `docs/implementation-plan/ml-phase1.md`
  - Setting up data acquisition pipelines
  - Implementing team name standardization
  - Building feature engineering pipelines
  - Creating Mind/Mood/DNA layer features
  - Setting up data quality assessment

- **ML Phase 2 (Model Development)** - See `docs/implementation-plan/ml-phase2.md`
  - Selecting target variables for training
  - Choosing and training ML models
  - Implementing Optuna hyperparameter tuning
  - Setting up model evaluation metrics
  - Handling class imbalance
  - Implementing model calibration

- **ML Phase 3 (ML Integration)** - See `docs/implementation-plan/ml-phase3.md`
  - Designing ML integration architecture
  - Analyzing feature importance
  - Setting up model retraining schedules
  - Implementing concept drift detection

- **ML Phase 4 (Backtesting & Validation)** - See `docs/implementation-plan/ml-phase4.md`
  - Building validation frameworks
  - Setting up backtesting systems
  - Implementing edge case testing
  - Creating monitoring and enforcement systems

- **ML Phase 5 (Advanced Features)** - See `docs/implementation-plan/ml-phase5.md`
  - Implementing advanced ML features
  - Building market-specific models
  - Setting up real-time model updates

- **ML Phase 6 (Risk Management)** - See `docs/implementation-plan/ml-phase6.md`
  - Implementing prediction confidence intervals
  - Building risk-adjusted predictions
  - Setting up model monitoring and alerting

### Implementation Planning

- Understanding the week-by-week implementation roadmap
- Planning feature implementation order
- Understanding phase dependencies
- Breaking down large features into sub-tasks
- Following the implementation checklist for each phase
- Understanding validation criteria for each phase
- Tracking implementation progress

### Data Acquisition & Cleaning

- Working with historical datasets (GitHub Club-Football-Match-Data)
- Implementing team name standardization and mapping
- Building data cleaning pipelines
- Handling missing data (NaNs) - imputation strategies
- Validating data integrity (impossible scores, future dates, duplicates)
- Converting dates and handling timezone issues
- Filtering to major leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Portuguese League, Eredivisie)
- Standardizing team names across different data sources (GitHub vs API-Football)
- Building automated team name mapping systems
- Handling team name variations and historical name changes

### Feature Engineering

- Calculating form statistics (last 5, 10, 20 matches)
- Implementing opponent-adjusted rate stats
- Building Mind/Mood/DNA layer features
- Creating match context features
- Implementing probabilistic safety flags
- Calculating weighted scoring rates
- Building fixture congestion features
- Implementing rest advantage calculations
- Creating opponent quality weighting systems
- Understanding feature importance and selection

### Machine Learning Development

- Selecting target variables for ML training
- Choosing ML models (classification, regression)
- Implementing hyperparameter tuning with Optuna
- Setting up model evaluation metrics
- Handling class imbalance in training data
- Implementing model calibration
- Understanding realistic accuracy expectations (60-70% for BTTS, not 90%)
- Building model training pipelines
- Implementing feature scaling and normalization
- Understanding when ML is appropriate vs rule-based approaches

### Algorithm Layers (Mind, Mood, DNA)

- Implementing the Mind layer (50 matches baseline quality)
- Implementing the Mood layer (10 matches recent momentum)
- Implementing the DNA layer (season statistics)
- Calculating Efficiency Index (EI) for team tier categorization
- Categorizing teams into tiers (1-4) based on baseline quality
- Detecting "Sleeping Giant" patterns (Mind Tier 1, Mood Tier 4)
- Detecting "Over-performer" patterns (Mind Tier 4, Mood Tier 1)
- Understanding the 30% weight for recent form (Mood)
- Using season stats for market-specific predictions (DNA)
- Implementing the "Mood vs. Mind" gap analysis for value detection

### Market-Specific Predictions

- Implementing BTTS (Both Teams to Score) predictions
- Implementing Over/Under 2.5 Goals predictions
- Implementing Match Result (1X2) predictions
- Implementing First Half Result predictions
- Understanding factor relevance by market type
- Applying market-specific feature weights
- Understanding why BTTS has higher accuracy (65-75%) than 1X2 (50-60%)
- Building market-specific confidence calculations
- Implementing market-specific safety flags

### Match Context & Adjustments

- Detecting match type (cup vs league matches)
- Implementing neutral venue detection for domestic matches
- Detecting derby/rivalry matches
- Handling post-international break effects
- Implementing end-of-season specific dynamics
- Applying league-specific characteristics and adjustments
- Handling international match contexts
- Detecting fixture congestion and its impact
- Understanding motivation clashes (title race vs mid-table)
- Implementing match type weight adjustments

### Probability & Confidence

- Implementing probability swing caps (hard caps on probability changes)
- Building asymmetric weighting systems
- Implementing confidence downgrades on large probability swings
- Calculating Kelly-aware confidence scores
- Building risk-adjusted predictions
- Understanding when to cap probability swings vs allow them
- Implementing unified helper functions for probability adjustments
- Setting up production monitoring for probability swings
- Understanding launch safety thresholds

### Data Quality & Anomaly Detection

- Implementing automated anomaly detection
- Handling promoted teams (insufficient historical data)
- Handling new teams (no historical data)
- Detecting "one-season wonder" patterns
- Implementing edge case handling strategies
- Building fallback strategies for data quality issues
- Validating data quality before predictions
- Handling regression risk scenarios
- Detecting data quality flags and warnings

### Backtesting & Validation

- Setting up backtesting frameworks
- Building validation frameworks for rule-based adjustments
- Implementing edge case testing
- Setting up monitoring and enforcement systems
- Validating algorithm changes before production
- Understanding backtesting best practices
- Testing adjustment interactions
- Building historical accuracy tracking

### Model Retraining & Updates

- Setting up model retraining schedules
- Implementing concept drift detection
- Analyzing feature importance over time
- Implementing real-time model updates
- Understanding when to retrain models
- Building retraining pipelines
- Handling model versioning
- Monitoring model performance degradation

### Risk Management

- Implementing prediction confidence intervals
- Building risk-adjusted predictions
- Setting up model monitoring and alerting
- Understanding confidence levels (HIGH/MEDIUM/LOW)
- Implementing risk flags and warnings
- Building production monitoring dashboards
- Setting up auto-correction mechanisms
- Understanding when to reduce confidence vs reject predictions

### API Integration

- Integrating with API-Football endpoints
- Fetching head-to-head (H2H) data
- Using team statistics endpoints
- Processing fixture data for predictions
- Understanding which endpoints to use for production vs training
- Implementing efficient API data fetching
- Handling API rate limits and quotas
- Caching API responses appropriately
- Understanding when team name mapping is needed (retraining) vs not needed (production)

### Algorithm Refinements

- Implementing match result prediction refinements
- Integrating rest advantage calculations
- Applying opponent quality weighting
- Implementing weighted scoring rates
- Understanding fixture congestion impact
- Building algorithm improvement pipelines
- Testing algorithm refinements before deployment
- Understanding priority levels for different refinements

### Transparency & User Communication

- Displaying confidence levels to users
- Showing the math behind predictions (transparency)
- Admitting uncertainty when appropriate
- Displaying conflicting signals
- Building educational explanations ("here's WHY")
- Setting realistic accuracy expectations (not claiming 80-90%)
- Tracking and displaying accuracy over time
- Building trust through transparency
