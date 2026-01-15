# Betting Insights: Manual Data Requirements

This document lists all data that needs to be manually added, verified, or expanded before implementing the betting insights feature.

## ⚠️ IMPLEMENTATION CHECKPOINT

**CRITICAL:** Before starting implementation of the betting insights algorithm, you **MUST** confirm that all manual data requirements listed below have been completed.

**The implementation will NOT proceed until you explicitly confirm:**
- ✅ All manual data has been added/verified
- ✅ All league IDs are correct
- ✅ All keyword lists are complete
- ✅ All mappings are populated

**When ready to implement, explicitly state:** "I have completed all manual data requirements and am ready to proceed with implementation."

This checkpoint ensures that the implementation can proceed smoothly without missing critical configuration data.

## 1. Top League IDs

**Location:** Used in multiple places for league tier detection and strength calculations

**Current State:** Hardcoded as `[39, 140, 135, 78, 61]` (missing Portuguese League and Eredivisie)

**Required Action:**
- Verify all league IDs are correct according to API-Football
- Add missing leagues: Portuguese League (94) and Eredivisie
- Confirm the complete list matches your target leagues

**Expected Format:**
```typescript
const TOP_LEAGUES = [
  39,   // Premier League (verify)
  140,  // La Liga (verify)
  135,  // Serie A (verify)
  78,   // Bundesliga (verify)
  61,   // Ligue 1 (verify)
  94,   // Portuguese League (add)
  // Eredivisie ID (add - need to find correct ID)
];
```

**Reference:** Lines 2555, 9098-9173 in `betting-insights-algorithm.md`

---

## 2. League Name to ID Mapping

**Location:** Used for mapping historical dataset league names to API-Football league IDs

**Current State:** Basic mapping exists but may be incomplete

**Required Action:**
- Verify all league name variations are included
- Add any missing league name formats from historical datasets
- Ensure all target leagues are covered

**Expected Format:**
```typescript
const LEAGUE_NAME_MAP: Record<string, number> = {
  // Premier League variations
  'Premier League': 39,
  'English Premier League': 39,
  'EPL': 39,
  // Add more variations...
  
  // La Liga variations
  'La Liga': 140,
  'Spanish La Liga': 140,
  'Primera División': 140,
  // Add more variations...
  
  // Add all other target leagues with their variations
};
```

**Reference:** Lines 453-470 in `betting-insights-algorithm.md`

---

## 3. Cup Competition Keywords

**Location:** Used to detect cup competitions vs league matches

**Current State:** Basic list exists but needs expansion

**Required Action:**
- Expand the list with more cup competition keywords
- Include variations in different languages
- Add regional cup competitions you want to support

**Current Keywords:**
```typescript
const cupKeywords = [
  'cup', 'fa cup', 'copa del rey', 'coppa italia', 'dfb-pokal',
  'coupe de france', 'taca de portugal', 'knockout', 'playoff',
  'copa do brasil', 'copa argentina', 'copa chile', 'copa colombia'
];
```

**Keywords to Consider Adding:**
- More domestic cup names (EFL Cup, Coupe de la Ligue, etc.)
- Regional variations (Taca, Taça, Copa, Coppa, Coupe, Pokal)
- Youth/reserve cups if needed
- Super Cup variations
- Any other cup competitions you want to detect

**Reference:** Lines 8082-8087 in `betting-insights-algorithm.md`

---

## 4. International Competition Keywords

**Location:** Used to detect international competitions (Champions League, Europa League, etc.)

**Current State:** Good coverage but may need expansion

**Required Action:**
- Verify all keywords are correct
- Add any missing international competitions
- Include regional variations if needed

**Current Keywords:**
```typescript
const internationalKeywords = [
  'copa libertadores', 'libertadores', 'copa sudamericana', 'sudamericana',
  'champions league', 'europa', 'europa league', 'conference league',
  'afc champions league', 'afc cup', 'caf champions league', 'caf confederation cup',
  'concacaf champions cup', 'concacaf', 'world cup', 'club world cup',
  'intercontinental', 'super cup', 'international'
];
```

**Keywords to Consider Adding:**
- More regional competitions
- Youth international competitions if needed
- Any other international tournaments you want to detect

**Reference:** Lines 8074-8080 in `betting-insights-algorithm.md`

---

## 5. Knockout Stage Keywords

**Location:** Used to detect knockout stages in cup competitions

**Current State:** Basic list exists

**Required Action:**
- Verify keywords cover all round name formats
- Add variations in different languages if needed

**Current Keywords:**
```typescript
const knockoutKeywords = ['round of', 'quarter', 'semi', 'final', 'playoff'];
```

**Keywords to Consider Adding:**
- 'round of 16', 'round of 32' (if not covered by 'round of')
- 'last 16', 'last 32'
- Language variations (e.g., 'cuartos', 'semifinal', 'finale')
- 'elimination', 'knockout'

**Reference:** Lines 8094, 8270 in `betting-insights-algorithm.md`

---

## 6. Neutral Venue Keywords

**Location:** Used to detect neutral venues for cup finals

**Current State:** Basic list exists

**Required Action:**
- Verify keywords cover all neutral venue scenarios
- Add variations if needed

**Current Keywords:**
```typescript
const neutralKeywords = ['final', 'semi-final', 'semi final', 'playoff', 'super cup'];
```

**Keywords to Consider Adding:**
- 'showpiece', 'showdown'
- Language variations
- Any other round names that indicate neutral venues

**Reference:** Line 8270 in `betting-insights-algorithm.md`

---

## 7. Derby/Rivalry Team Pairs

**Location:** Used to detect derby and rivalry matches

**Current State:** Examples provided but needs expansion

**Required Action:**
- Add all major derbies and rivalries for your target leagues
- Verify team IDs are correct according to API-Football
- Add more rivalries as needed

**Current Examples:**
```typescript
const DERBY_RIVALRY_MAP: Record<string, number[]> = {
  // Premier League
  '33-50': [33, 50],        // Manchester United vs Manchester City
  '42-47': [42, 47],        // Arsenal vs Tottenham
  '40-45': [40, 45],        // Liverpool vs Everton
  // ... more examples
  
  // Add all major derbies for:
  // - Premier League
  // - La Liga
  // - Serie A
  // - Bundesliga
  // - Ligue 1
  // - Portuguese League
  // - Eredivisie
  // - Any other leagues you support
};
```

**Important:** Format is `"teamId1-teamId2"` where `teamId1 < teamId2` (sorted IDs)

**Reference:** Lines 8502-8536 in `betting-insights-algorithm.md`

---

## 8. Team Stadium Mapping (Optional but Recommended)

**Location:** Used for neutral venue detection via venue mismatch

**Current State:** Examples provided but needs expansion

**Required Action:**
- Add stadium data for all teams in your target leagues
- Verify stadium names and cities are correct
- Can be populated from API-Football or manual entry

**Current Examples:**
```typescript
const TEAM_STADIUM_MAP: Record<number, { name: string; city: string }> = {
  33: { name: 'Old Trafford', city: 'Manchester' },
  50: { name: 'Etihad Stadium', city: 'Manchester' },
  // ... more examples
  
  // Add stadiums for all teams in:
  // - Premier League
  // - La Liga
  // - Serie A
  // - Bundesliga
  // - Ligue 1
  // - Portuguese League
  // - Eredivisie
  // - Any other leagues you support
};
```

**Note:** This is optional - the system can work without it using only round name detection, but venue mismatch detection improves accuracy.

**Reference:** Lines 8289-8318 in `betting-insights-algorithm.md`

---

## 9. League Characteristics (Statistical Baselines)

**Location:** Used for league-specific adjustments to predictions

**Current State:** Examples provided for major leagues but needs verification and expansion

**Required Action:**
- Verify all statistical values are accurate (can calculate from historical data or API-Football)
- Add missing leagues (Portuguese League, Eredivisie, etc.)
- Update values annually based on recent season data

**Current Examples:**
```typescript
const LEAGUE_CHARACTERISTICS: Record<number, LeagueCharacteristics> = {
  39: {  // Premier League
    avgGoalsPerGame: 2.75,
    bttsRate: 0.52,
    drawRate: 0.25,
    homeAdvantageStrength: 1.0,
    overGoalsBaselineByLine: {
      '0.5': 0.93,
      '1.5': 0.78,
      '2.5': 0.52,
      '3.5': 0.28,
      '4.5': 0.14,
      '5.5': 0.07,
    },
    cleanSheetRate: 0.32,
    scoringRate: 1.38,
  },
  // ... more examples
  
  // Add characteristics for:
  // - All target leagues
  // - Verify values are accurate (calculate from recent seasons)
  // - Update annually
};
```

**Statistics to Calculate/Verify:**
- `avgGoalsPerGame`: Average goals per game in the league
- `bttsRate`: Baseline BTTS (Both Teams to Score) rate (0-1)
- `drawRate`: Baseline draw rate (0-1)
- `homeAdvantageStrength`: Multiplier for home advantage (default: 1.0)
- `overGoalsBaselineByLine`: Baseline P(totalGoals > line) (0-1), keyed by line string (e.g. "2.5")
- `cleanSheetRate`: Average clean sheet rate
- `scoringRate`: Average goals per team per game

**Reference:** Lines 9098-9173 in `betting-insights-algorithm.md`

---

## 10. Team Domestic League Mapping (Optional)

**Location:** Used for international match context

**Current State:** Empty placeholder

**Required Action:**
- Can be populated automatically from API-Football (preferred)
- Or manually map teams to their domestic leagues if needed

**Note:** This is typically handled automatically by fetching team's recent matches and detecting their primary league. Manual mapping is only needed if automatic detection fails.

**Reference:** Lines 6705-6713 in `betting-insights-algorithm.md`

---

## Summary Checklist

Before implementing betting insights, ensure you have:

- [ ] **Top League IDs** - Verified and complete list
- [ ] **League Name Mapping** - All variations mapped to correct IDs
- [ ] **Cup Keywords** - Expanded list covering all cup competitions
- [ ] **International Keywords** - Complete list of international competitions
- [ ] **Knockout Keywords** - All round name variations covered
- [ ] **Neutral Venue Keywords** - All neutral venue scenarios covered
- [ ] **Derby/Rivalry Pairs** - All major derbies and rivalries mapped
- [ ] **Team Stadium Mapping** - Stadium data for teams (optional but recommended)
- [ ] **League Characteristics** - Statistical baselines for all target leagues
- [ ] **Team Domestic League Mapping** - Usually automatic, but verify if needed

---

## Data Sources

**API-Football:**
- League IDs: Verify via API-Football documentation or `/leagues` endpoint
- Team IDs: Verify via `/teams` endpoint
- Stadium data: Available in team/venue endpoints

**Historical Data:**
- League characteristics: Calculate from historical match data
- Can use GitHub dataset mentioned in algorithm doc for baseline calculations

**Manual Research:**
- Derby/rivalry pairs: Research football rivalries
- Cup competition names: Research official competition names
- Stadium names: Verify official stadium names

---

## Next Steps

1. **Priority 1 (Critical):**
   - Top League IDs
   - Cup Keywords (expanded)
   - League Characteristics (at least for major leagues)

2. **Priority 2 (Important):**
   - Derby/Rivalry Pairs
   - International Keywords (verify completeness)
   - League Name Mapping (verify completeness)

3. **Priority 3 (Optional but Recommended):**
   - Team Stadium Mapping
   - Complete League Characteristics for all leagues
   - Knockout/Neutral Venue Keywords (verify completeness)

Once this data is ready, we can proceed with implementation!

