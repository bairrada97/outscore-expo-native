# ML Phase 5: Advanced Features (Future Enhancements)

**Reference:** See "ML Phase 5" sections (5.1-5.3) in `betting-insights-algorithm.md`

## Overview

ML Phase 5 covers advanced features and enhancements that can be added after the core ML system is deployed. These features may improve accuracy by 1-5% but are not critical for initial launch.

## Dependencies

- **ML Phase 2:** Machine Learning Model Development (Core models working)
- **ML Phase 4:** Backtesting & Validation (Validation framework in place)

## Sub-Phases

### ML 5.1 Additional Features to Consider

**Reference:** See "5.1 Additional Features" in `betting-insights-algorithm.md`

**Goal:** Add additional features that may improve model accuracy

#### Sub-tasks:

1. **Manager Change Detection**
   - Track manager changes
   - Add feature: `DaysSinceManagerChange`
   - Add feature: `ManagerWinRate`
   - Retrain model when manager changes detected

2. **Injury Proxy Features** (Medium Priority)
   - Use squad rotation patterns as injury proxy
   - Track key player minutes (if available)
   - Add feature: `KeyPlayerRestDays`
   - Consider API integration for injury data

3. **Weather Proxy** (Medium Priority)
   - Use historical weather data via API
   - Or: Use time of year as proxy
   - Add features: `Temperature`, `Precipitation`, `WindSpeed`
   - Impact: May improve accuracy by 1-2% in extreme weather

4. **Referee Patterns**
   - Track referee historical patterns (if data available)
   - Add features: `RefereeAvgCards`, `RefereeAvgGoals`

5. **Fixture Congestion**
   - Track matches played in last 7/14/21 days
   - Add features: `MatchesInLast7Days`, `FixtureCongestionScore`

#### Files to Create:

- `ml/features/manager-features.py` - Manager change features
- `ml/features/injury-proxy-features.py` - Injury proxy features
- `ml/features/weather-features.py` - Weather features
- `ml/features/referee-features.py` - Referee features
- `ml/features/fixture-congestion-features.py` - Fixture congestion features

#### Validation Criteria:

- ✅ Features engineered correctly
- ✅ Features improve model accuracy
- ✅ Features validated through backtesting
- ✅ Impact measured (1-2% improvement)

---

### ML 5.2 Market-Specific Models

**Reference:** See "5.2 Market-Specific Models" in `betting-insights-algorithm.md`

**Goal:** Train separate models per league for improved accuracy

#### Sub-tasks:

1. **League-Specific Model Training**
   - Train separate models per league (Premier League, Serie A, etc.)
   - Different leagues have different playing styles
   - May improve accuracy by 2-5%

2. **Model Selection**
   - Choose which leagues get separate models
   - Start with top 5 leagues
   - Expand to other leagues if beneficial

3. **Model Management**
   - Manage multiple models per market
   - Route predictions to correct model
   - Handle leagues without specific models

#### Files to Create:

- `ml/models/league-specific-models.py` - League-specific model training
- `ml/models/model-router.py` - Model routing logic

#### Validation Criteria:

- ✅ League-specific models trained
- ✅ Models improve accuracy by 2-5%
- ✅ Model routing works correctly
- ✅ Fallback to general model works

---

### ML 5.3 Real-Time Model Updates

**Reference:** See "5.3 Real-Time Model Updates" in `betting-insights-algorithm.md`

**Goal:** Update predictions based on live match events

#### Sub-tasks:

1. **Live Match Adjustments**
   - Update predictions based on live events
   - Red card → adjust probabilities
   - Early goal → adjust BTTS probability

2. **In-Play Features**
   - Add features for live match state
   - Current score, time remaining, substitutions, cards

3. **Real-Time Updates**
   - Update predictions in real-time
   - Handle high-frequency updates
   - Cache appropriately

#### Files to Create:

- `ml/live/live-adjustments.py` - Live match adjustments
- `ml/live/in-play-features.py` - In-play features
- `ml/live/real-time-updates.py` - Real-time update system

#### Validation Criteria:

- ✅ Live adjustments work correctly
- ✅ In-play features accurate
- ✅ Real-time updates performant
- ✅ Caching appropriate

---

## Implementation Priority

### High Priority (After Core Launch)
1. **Manager Change Detection** - Easy to implement, clear impact
2. **Fixture Congestion** - Already partially implemented in Phase 4.6

### Medium Priority (Nice to Have)
3. **Injury Proxy Features** - Requires data availability
4. **Weather Proxy** - Requires API integration
5. **League-Specific Models** - Requires more training data

### Low Priority (Future)
6. **Referee Patterns** - Requires referee data
7. **Real-Time Updates** - Requires live data integration

## Implementation Checklist

### Additional Features
- [ ] Implement manager change detection
- [ ] Implement injury proxy features
- [ ] Implement weather features
- [ ] Implement referee features
- [ ] Implement fixture congestion features
- [ ] Validate feature improvements

### Market-Specific Models
- [ ] Train league-specific models
- [ ] Implement model routing
- [ ] Test routing logic
- [ ] Validate accuracy improvements

### Real-Time Updates
- [ ] Implement live adjustments
- [ ] Implement in-play features
- [ ] Implement real-time updates
- [ ] Test performance

### Testing
- [ ] Unit tests for new features
- [ ] Unit tests for league-specific models
- [ ] Unit tests for real-time updates
- [ ] Integration tests
- [ ] Performance tests

## Notes

- These features are enhancements, not critical for launch
- Prioritize based on impact and implementation difficulty
- Validate all features through backtesting
- Measure impact of each feature
- Some features require external data sources
- League-specific models require more training data
- Real-time updates require live data integration
- All features should follow validation framework from ML Phase 4

