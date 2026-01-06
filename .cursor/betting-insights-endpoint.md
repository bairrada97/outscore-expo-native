# Betting Insights Endpoint: Complete Implementation Plan

## Table of Contents
1. [Is This a Predictor Bot? (Honest Answer)](#honest-answer)
2. [How Factors Apply to Different Markets](#factor-application)
3. [Complete Implementation Plan](#implementation-plan)
4. [API Specification](#api-specification)
5. [Week-by-Week Roadmap](#roadmap)

---

## Part 1: Honest Answer - Is This a Predictor Bot?

### What You're Building vs "Predictor Bots"

**❌ What You're NOT Building:**
```
Typical "Predictor Bot" (Scam):
- Claims 80-90% accuracy
- Pays for fake Telegram followers
- "Sure wins" and "fixed matches"
- No transparency
- No data shown
- Just "Trust me bro"
- Disappears when wrong
```

**✅ What You ARE Building:**
```
Data Aggregation & Analysis Tool:
- Shows the math (transparent)
- Displays confidence levels
- Admits when uncertain
- Shows conflicting signals
- Saves users TIME (vs manually checking 10 matches)
- Educational (teaches why, not just what)
- Realistic accuracy expectations (60-70%, not 90%)
```

### The Truth About Prediction Accuracy

**Realistic Expectations:**
```
BTTS Predictions:
✅ 65-75% accuracy possible
Why: Simple binary outcome, less variables
Example: If both teams scored in 4 of last 5 games + 
         4 of last 5 H2H → very likely to happen again

Over/Under 2.5:
✅ 60-70% accuracy possible
Why: Scoring patterns are semi-predictable
Example: High-scoring teams vs defensive teams

Match Result (1X2):
⚠️ 50-60% accuracy (at best!)
Why: Too many variables (referee, luck, one mistake)
Even bookies with billions in data struggle here
```

**Why Most Predictor Bots Fail:**
```
1. They try to predict 1X2 (hardest market)
2. They claim unrealistic accuracy (80-90%)
3. They ignore context (just use algorithms)
4. They don't show confidence levels
5. They treat all predictions equally
6. They don't learn from mistakes
```

**Your Advantage:**
```
1. ✅ Focus on easier markets (BTTS, O/U 2.5)
2. ✅ Realistic accuracy claims (60-70%)
3. ✅ Show all the data (transparency)
4. ✅ Confidence levels (HIGH/MEDIUM/LOW)
5. ✅ Separate strong bets from weak ones
6. ✅ Track accuracy over time (build trust)
7. ✅ Educational ("here's WHY we think this")
```

### What You're Really Selling

**Not:** "We predict the future perfectly"
**But:** "We save you 15 minutes of research per match and give you better analysis than you'd do manually"

**Value Proposition:**
```
Without Outscore:
👤 Bettor manually checks:
   - Man Utd last 5 games (5 min)
   - Chelsea last 5 games (5 min)
   - H2H history (3 min)
   - League table (1 min)
   - Mental calculation (2 min)
   Total: 16 minutes per match
   
   Result: Probably misses key insights (fatigue, motivation)
   
With Outscore:
📱 Open app (10 seconds)
   - See all data aggregated
   - Clear probability ratings
   - Key insights highlighted
   - Conflicting signals shown
   Total: 30 seconds per match
   
   Result: Better informed decision in 3% of the time
```

**Key Message for Users:**
```
"We don't predict the future. We help you make better 
decisions by aggregating data you'd check manually anyway.

Our probabilities are educated estimates based on:
- Recent form (last 5-10 games)
- Head-to-head history
- Home/away performance
- Motivation & context
- Rest days & fatigue

We're right ~65-70% of the time on BTTS and O/U 2.5.
We show our confidence level for every prediction.
When signals conflict, we tell you."

Think of us as a research assistant, not a crystal ball.
```

---

## Part 2: How Factors Apply to Different Markets

### Factor Relevance Matrix

```typescript
// Weight adjustments per market
const MARKET_WEIGHTS = {
  MATCH_RESULT: {
    recentForm: 30,
    h2h: 25,
    homeAdvantage: 20,
    motivation: 18,
    rest: 12,
    leaguePosition: 10,
  },
  
  BTTS: {
    recentForm: 35,        // ⬆️ More important (scoring patterns)
    h2h: 25,               // Same (historical BTTS matters)
    homeAdvantage: 10,     // ⬇️ Less relevant for BTTS
    motivation: 15,        // ⬇️ Less relevant
    rest: 8,               // ⬇️ Less relevant
    defensiveForm: 20,     // ⬆️ NEW: Clean sheets matter
    scoringRate: 25,       // ⬆️ NEW: Goals per game critical
  },
  
  OVER_25: {
    recentForm: 30,        // Scoring trends
    h2h: 20,               // ⬇️ Less weight (historical goals)
    homeAdvantage: 12,     // ⬇️ Less relevant
    motivation: 10,        // ⬇️ Less relevant (both score)
    rest: 8,
    avgGoalsPerGame: 30,   // ⬆️ NEW: Critical factor
    defensiveWeakness: 25, // ⬆️ NEW: Leaky defenses
  },
  
  FIRST_HALF_RESULT: {
    recentForm: 25,
    h2h: 20,
    homeAdvantage: 15,
    motivation: 10,
    firstHalfScoring: 40,  // ⬆️ NEW: Critical
    slowStarters: 30,      // ⬆️ NEW: Pattern recognition
  },
  
  CLEAN_SHEET: {
    recentForm: 20,
    h2h: 15,
    homeAdvantage: 15,
    defensiveForm: 50,     // ⬆️ NEW: Most critical
    opponentScoring: 30,   // ⬆️ NEW: Can they score?
  },
};
```

### Market-Specific Factor Examples

#### 1. BTTS (Both Teams to Score)

**Key Questions:**
- Do both teams score regularly?
- Do both teams concede regularly?
- Has BTTS happened in recent H2H?

**Factors (Ranked):**
```typescript
1. Scoring Rate (25%)
   Team A scored in 5 of last 5 → +25
   Team B scored in 4 of last 5 → +20
   
2. Defensive Form (20%)
   Team A: 0 clean sheets in L10 → +20 (helps BTTS)
   Team B: 1 clean sheet in L10 → +15 (helps BTTS)
   
3. Recent Form (35%)
   Overall form including goals scored/conceded
   
4. H2H BTTS (25%)
   BTTS in 4 of last 5 H2H → +40
   
5. Home Advantage (10%)
   Less relevant for BTTS
   
6. Motivation (15%)
   If team "must win" → more attacking → helps BTTS
   
7. Rest Days (8%)
   Tired teams defend worse → helps BTTS
```

**Example Calculation:**
```typescript
Man United vs Chelsea - BTTS

Scoring Rates:
- Man Utd: 4/5 games (80%) → Score: +20
- Chelsea: 5/5 games (100%) → Score: +25

Defensive Form:
- Man Utd: 0/10 clean sheets → Score: +20 (leaky)
- Chelsea: 2/10 clean sheets → Score: +15 (leaky)

H2H BTTS:
- 4 of last 5 meetings → Score: +40

Weighted Score:
= (20+25)*0.25 + (20+15)*0.20 + (40)*0.25
= 11.25 + 7 + 10
= 28.25

Convert to probability:
= 1 / (1 + e^(-score/10))
= 1 / (1 + e^(-2.825))
= 94% → Adjust for conservatism → 78%

Result: BTTS - LIKELY (78%)
```

**Motivation Impact on BTTS:**
```
Team fighting for survival:
→ Defensive, cautious
→ REDUCES BTTS probability (-10%)

Team with nothing to play for:
→ Open, attacking football
→ INCREASES BTTS probability (+5%)

Both teams need to win:
→ Attacking football
→ INCREASES BTTS probability (+15%)
```

**Rest Days Impact on BTTS:**
```
3 days rest:
→ Tired legs
→ Defensive mistakes
→ INCREASES BTTS probability (+5%)

7 days rest:
→ Fresh, organized defense
→ DECREASES BTTS probability (-5%)
```

---

#### 2. Over/Under 2.5 Goals

**Key Questions:**
- Do these teams score lots of goals?
- Do these teams concede lots of goals?
- Were recent H2H high-scoring?

**Factors (Ranked):**
```typescript
1. Average Goals Per Game (30%)
   Team A: 2.4 goals/game (L5) → +24
   Team B: 1.8 goals/game (L5) → +18
   Combined: 4.2 goals/game → Very High
   
2. Defensive Weakness (25%)
   Team A conceding: 1.8/game → +18
   Team B conceding: 1.2/game → +12
   
3. Recent Form (30%)
   Over 2.5 in 4 of last 5 for both teams
   
4. H2H Goals (20%)
   Average 3.5 goals in last 5 H2H → +35
   
5. Home Advantage (12%)
   Home teams typically score 0.3-0.5 more
   
6. Motivation (10%)
   Must-win games can be high-scoring
   
7. Rest Days (8%)
   Fatigue increases goals late in game
```

**Example Calculation:**
```typescript
Man United vs Chelsea - Over 2.5

Average Goals:
- Man Utd scoring: 2.4/game → +24
- Chelsea scoring: 2.2/game → +22
- Combined: 4.6/game → Score: +46

Defensive Weakness:
- Man Utd conceding: 1.8/game → +18
- Chelsea conceding: 1.0/game → +10

H2H:
- Average 3.5 goals in L5 H2H → +35
- Over 2.5 in 4 of 5 H2H → +40

Recent Form:
- Over 2.5 in 4 of Man Utd's L5 → +30
- Over 2.5 in 3 of Chelsea's L5 → +20

Weighted Score:
= 46*0.30 + 28*0.25 + 25*0.30 + 37.5*0.20
= 13.8 + 7 + 7.5 + 7.5
= 35.8

Result: Over 2.5 - LIKELY (71%)
```

**Motivation Impact on Over 2.5:**
```
Both teams need to win:
→ Open, attacking game
→ INCREASES probability (+15%)

One team needs win, other doesn't:
→ Attacking vs Defensive
→ NEUTRAL (±0%)

Both teams safe mid-table:
→ Boring game
→ DECREASES probability (-10%)

Title decider / Relegation battle:
→ Tense, cagey
→ DECREASES probability (-5%)
```

**Rest Days Impact on Over 2.5:**
```
Both teams tired (3 days):
→ Defensive mistakes
→ Late goals
→ INCREASES probability (+8%)

Both teams fresh (7+ days):
→ Organized defense
→ DECREASES probability (-5%)

One tired, one fresh:
→ Fresh team likely dominates
→ INCREASES probability (+5%)
```

---

#### 3. Match Result (1X2)

**This uses ALL factors equally** (as shown in previous document)

**Key Insight:**
```
For 1X2, ALL factors matter:
- Recent form (who's in better shape?)
- H2H (psychological edge)
- Home advantage (huge for 1X2)
- Motivation (who wants it more?)
- Rest (who's fresher?)
- League position (who's better quality?)

This is why 1X2 is hardest to predict!
Too many variables.
```

---

#### 4. First Half Result

**Key Questions:**
- Who scores early?
- Who starts slow?
- First half patterns in H2H?

**Factors (Ranked):**
```typescript
1. First Half Scoring Rate (40%)
   Team A: 3 of 5 games scored in 1st half → +30
   Team B: 1 of 5 games scored in 1st half → +10
   
2. Slow Starters Pattern (30%)
   Team B is historically slow starter → -30
   
3. Recent Form (25%)
   Overall form matters
   
4. H2H First Half (20%)
   What happened in 1st half of recent H2H?
   
5. Home Advantage (15%)
   Home teams often start faster
   
6. Motivation (10%)
   High-stakes games start cautious
```

**Motivation Impact on First Half:**
```
Must-win game:
→ Cautious start
→ DECREASES 1st half goals (-15%)

Nothing to play for:
→ Open, attacking start
→ INCREASES 1st half goals (+10%)

Derby / Rivalry:
→ Intense, fast start
→ INCREASES 1st half goals (+12%)
```

---

### Summary: Factor Relevance by Market

```
┌─────────────────┬──────┬──────┬────────┬──────────┐
│ Factor          │ 1X2  │ BTTS │ O/U2.5 │ 1st Half │
├─────────────────┼──────┼──────┼────────┼──────────┤
│ Recent Form     │ 30%  │ 35%  │ 30%    │ 25%      │
│ H2H Record      │ 25%  │ 25%  │ 20%    │ 20%      │
│ Home Advantage  │ 20%  │ 10%  │ 12%    │ 15%      │
│ Motivation      │ 18%  │ 15%  │ 10%    │ 10%      │
│ Rest Days       │ 12%  │ 8%   │ 8%     │ 5%       │
│ League Position │ 10%  │ 5%   │ 5%     │ 5%       │
├─────────────────┼──────┼──────┼────────┼──────────┤
│ Scoring Rate    │ N/A  │ 25%  │ 30%    │ N/A      │
│ Defensive Form  │ N/A  │ 20%  │ 25%    │ N/A      │
│ 1st Half Score  │ N/A  │ N/A  │ N/A    │ 40%      │
└─────────────────┴──────┴──────┴────────┴──────────┘
```

**Key Insight:**
- **BTTS:** Scoring/defensive form > home advantage
- **O/U 2.5:** Average goals > motivation
- **1X2:** All factors matter equally (hardest!)
- **1st Half:** Timing patterns > everything else

---

## Part 3: Complete Implementation Plan

### Phase 1: Core Data Layer (Week 1)

**Goal:** Fetch and cache all necessary data

#### 1.1 Data Fetching Functions

```typescript
// /api/data/team-data.ts

interface TeamData {
  id: number;
  name: string;
  
  // Last matches
  lastMatches: Match[];           // Last 10 all matches
  lastHomeMatches: Match[];       // Last 5 home
  lastAwayMatches: Match[];       // Last 5 away
  
  // Calculated stats
  stats: {
    // Overall
    form: string;                 // "WDLWW"
    avgGoalsScored: number;       // 2.1
    avgGoalsConceded: number;     // 1.3
    
    // Home/Away splits
    homeAvgScored: number;
    homeAvgConceded: number;
    awayAvgScored: number;
    awayAvgConceded: number;
    
    // BTTS specific
    bttsPercentage: number;       // 70% of games had BTTS
    gamesWithGoals: number;       // Scored in 8 of 10
    cleanSheets: number;          // 2 clean sheets
    cleanSheetDrought: number;    // Games since last CS
    
    // Timing
    firstHalfGoals: number;       // 60% of goals in 1st half
    secondHalfGoals: number;
    firstHalfGoalsAgainst: number;
    
    // Patterns
    currentWinStreak: number;
    currentLossStreak: number;
    currentScoringStreak: number;
    
    // Context
    leaguePosition: number;
    points: number;
    pointsFromFirst: number;
    pointsFromCL: number;
    pointsFromRelegation: number;
  };
  
  // Match context
  lastMatchDate: Date;
  nextMatchDate: Date;
  daysSinceLastMatch: number;
  daysUntilNextMatch: number;
}

interface H2HData {
  matches: Match[];
  
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  
  bttsCount: number;
  bttsPercentage: number;
  
  over25Count: number;
  over25Percentage: number;
  
  avgGoalsPerMatch: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  
  firstHalfGoalsPercentage: number;
}

// Fetch team data with caching
async function getTeamData(
  teamId: number,
  c: Context
): Promise<TeamData> {
  const cacheKey = `team:${teamId}`;
  
  // Check cache (24 hour TTL)
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached && !isStale(cached, 24 * 60 * 60)) {
    return cached;
  }
  
  // Fetch from API-Football
  const [allMatches, homeMatches, awayMatches, standings] = await Promise.all([
    fetchTeamMatches(teamId, 10),
    fetchTeamHomeMatches(teamId, 5),
    fetchTeamAwayMatches(teamId, 5),
    fetchTeamStandings(teamId),
  ]);
  
  // Calculate stats
  const stats = calculateTeamStats(allMatches, standings);
  
  const teamData: TeamData = {
    id: teamId,
    name: allMatches[0].homeTeam.id === teamId 
      ? allMatches[0].homeTeam.name 
      : allMatches[0].awayTeam.name,
    lastMatches: allMatches,
    lastHomeMatches: homeMatches,
    lastAwayMatches: awayMatches,
    stats,
    lastMatchDate: allMatches[0].date,
    nextMatchDate: await getNextMatch(teamId),
    daysSinceLastMatch: calculateDaysSince(allMatches[0].date),
    daysUntilNextMatch: 0, // Will be calculated
  };
  
  // Cache for 24 hours
  await c.env.KV.put(cacheKey, JSON.stringify(teamData), {
    expirationTtl: 24 * 60 * 60,
  });
  
  return teamData;
}

// Fetch H2H data
async function getH2HData(
  homeTeamId: number,
  awayTeamId: number,
  c: Context
): Promise<H2HData> {
  const cacheKey = `h2h:${homeTeamId}:${awayTeamId}`;
  
  // Check cache (7 day TTL)
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached && !isStale(cached, 7 * 24 * 60 * 60)) {
    return cached;
  }
  
  // Fetch from API
  const matches = await fetchH2HMatches(homeTeamId, awayTeamId, 10);
  
  const h2hData: H2HData = {
    matches,
    homeTeamWins: matches.filter(m => m.winnerId === homeTeamId).length,
    awayTeamWins: matches.filter(m => m.winnerId === awayTeamId).length,
    draws: matches.filter(m => m.result === 'D').length,
    bttsCount: matches.filter(m => m.bothTeamsScored).length,
    bttsPercentage: (matches.filter(m => m.bothTeamsScored).length / matches.length) * 100,
    over25Count: matches.filter(m => m.totalGoals > 2.5).length,
    over25Percentage: (matches.filter(m => m.totalGoals > 2.5).length / matches.length) * 100,
    avgGoalsPerMatch: matches.reduce((sum, m) => sum + m.totalGoals, 0) / matches.length,
    avgHomeGoals: matches.reduce((sum, m) => sum + m.homeGoals, 0) / matches.length,
    avgAwayGoals: matches.reduce((sum, m) => sum + m.awayGoals, 0) / matches.length,
    firstHalfGoalsPercentage: 0, // Calculate if data available
  };
  
  await c.env.KV.put(cacheKey, JSON.stringify(h2hData), {
    expirationTtl: 7 * 24 * 60 * 60,
  });
  
  return h2hData;
}
```

#### 1.2 Stats Calculation

```typescript
// /api/utils/stats-calculator.ts

function calculateTeamStats(
  matches: Match[],
  standings: Standing
): TeamStats {
  // Form string (last 5)
  const form = matches
    .slice(0, 5)
    .map(m => m.result)
    .join(''); // "WWDLW"
  
  // Averages
  const avgGoalsScored = 
    matches.reduce((sum, m) => sum + m.goalsScored, 0) / matches.length;
  const avgGoalsConceded = 
    matches.reduce((sum, m) => sum + m.goalsConceded, 0) / matches.length;
  
  // BTTS stats
  const gamesWithGoals = matches.filter(m => m.goalsScored > 0).length;
  const bttsGames = matches.filter(m => 
    m.goalsScored > 0 && m.goalsConceded > 0
  ).length;
  const bttsPercentage = (bttsGames / matches.length) * 100;
  
  // Clean sheets
  const cleanSheets = matches.filter(m => m.goalsConceded === 0).length;
  const cleanSheetDrought = countConsecutiveMatchesWithoutCleanSheet(matches);
  
  // Timing
  const firstHalfGoals = matches.reduce((sum, m) => 
    sum + (m.firstHalfGoals || 0), 0
  );
  const totalGoals = matches.reduce((sum, m) => sum + m.goalsScored, 0);
  const firstHalfGoalPercentage = (firstHalfGoals / totalGoals) * 100;
  
  // Streaks
  const currentWinStreak = countConsecutiveResults(matches, 'W');
  const currentLossStreak = countConsecutiveResults(matches, 'L');
  const currentScoringStreak = countConsecutiveMatchesWithGoals(matches);
  
  return {
    form,
    avgGoalsScored,
    avgGoalsConceded,
    // ... etc
    leaguePosition: standings.position,
    points: standings.points,
    pointsFromFirst: standings.pointsFromFirst,
    // ... etc
  };
}

function countConsecutiveResults(matches: Match[], result: 'W'|'D'|'L'): number {
  let count = 0;
  for (const match of matches) {
    if (match.result === result) count++;
    else break;
  }
  return count;
}

function countConsecutiveMatchesWithGoals(matches: Match[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsScored > 0) count++;
    else break;
  }
  return count;
}

function countConsecutiveMatchesWithoutCleanSheet(matches: Match[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsConceded > 0) count++;
    else break;
  }
  return count;
}
```

---

### Phase 2: Pattern Detection (Week 1-2)

**Goal:** Detect notable patterns automatically

```typescript
// /api/analysis/pattern-detector.ts

interface Pattern {
  type: PatternType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority: number;
  data: any;
}

type PatternType =
  | 'LONG_LOSING_STREAK'
  | 'LONG_WINNING_STREAK'
  | 'SCORING_STREAK'
  | 'CLEAN_SHEET_DROUGHT'
  | 'HOME_FORM_COLLAPSE'
  | 'AWAY_DOMINANCE'
  | 'H2H_DOMINANCE'
  | 'BTTS_STREAK'
  | 'FIRST_HALF_WEAKNESS'
  | 'HIGH_SCORING_FORM'
  | 'DEFENSIVE_WEAKNESS';

function detectPatterns(
  teamData: TeamData,
  context: 'home' | 'away'
): Pattern[] {
  const patterns: Pattern[] = [];
  const matches = context === 'home' 
    ? teamData.lastHomeMatches 
    : teamData.lastAwayMatches;
  
  // 1. Losing streak (5+)
  const losingStreak = countConsecutiveResults(matches, 'L');
  if (losingStreak >= 5) {
    patterns.push({
      type: 'LONG_LOSING_STREAK',
      severity: losingStreak >= 8 ? 'CRITICAL' : 'HIGH',
      priority: 100,
      data: { streak: losingStreak, context }
    });
  }
  
  // 2. Winning streak (5+)
  const winningStreak = countConsecutiveResults(matches, 'W');
  if (winningStreak >= 5) {
    patterns.push({
      type: 'LONG_WINNING_STREAK',
      severity: winningStreak >= 8 ? 'CRITICAL' : 'HIGH',
      priority: 95,
      data: { streak: winningStreak, context }
    });
  }
  
  // 3. Scoring streak
  const scoringStreak = countConsecutiveMatchesWithGoals(matches);
  if (scoringStreak >= 5) {
    patterns.push({
      type: 'SCORING_STREAK',
      severity: scoringStreak >= 8 ? 'HIGH' : 'MEDIUM',
      priority: 80,
      data: { streak: scoringStreak }
    });
  }
  
  // 4. Clean sheet drought
  const csDrought = countConsecutiveMatchesWithoutCleanSheet(matches);
  if (csDrought >= 8) {
    patterns.push({
      type: 'CLEAN_SHEET_DROUGHT',
      severity: csDrought >= 12 ? 'CRITICAL' : 'HIGH',
      priority: 85,
      data: { drought: csDrought }
    });
  }
  
  // 5. First half weakness
  const firstHalfGoals = matches.filter(m => 
    m.firstHalfGoals && m.firstHalfGoals > 0
  ).length;
  const firstHalfPct = (firstHalfGoals / matches.length) * 100;
  if (firstHalfPct < 30) {
    patterns.push({
      type: 'FIRST_HALF_WEAKNESS',
      severity: firstHalfPct < 20 ? 'HIGH' : 'MEDIUM',
      priority: 70,
      data: { 
        gamesWithGoals: firstHalfGoals,
        total: matches.length,
        percentage: firstHalfPct
      }
    });
  }
  
  // 6. High scoring form
  const avgGoals = teamData.stats.avgGoalsScored;
  if (avgGoals >= 2.5) {
    patterns.push({
      type: 'HIGH_SCORING_FORM',
      severity: avgGoals >= 3.0 ? 'HIGH' : 'MEDIUM',
      priority: 75,
      data: { avgGoals }
    });
  }
  
  // 7. Defensive weakness
  const avgConceded = teamData.stats.avgGoalsConceded;
  if (avgConceded >= 2.0) {
    patterns.push({
      type: 'DEFENSIVE_WEAKNESS',
      severity: avgConceded >= 2.5 ? 'HIGH' : 'MEDIUM',
      priority: 78,
      data: { avgConceded }
    });
  }
  
  return patterns;
}

function detectH2HPatterns(h2hData: H2HData): Pattern[] {
  const patterns: Pattern[] = [];
  
  // 1. BTTS streak
  const bttsStreak = countConsecutiveBTTS(h2hData.matches);
  if (bttsStreak >= 3 || h2hData.bttsPercentage >= 70) {
    patterns.push({
      type: 'BTTS_STREAK',
      severity: bttsStreak >= 5 || h2hData.bttsPercentage >= 80 ? 'HIGH' : 'MEDIUM',
      priority: 90,
      data: { 
        streak: bttsStreak,
        percentage: h2hData.bttsPercentage,
        count: h2hData.bttsCount,
        total: h2hData.matches.length
      }
    });
  }
  
  // 2. One team dominates
  const totalMatches = h2hData.matches.length;
  const homeWinPct = (h2hData.homeTeamWins / totalMatches) * 100;
  const awayWinPct = (h2hData.awayTeamWins / totalMatches) * 100;
  
  if (homeWinPct >= 70 || awayWinPct >= 70) {
    patterns.push({
      type: 'H2H_DOMINANCE',
      severity: 'HIGH',
      priority: 85,
      data: {
        dominantTeam: homeWinPct > awayWinPct ? 'home' : 'away',
        wins: Math.max(h2hData.homeTeamWins, h2hData.awayTeamWins),
        total: totalMatches,
        percentage: Math.max(homeWinPct, awayWinPct)
      }
    });
  }
  
  return patterns;
}

function countConsecutiveBTTS(matches: Match[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.bothTeamsScored) count++;
    else break;
  }
  return count;
}
```

---

### Phase 3: Insight Generation (Week 2)

**Goal:** Convert patterns to human-readable insights

```typescript
// /api/analysis/insight-generator.ts

interface Insight {
  text: string;
  emoji: string;
  priority: number;
  category: 'FORM' | 'H2H' | 'TIMING' | 'DEFENSIVE' | 'SCORING';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface InsightTemplate {
  pattern: PatternType;
  emoji: string;
  priority: number;
  template: (data: any, teamName: string) => string;
}

const INSIGHT_TEMPLATES: InsightTemplate[] = [
  {
    pattern: 'LONG_LOSING_STREAK',
    emoji: '🔴',
    priority: 100,
    template: (data, teamName) => {
      const { streak, context } = data;
      const venue = context === 'home' ? 'home' : 'away';
      if (streak >= 10) {
        return `${teamName} lost ${streak} consecutive ${venue} matches`;
      } else if (streak >= 8) {
        return `${teamName} on ${streak}-game ${venue} losing streak`;
      } else {
        return `${teamName} lost ${streak} of last ${streak} ${venue} matches`;
      }
    }
  },
  
  {
    pattern: 'LONG_WINNING_STREAK',
    emoji: '🔥',
    priority: 95,
    template: (data, teamName) => {
      const { streak, context } = data;
      const venue = context === 'home' ? 'home' : 'away';
      return `${teamName} won ${streak} consecutive ${venue} matches`;
    }
  },
  
  {
    pattern: 'SCORING_STREAK',
    emoji: '⚽',
    priority: 80,
    template: (data, teamName) => {
      return `${teamName} scored in ${data.streak} consecutive matches`;
    }
  },
  
  {
    pattern: 'CLEAN_SHEET_DROUGHT',
    emoji: '🔓',
    priority: 85,
    template: (data, teamName) => {
      if (data.drought >= 15) {
        return `${teamName}: 0 clean sheets in last ${data.drought} games`;
      }
      return `${teamName} haven't kept a clean sheet in ${data.drought} games`;
    }
  },
  
  {
    pattern: 'FIRST_HALF_WEAKNESS',
    emoji: '🐌',
    priority: 70,
    template: (data, teamName) => {
      return `${teamName} scored 1st half in only ${data.gamesWithGoals} of L${data.total} (${data.percentage.toFixed(0)}%)`;
    }
  },
  
  {
    pattern: 'HIGH_SCORING_FORM',
    emoji: '🔥',
    priority: 75,
    template: (data, teamName) => {
      return `${teamName} averaging ${data.avgGoals.toFixed(1)} goals per game (L5)`;
    }
  },
  
  {
    pattern: 'DEFENSIVE_WEAKNESS',
    emoji: '⚠️',
    priority: 78,
    template: (data, teamName) => {
      return `${teamName} conceding ${data.avgConceded.toFixed(1)} goals per game (L5)`;
    }
  },
  
  {
    pattern: 'BTTS_STREAK',
    emoji: '📊',
    priority: 90,
    template: (data) => {
      if (data.streak >= 5) {
        return `BTTS in all last ${data.streak} H2H meetings (${data.percentage.toFixed(0)}%)`;
      }
      return `BTTS in ${data.count} of last ${data.total} H2H meetings (${data.percentage.toFixed(0)}%)`;
    }
  },
  
  {
    pattern: 'H2H_DOMINANCE',
    emoji: '🏆',
    priority: 85,
    template: (data, teamName) => {
      return `${teamName} won ${data.wins} of last ${data.total} H2H meetings (${data.percentage.toFixed(0)}%)`;
    }
  },
];

function generateInsights(
  patterns: Pattern[],
  teamName: string
): Insight[] {
  const insights: Insight[] = [];
  
  for (const pattern of patterns) {
    const template = INSIGHT_TEMPLATES.find(t => t.pattern === pattern.type);
    if (!template) continue;
    
    insights.push({
      text: template.template(pattern.data, teamName),
      emoji: template.emoji,
      priority: template.priority,
      category: categorizePattern(pattern.type),
      severity: pattern.severity,
    });
  }
  
  // Sort by priority
  return insights.sort((a, b) => b.priority - a.priority);
}

function categorizePattern(type: PatternType): Insight['category'] {
  const map: Record<PatternType, Insight['category']> = {
    'LONG_LOSING_STREAK': 'FORM',
    'LONG_WINNING_STREAK': 'FORM',
    'SCORING_STREAK': 'SCORING',
    'CLEAN_SHEET_DROUGHT': 'DEFENSIVE',
    'HOME_FORM_COLLAPSE': 'FORM',
    'AWAY_DOMINANCE': 'FORM',
    'H2H_DOMINANCE': 'H2H',
    'BTTS_STREAK': 'H2H',
    'FIRST_HALF_WEAKNESS': 'TIMING',
    'HIGH_SCORING_FORM': 'SCORING',
    'DEFENSIVE_WEAKNESS': 'DEFENSIVE',
  };
  return map[type] || 'FORM';
}
```

---

### Phase 4: Market Predictions (Week 2-3)

**Goal:** Calculate probabilities for each betting market

```typescript
// /api/analysis/market-predictor.ts

interface MarketPrediction {
  market: 'MATCH_RESULT' | 'BTTS' | 'OVER_25' | 'FIRST_HALF';
  probabilities: {
    home?: number;
    draw?: number;
    away?: number;
    yes?: number;
    no?: number;
  };
  rating: 'VERY_LIKELY' | 'LIKELY' | 'NEUTRAL' | 'UNLIKELY' | 'VERY_UNLIKELY';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  insights: Insight[];
  conflictingSignals?: ConflictingSignal[];
  recommendation?: string;
}

interface ConflictingSignal {
  favors: 'home' | 'away' | 'yes' | 'no';
  factor: string;
  weight: number;
}

async function generateMarketPredictions(
  homeTeamData: TeamData,
  awayTeamData: TeamData,
  h2hData: H2HData
): Promise<MarketPrediction[]> {
  const predictions: MarketPrediction[] = [];
  
  // 1. BTTS
  predictions.push(await predictBTTS(homeTeamData, awayTeamData, h2hData));
  
  // 2. Over/Under 2.5
  predictions.push(await predictOver25(homeTeamData, awayTeamData, h2hData));
  
  // 3. Match Result
  predictions.push(await predictMatchResult(homeTeamData, awayTeamData, h2hData));
  
  // 4. First Half
  predictions.push(await predictFirstHalf(homeTeamData, awayTeamData, h2hData));
  
  return predictions;
}

async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  const conflicts: ConflictingSignal[] = [];
  
  // Factor 1: Home team scoring rate (25% weight)
  const homeScored = homeTeam.lastHomeMatches.filter(m => m.goalsScored > 0).length;
  const homeScoredPct = (homeScored / homeTeam.lastHomeMatches.length) * 100;
  const homeScoreScore = homeScoredPct; // 0-100
  
  insights.push({
    text: `${homeTeam.name} scored in ${homeScored} of last ${homeTeam.lastHomeMatches.length} home games (${homeScoredPct.toFixed(0)}%)`,
    emoji: '⚽',
    priority: 90,
    category: 'SCORING',
    severity: homeScoredPct >= 80 ? 'HIGH' : 'MEDIUM',
  });
  
  // Factor 2: Away team scoring rate (25% weight)
  const awayScored = awayTeam.lastAwayMatches.filter(m => m.goalsScored > 0).length;
  const awayScoredPct = (awayScored / awayTeam.lastAwayMatches.length) * 100;
  const awayScoreScore = awayScoredPct;
  
  insights.push({
    text: `${awayTeam.name} scored in ${awayScored} of last ${awayTeam.lastAwayMatches.length} away games (${awayScoredPct.toFixed(0)}%)`,
    emoji: '⚽',
    priority: 90,
    category: 'SCORING',
    severity: awayScoredPct >= 80 ? 'HIGH' : 'MEDIUM',
  });
  
  // Factor 3: H2H BTTS (25% weight)
  const h2hBTTSScore = h2h.bttsPercentage;
  
  if (h2h.bttsPercentage >= 60) {
    insights.push({
      text: `BTTS in ${h2h.bttsCount} of last ${h2h.matches.length} H2H meetings (${h2h.bttsPercentage.toFixed(0)}%)`,
      emoji: '📊',
      priority: 95,
      category: 'H2H',
      severity: h2h.bttsPercentage >= 80 ? 'HIGH' : 'MEDIUM',
    });
  }
  
  // Factor 4: Home defensive weakness (20% weight)
  const homeDefenseScore = 100 - (homeTeam.stats.cleanSheets / homeTeam.lastHomeMatches.length * 100);
  
  if (homeTeam.stats.cleanSheetDrought >= 8) {
    insights.push({
      text: `${homeTeam.name}: 0 clean sheets in last ${homeTeam.stats.cleanSheetDrought} games`,
      emoji: '🔓',
      priority: 85,
      category: 'DEFENSIVE',
      severity: homeTeam.stats.cleanSheetDrought >= 12 ? 'CRITICAL' : 'HIGH',
    });
  }
  
  // Factor 5: Away defensive weakness (20% weight)
  const awayDefenseScore = 100 - (awayTeam.stats.cleanSheets / awayTeam.lastAwayMatches.length * 100);
  
  // Calculate weighted score
  const bttsScore = (
    homeScoreScore * 0.25 +
    awayScoreScore * 0.25 +
    h2hBTTSScore * 0.25 +
    homeDefenseScore * 0.125 +
    awayDefenseScore * 0.125
  );
  
  // Convert to probability
  const yesProbability = bttsScore;
  const noProbability = 100 - yesProbability;
  
  // Determine rating
  const rating = getRating(yesProbability);
  
  // Calculate confidence
  const signals = [
    { score: homeScoreScore, weight: 0.25 },
    { score: awayScoreScore, weight: 0.25 },
    { score: h2hBTTSScore, weight: 0.25 },
    { score: homeDefenseScore, weight: 0.125 },
    { score: awayDefenseScore, weight: 0.125 },
  ];
  
  const signalsForYes = signals.filter(s => s.score >= 60).length;
  const signalsForNo = signals.filter(s => s.score < 40).length;
  
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (signalsForYes >= 4 || signalsForNo >= 4) {
    confidence = 'HIGH';
  } else if (signalsForYes >= 3 || signalsForNo >= 3) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }
  
  // Detect conflicts
  if (homeScoreScore < 50 && awayScoreScore < 50 && h2hBTTSScore >= 70) {
    conflicts.push({
      favors: 'yes',
      factor: 'H2H history suggests BTTS',
      weight: 0.25,
    });
    conflicts.push({
      favors: 'no',
      factor: 'Both teams struggling to score recently',
      weight: 0.50,
    });
  }
  
  // Generate recommendation
  let recommendation: string;
  if (rating === 'VERY_LIKELY' || rating === 'LIKELY') {
    recommendation = 'BTTS - Yes ✅';
  } else if (rating === 'VERY_UNLIKELY' || rating === 'UNLIKELY') {
    recommendation = 'BTTS - No ✅';
  } else {
    recommendation = 'BTTS - Neutral 🤔';
  }
  
  // Sort insights by priority
  const topInsights = insights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
  
  return {
    market: 'BTTS',
    probabilities: {
      yes: yesProbability,
      no: noProbability,
    },
    rating,
    confidence,
    insights: topInsights,
    conflictingSignals: conflicts.length > 0 ? conflicts : undefined,
    recommendation,
  };
}

// Similar functions for other markets...
// predictOver25(), predictMatchResult(), predictFirstHalf()

function getRating(probability: number): MarketPrediction['rating'] {
  if (probability >= 80) return 'VERY_LIKELY';
  if (probability >= 65) return 'LIKELY';
  if (probability >= 50) return 'NEUTRAL';
  if (probability >= 35) return 'UNLIKELY';
  return 'VERY_UNLIKELY';
}
```

---

### Phase 5: API Endpoint (Week 3)

**Goal:** Expose predictions via clean API

```typescript
// /api/matches/[matchId]/insights.ts

app.get('/api/matches/:matchId/insights', async (c) => {
  const matchId = c.req.param('matchId');
  
  try {
    // 1. Get match details
    const match = await getMatchDetails(matchId, c);
    
    if (!match) {
      return c.json({ error: 'Match not found' }, 404);
    }
    
    // 2. Check cache (1 hour TTL)
    const cacheKey = `insights:${matchId}`;
    const cached = await c.env.KV.get(cacheKey, 'json');
    
    if (cached && !isStale(cached, 60 * 60)) {
      return c.json(cached);
    }
    
    // 3. Fetch team data
    const [homeTeam, awayTeam, h2h] = await Promise.all([
      getTeamData(match.homeTeamId, c),
      getTeamData(match.awayTeamId, c),
      getH2HData(match.homeTeamId, match.awayTeamId, c),
    ]);
    
    // 4. Detect patterns
    const homePatterns = detectPatterns(homeTeam, 'home');
    const awayPatterns = detectPatterns(awayTeam, 'away');
    const h2hPatterns = detectH2HPatterns(h2h);
    
    // 5. Generate insights
    const homeInsights = generateInsights(homePatterns, homeTeam.name);
    const awayInsights = generateInsights(awayPatterns, awayTeam.name);
    const h2hInsights = generateInsights(h2hPatterns, '');
    
    // 6. Generate market predictions
    const predictions = await generateMarketPredictions(
      homeTeam,
      awayTeam,
      h2h
    );
    
    // 7. Build response
    const response = {
      match: {
        id: matchId,
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        date: match.date,
        league: match.league,
      },
      context: {
        homeTeam: {
          form: homeTeam.stats.form,
          position: homeTeam.stats.leaguePosition,
          daysSinceLastMatch: homeTeam.daysSinceLastMatch,
          motivation: calculateMotivation(homeTeam),
        },
        awayTeam: {
          form: awayTeam.stats.form,
          position: awayTeam.stats.leaguePosition,
          daysSinceLastMatch: awayTeam.daysSinceLastMatch,
          motivation: calculateMotivation(awayTeam),
        },
      },
      predictions,
      insights: {
        home: homeInsights.slice(0, 5),
        away: awayInsights.slice(0, 5),
        h2h: h2hInsights.slice(0, 3),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        confidence: calculateOverallConfidence(predictions),
      },
    };
    
    // 8. Cache response (1 hour)
    await c.env.KV.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 60 * 60,
    });
    
    // 9. Set cache headers for edge
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('CDN-Cache-Control', 'max-age=3600');
    
    return c.json(response);
    
  } catch (error) {
    console.error('Error generating insights:', error);
    return c.json({ error: 'Failed to generate insights' }, 500);
  }
});

function calculateMotivation(team: TeamData): string {
  const pos = team.stats.leaguePosition;
  const pointsFromCL = team.stats.pointsFromCL;
  const pointsFromRel = team.stats.pointsFromRelegation;
  
  if (pos <= 2 && team.stats.pointsFromFirst <= 5) {
    return 'TITLE_RACE';
  } else if (pos >= 3 && pos <= 6 && pointsFromCL <= 3) {
    return 'CL_RACE';
  } else if (pos >= 5 && pos <= 8 && team.stats.pointsFromCL <= 6) {
    return 'EUROPA_RACE';
  } else if (pointsFromRel <= 5) {
    return 'RELEGATION_BATTLE';
  } else if (pointsFromCL > 8 && pointsFromRel > 8) {
    return 'MID_TABLE';
  } else {
    return 'SECURE';
  }
}

function calculateOverallConfidence(
  predictions: MarketPrediction[]
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const confidences = predictions.map(p => p.confidence);
  const highCount = confidences.filter(c => c === 'HIGH').length;
  const mediumCount = confidences.filter(c => c === 'MEDIUM').length;
  
  if (highCount >= 3) return 'HIGH';
  if (highCount + mediumCount >= 3) return 'MEDIUM';
  return 'LOW';
}
```

---

## Part 4: API Response Example

### Complete Response Format

```json
{
  "match": {
    "id": "12345",
    "homeTeam": "Manchester United",
    "awayTeam": "Chelsea",
    "date": "2024-01-20T15:00:00Z",
    "league": "Premier League"
  },
  
  "context": {
    "homeTeam": {
      "form": "LWLLW",
      "position": 6,
      "daysSinceLastMatch": 3,
      "motivation": "EUROPA_RACE"
    },
    "awayTeam": {
      "form": "WWDWW",
      "position": 2,
      "daysSinceLastMatch": 7,
      "motivation": "SECURE"
    }
  },
  
  "predictions": [
    {
      "market": "BTTS",
      "probabilities": {
        "yes": 78,
        "no": 22
      },
      "rating": "LIKELY",
      "confidence": "HIGH",
      "insights": [
        {
          "text": "Man United scored in 4 of last 5 home games (80%)",
          "emoji": "⚽",
          "priority": 90,
          "category": "SCORING",
          "severity": "HIGH"
        },
        {
          "text": "Chelsea scored in 5 of last 5 away games (100%)",
          "emoji": "⚽",
          "priority": 90,
          "category": "SCORING",
          "severity": "HIGH"
        },
        {
          "text": "BTTS in 4 of last 5 H2H meetings (80%)",
          "emoji": "📊",
          "priority": 95,
          "category": "H2H",
          "severity": "HIGH"
        },
        {
          "text": "Man United: 0 clean sheets in last 10 games",
          "emoji": "🔓",
          "priority": 85,
          "category": "DEFENSIVE",
          "severity": "CRITICAL"
        }
      ],
      "recommendation": "BTTS - Yes ✅"
    },
    
    {
      "market": "OVER_25",
      "probabilities": {
        "yes": 71,
        "no": 29
      },
      "rating": "LIKELY",
      "confidence": "MEDIUM",
      "insights": [
        {
          "text": "Man United averaging 2.4 goals per game (L5)",
          "emoji": "🔥",
          "priority": 75,
          "category": "SCORING",
          "severity": "HIGH"
        },
        {
          "text": "Chelsea averaging 2.2 goals per game (L5)",
          "emoji": "📈",
          "priority": 75,
          "category": "SCORING",
          "severity": "HIGH"
        },
        {
          "text": "Last 4 H2H had over 2.5 goals (avg: 3.5)",
          "emoji": "⚡",
          "priority": 90,
          "category": "H2H",
          "severity": "HIGH"
        }
      ],
      "recommendation": "Over 2.5 - Yes ✅"
    },
    
    {
      "market": "MATCH_RESULT",
      "probabilities": {
        "home": 24,
        "draw": 9,
        "away": 67
      },
      "rating": "LIKELY",
      "confidence": "MEDIUM",
      "insights": [
        {
          "text": "Man United lost 4 of last 5 home matches (80%)",
          "emoji": "🔴",
          "priority": 100,
          "category": "FORM",
          "severity": "CRITICAL"
        },
        {
          "text": "Chelsea won 4 of last 5 away matches (80%)",
          "emoji": "🔥",
          "priority": 95,
          "category": "FORM",
          "severity": "HIGH"
        },
        {
          "text": "Chelsea unbeaten in last 8 away games",
          "emoji": "💪",
          "priority": 85,
          "category": "FORM",
          "severity": "HIGH"
        }
      ],
      "conflictingSignals": [
        {
          "favors": "home",
          "factor": "Won 4 of last 5 H2H meetings",
          "weight": 0.25
        },
        {
          "favors": "away",
          "factor": "Better recent form (80% vs 20%)",
          "weight": 0.30
        },
        {
          "favors": "away",
          "factor": "Chelsea well-rested (7 days vs 3)",
          "weight": 0.12
        }
      ],
      "recommendation": "Chelsea Win or Draw ✅"
    },
    
    {
      "market": "FIRST_HALF",
      "probabilities": {
        "yes": 58,
        "no": 42
      },
      "rating": "NEUTRAL",
      "confidence": "LOW",
      "insights": [
        {
          "text": "Man United scored 1st half in only 2 of L5 (40%)",
          "emoji": "🐌",
          "priority": 70,
          "category": "TIMING",
          "severity": "MEDIUM"
        },
        {
          "text": "Chelsea scored 1st half in 4 of L5 (80%)",
          "emoji": "⚡",
          "priority": 70,
          "category": "TIMING",
          "severity": "MEDIUM"
        },
        {
          "text": "Last 3 H2H: Goals after 60th minute only",
          "emoji": "⏰",
          "priority": 65,
          "category": "TIMING",
          "severity": "MEDIUM"
        }
      ],
      "recommendation": "Chelsea to score first 🤔"
    }
  ],
  
  "insights": {
    "home": [
      {
        "text": "Man United lost 4 of last 5 home matches (80%)",
        "emoji": "🔴",
        "priority": 100,
        "category": "FORM",
        "severity": "CRITICAL"
      },
      {
        "text": "Man United: 0 clean sheets in last 10 games",
        "emoji": "🔓",
        "priority": 85,
        "category": "DEFENSIVE",
        "severity": "CRITICAL"
      },
      {
        "text": "Man United scored 1st half in only 2 of L5 (40%)",
        "emoji": "🐌",
        "priority": 70,
        "category": "TIMING",
        "severity": "MEDIUM"
      }
    ],
    "away": [
      {
        "text": "Chelsea won 4 of last 5 away matches (80%)",
        "emoji": "🔥",
        "priority": 95,
        "category": "FORM",
        "severity": "HIGH"
      },
      {
        "text": "Chelsea scored in 5 of last 5 away games (100%)",
        "emoji": "⚽",
        "priority": 90,
        "category": "SCORING",
        "severity": "HIGH"
      },
      {
        "text": "Chelsea averaging 2.2 goals per game (L5)",
        "emoji": "📈",
        "priority": 75,
        "category": "SCORING",
        "severity": "HIGH"
      }
    ],
    "h2h": [
      {
        "text": "BTTS in 4 of last 5 H2H meetings (80%)",
        "emoji": "📊",
        "priority": 95,
        "category": "H2H",
        "severity": "HIGH"
      },
      {
        "text": "Last 4 H2H had over 2.5 goals (avg: 3.5)",
        "emoji": "⚡",
        "priority": 90,
        "category": "H2H",
        "severity": "HIGH"
      },
      {
        "text": "Last 3 H2H: Goals after 60th minute only",
        "emoji": "⏰",
        "priority": 65,
        "category": "TIMING",
        "severity": "MEDIUM"
      }
    ]
  },
  
  "meta": {
    "generatedAt": "2024-01-19T10:30:00Z",
    "confidence": "MEDIUM"
  }
}
```

---

## Part 5: Week-by-Week Implementation Roadmap

### Week 1: Foundation
- ✅ Data fetching (team data, H2H, standings)
- ✅ Caching layer (KV store)
- ✅ Stats calculation functions
- ✅ Pattern detection (basic patterns)
- ✅ Test with 5-10 real matches

**Deliverable:** Can fetch and cache all data needed

---

### Week 2: Intelligence
- ✅ Insight generation (templates)
- ✅ BTTS probability calculation
- ✅ Over/Under 2.5 calculation
- ✅ Factor weighting system
- ✅ Conflict detection

**Deliverable:** Can generate BTTS and O/U predictions

---

### Week 3: Polish & API
- ✅ Match result (1X2) calculation
- ✅ First half predictions
- ✅ API endpoint implementation
- ✅ Response formatting
- ✅ Error handling
- ✅ Performance optimization

**Deliverable:** Working API endpoint

---

### Week 4: Testing & Refinement
- ✅ Test with 50+ real matches
- ✅ Track accuracy
- ✅ Adjust weights based on results
- ✅ Fix edge cases
- ✅ Documentation

**Deliverable:** Production-ready endpoint

---

## Part 6: Key Decisions Summary

### 1. NOT a Predictor Bot ✅
```
You're building: Data aggregation + analysis tool
NOT: "Sure win" predictor scam
Value: Saves users 15 minutes per match
Accuracy: Realistic 60-70%, not fake 90%
```

### 2. Factors Apply to All Markets ✅
```
But with different weights:
- BTTS: Scoring rate > home advantage
- O/U 2.5: Average goals > motivation  
- 1X2: All factors equally important
- 1st Half: Timing patterns > everything
```

### 3. Transparency is Key ✅
```
Always show:
- Conflicting signals
- Confidence levels
- Why prediction might be wrong
- All factors considered
```

### 4. Focus on Easy Markets First ✅
```
Priority:
1. BTTS (easiest, 70% accuracy possible)
2. Over/Under 2.5 (70% accuracy)
3. First Half (65% accuracy)
4. Match Result (55-60% accuracy)
```

---

## Bottom Line

**Timeline:** 3-4 weeks to fully functional insights endpoint

**Accuracy Expectations:**
- BTTS: 65-75%
- Over 2.5: 60-70%
- 1X2: 50-60%
- First Half: 60-65%

**Positioning:**
"We don't predict the future. We help you make better decisions by aggregating data you'd check manually anyway. We're right ~70% of the time on BTTS. We show our work and admit when we're uncertain."

**Differentiation:**
- Transparent (show all factors)
- Educational (explain WHY)
- Realistic (admit limitations)
- Time-saving (30 seconds vs 15 minutes)
- Unbiased (no house edge)

**You're building a research assistant, not a crystal ball.** 🎯