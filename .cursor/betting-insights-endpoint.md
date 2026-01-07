# Betting Insights Endpoint: Complete Implementation Plan

## Table of Contents
1. [Is This a Predictor Bot? (Honest Answer)](#honest-answer)
2. [How Factors Apply to Different Markets](#factor-application)
3. [Complete Implementation Plan](#implementation-plan)
4. [API Specification](#api-specification)
5. [Week-by-Week Roadmap](#roadmap)

---

## TO ADD TO ALGORITHM
1. Missing Input: "The Motivation Trap"
Your algorithm assumed Napoli would play with 100% intensity because they are in a title race.

2.The Blind Spot: Your logic didn't account for the "Look-Ahead Factor." When a Tier 1 team plays the #18 team right before playing the #1 team, their psychological intensity often drops by 10-15%. Verona, playing for their lives, had 110% intensity.

3.The Fix: Add a "Schedule Proximity" flag. If a team plays a "Top 3 Rival" within 4 days of today's match, reduce the win probability of today's "easy" match by 5-10%.


---

## Advanced Algorithm Layers: Mind, Mood, and DNA

### Overview: Three-Layer Data Strategy

To optimize the algorithm without over-correcting, we use three distinct layers that separate baseline quality (Mind), recent momentum (Mood), and technical trends (DNA). This ensures that a single bad week doesn't "break" the math, but major tactical changes are still respected.

### 1. The Mind (Baseline Quality - 50 Matches)

**Data Source:** Last 50 Matches  
**Purpose:** Defines the team's "True Tier" and prevents being fooled by lucky streaks

**Efficiency Index (EI):**
$$EI = (\text{Avg Points per Game}) + (\text{Goal Difference} / 10)$$

**Tier Categorization:**
- **Tier 1:** EI ≥ 2.0 (Elite teams - e.g., Man City, Liverpool)
- **Tier 2:** EI ≥ 1.5 (Top tier - e.g., Top 6)
- **Tier 3:** EI ≥ 1.0 (Mid tier - e.g., Mid-table)
- **Tier 4:** EI < 1.0 (Lower tier - e.g., Relegation battle)

**Key Insight:** If a Tier 1 team has a bad week, the algorithm remembers they are still Tier 1. This is the team's "Identity."

### 2. The Mood (Recent Momentum - 10 Matches)

**Data Source:** Last 10 Matches (30% weight in predictions)  
**Purpose:** Catches the team's current energy, injuries, and confidence

**The "Mood vs. Mind" Gap:** This is where value bets are found

**Sleeping Giant Pattern:**
- Mind = Tier 1 | Mood = Tier 4
- High-value bet: The odds will be high, but the "Class" remains
- Algorithm flags this as a value opportunity (+10% probability)

**Over-performer Pattern:**
- Mind = Tier 4 | Mood = Tier 1
- Regression risk: The algorithm warns that they are "Due" for a loss
- Reduces probability by 8% and flags as regression risk

### 3. The DNA (Technical Trends - Season Stats)

**Data Source:** Season Statistics Endpoint  
**Purpose:** Refines specific markets (BTTS, O/U, 1st Half) rather than the winner

**Components:**
- **Formation Stability:** Most played formation vs. match formation
- **Under/Over Distributions:** Season averages (e.g., 82% Under 2.5)
- **Goal Minute Distribution:** When teams score/concede goals
- **Clean Sheet % & Failed to Score %:** Defensive and offensive DNA

**Formation Stability Filter:**
- **Tiered Reduction:** Based on formation usage percentage
  - <20% usage: 20-25% confidence reduction
  - 20-40% usage: 10-15% reduction
  - 40-60% usage: 5-10% reduction
  - 60-80% usage: 0-5% reduction
- **Market-Specific Impact:**
  - Match Result (1X2): Full reduction
  - BTTS/O/U 2.5: 40% less impact (formations less critical for goal totals)
  - First Half: 20% less impact
- **Early Season Adjustment:** Reduce penalty by 50% (teams experiment more early season)
- **Combined Impact:** Both teams experimental capped at 30% total reduction

**Frustration Filter (Goal Efficiency):**
- If team has 70%+ "Under 2.5" season average, never bet "Over" just because they scored 3 goals last week
- Trust the long-term DNA over recent outliers
- Adjusts Over probability by -6% to -9% when DNA strongly suggests Under

### 4. The Safety Layer (Non-Mathematical Flags)

Binary "Yes/No" flags that trigger confidence adjustments:

| Flag | Logic | Action |
|------|-------|--------|
| **Regression Risk** | Tier 3 team won 5+ in a row | Reduce Confidence by 15% |
| **Motivation Clash** | TITLE_RACE vs MID_TABLE | +5% Win Prob to motivated team |
| **Live Dog** | Bottom team scored in 2 of last 3 away | Switch "Win to Nil" to "BTTS" (+10% BTTS prob) |

---

## 1. The "Stability Filter" (Lineups)
The lineups section is arguably the most valuable part of this endpoint.

The Problem: A team in good form might have achieved it playing a 4-3-3, but today the manager is switching to a 5-4-1 due to injuries.

The Implementation: If the "Formation Played" today matches the formation used in >80% of the season, keep your "Mind" (Baseline) weight at 100%.

The Trigger: If the formation is a "Negative Outlier" (rarely used), reduce the confidence of the match result. It shows the team is "Experimental" today, which increases the chance of a draw or upset.

## 2. Goal Efficiency (Under/Over Distributions)
Your endpoint shows that Bologna has a 14/17 (82%) Under 2.5 rate.

Why it's better than raw match data: It shows the "distribution density." Even if Bologna had one crazy 4-3 game recently, this stat proves their Identity is low-scoring.

Implementation: If your algorithm predicts a win, use the Under/Over stats to choose the "Safety". For Bologna, a "Win + Under 3.5" is a much more accurate bet than a straight "Win."

## 3. The "In-Play" Momentum (Goal Minutes)
You can use the minute distribution to solve the "First Half Result" market.

Bologna Logic: 0% of goals in the first 15 mins; 28% in 46-60 mins.

The Betting Tip: "Draw at Half Time" is a high-confidence play here because they are "Late Starters."

The Progress Bar Idea: In your helper, instead of just saying BTTS 3/5, show a "Danger Zone" bar.

"Danger Zone: This team concedes 35% of their goals in the 61-75 min window."

## Summary: Your Data StrategyLayerSourceRole in AlgorithmThe Mind50 MatchesCalculate the Efficiency Index (EI). Defines the Tier.The Mood10 MatchesCalculate the Current Momentum (30% weight).The DNASeason StatsQualify the Bets. Use Clean Sheets to predict "To Nil" and Lineups to check "Stability."

To optimize your algorithm without over-correcting, you should think of your data in three distinct layers: The Mind (Class), The Mood (Form), and The DNA (Style).By keeping these layers separate, you ensure that a single bad week doesn't "break" the math, but a major tactical change (like a new manager) is still respected.## 1. The Mind (Baseline Quality)Data Source: Last 50 Matches.Purpose: Defines the team's "True Tier" and prevents you from being fooled by a lucky streak.The Efficiency Index (EI): Instead of using standings, calculate their $EI$ over 50 games.$$EI = (\text{Avg Points per Game}) + (\text{Goal Difference} / 10)$$The Anchor: Use this $EI$ to categorize teams into Tiers (1–4). This is the team's "Identity." If a Tier 1 team has a bad week, the algorithm remembers they are still Tier 1.## 2. The Mood (Recent Momentum)Data Source: Last 10 Matches (Your core 30% weight).Purpose: Catches the team's current energy, injuries, and confidence.The "Mood vs. Mind" Gap: This is where you find Value.The Sleeping Giant: Mind = Tier 1 | Mood = Tier 4. (The odds will be high, but the "Class" remains. This is a high-value bet).The Over-performer: Mind = Tier 4 | Mood = Tier 1. (This is a "Fake Giant." The algorithm should warn you that they are "Due" for a loss).## 3. The DNA (Technical Trends)Data Source: Season Statistics Endpoint (Lineups, Under/Over, Goal Minutes).Purpose: Refines the specific market (BTTS, O/U, 1st Half) rather than the winner.Formation Stability: If today's lineup matches their "Most Played Formation" (from the stats endpoint), trust your 50-match baseline. If they switch (e.g., 4-3-3 to 5-4-1), reduce the confidence score—the team is experimenting.The "Frustration" Filter: Check the Clean Sheet % and Failed to Score %.If a team has a 70% "Under 2.5" season average, never bet the "Over" just because they scored 3 goals last week. Trust the long-term DNA.## 4. The "Safety Layer" (Non-Mathematical Flags)These are binary "Yes/No" flags that don't change your weights but trigger a Confidence Adjustment.FlagLogicActionRegression RiskIf a Tier 3 team has won 5 in a row.Reduce Confidence by 15%.New ManagerIf manager has been there $<3$ matches.Halve the "Recent Form" weight (old form is irrelevant).Motivation ClashIf one team is TITLE_RACE and other is MID_TABLE.Add +5% Win Prob to the motivated team.Live DogBottom team has scored in 2 of last 3 away games.Switch "Win to Nil" bet to "BTTS."

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

**Note:** Base weights shown below are adjusted dynamically based on:
- **Rest Days:** If `daysSinceLastMatch > 10`, recent form weight reduced by 30-50%
- **Early Season:** If round < 5, recent form reduced by 40%, H2H/historical increased
- **Low H2H:** If H2H matches < 5, H2H weight reduced by 40-60%, redistributed to recent form
- **Mind/Mood Gap:** Sleeping Giant (Tier 1 Mind, Tier 4 Mood) adds value, Over-performer reduces confidence
- **Formation Stability:** Experimental formations reduce confidence by 15-25%
- **DNA Layer:** Season Under/Over distributions override recent outliers (Frustration Filter)
- **Safety Flags:** Regression Risk reduces confidence by 15%, Motivation Clash adds +5% win probability

```typescript
// Weight adjustments per market (BASE weights - will be adjusted dynamically)
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
   Note: Uses recency-weighted percentage (2025 matches weighted higher than 2023)
   
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
- Recency weighting: 3 matches from 2025 (weight 1.0), 2 from 2023 (weight 0.5)
- Weighted BTTS%: 85% (vs simple 80%) → Score: +42

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

10+ days rest:
→ Recent form becomes less reliable
→ Recent form weight reduced by 30-50%
→ More weight given to H2H and historical data
→ Prediction becomes more conservative
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
   Note: Uses recency-weighted average (recent high-scoring matches weighted more)
   
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

// Helper: Filter out friendly matches
function filterNonFriendlyMatches(matches: Match[]): Match[] {
  return matches.filter(match => {
    const leagueName = match.league?.name || '';
    return !leagueName.toLowerCase().includes('friendly');
  });
}

// Helper: Extract round number from league.round string
// Examples: "Regular Season - 3" → 3, "Matchday 5" → 5, "Round 2" → 2
function extractRoundNumber(roundString: string): number | null {
  if (!roundString) return null;
  
  // Try to extract number from common patterns
  const patterns = [
    /(\d+)/,                           // Any number
    /regular season[^\d]*(\d+)/i,      // "Regular Season - 3"
    /matchday[^\d]*(\d+)/i,           // "Matchday 5"
    /round[^\d]*(\d+)/i,              // "Round 2"
  ];
  
  for (const pattern of patterns) {
    const match = roundString.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 100) return num; // Sanity check
    }
  }
  
  return null;
}

// Helper: Check if match is in early season (< 5 rounds)
function isEarlySeason(roundString: string): boolean {
  const round = extractRoundNumber(roundString);
  return round !== null && round < 5;
}

// Helper: Calculate recency weights for H2H matches
// More recent matches (2025) get higher weight than older ones (2023)
function calculateH2HRecencyWeights(matches: Match[]): number[] {
  const currentYear = new Date().getFullYear();
  
  return matches.map(match => {
    const matchDate = new Date(match.date);
    const matchYear = matchDate.getFullYear();
    const yearsDiff = currentYear - matchYear;
    
    // Exponential decay: 2025 = 1.0, 2024 = 0.7, 2023 = 0.5, 2022 = 0.3, etc.
    // More recent matches get exponentially higher weight
    const baseWeight = Math.pow(0.7, yearsDiff);
    
    // Also consider months within the same year (recent months get slight boost)
    const monthsDiff = (currentYear - matchYear) * 12 + 
                       (new Date().getMonth() - matchDate.getMonth());
    const monthAdjustment = Math.max(0.9, 1 - (monthsDiff * 0.02)); // Small monthly decay
    
    return baseWeight * monthAdjustment;
  });
}

// Helper: Calculate weighted average for H2H stats
function calculateWeightedAverage(
  values: number[],
  weights: number[]
): number {
  if (values.length === 0 || values.length !== weights.length) return 0;
  
  const weightedSum = values.reduce((sum, val, idx) => sum + val * weights[idx], 0);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
}

// Helper: Calculate Efficiency Index (EI) for Mind layer
// EI = (Avg Points per Game) + (Goal Difference / 10)
function calculateEfficiencyIndex(matches: Match[]): number {
  if (matches.length === 0) return 0;
  
  let totalPoints = 0;
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  
  for (const match of matches) {
    // Calculate points: Win = 3, Draw = 1, Loss = 0
    let points = 0;
    if (match.result === 'W') points = 3;
    else if (match.result === 'D') points = 1;
    
    totalPoints += points;
    totalGoalsScored += match.goalsScored || 0;
    totalGoalsConceded += match.goalsConceded || 0;
  }
  
  const avgPointsPerGame = totalPoints / matches.length;
  const goalDifference = totalGoalsScored - totalGoalsConceded;
  const ei = avgPointsPerGame + (goalDifference / 10);
  
  return ei;
}

// Helper: Categorize team into Tier (1-4) based on Efficiency Index
function categorizeTier(efficiencyIndex: number): 1 | 2 | 3 | 4 {
  // Tier thresholds (adjust based on league quality)
  if (efficiencyIndex >= 2.0) return 1;      // Elite (e.g., Man City, Liverpool)
  if (efficiencyIndex >= 1.5) return 2;      // Top tier (e.g., Top 6)
  if (efficiencyIndex >= 1.0) return 3;      // Mid tier (e.g., Mid-table)
  return 4;                                  // Lower tier (e.g., Relegation battle)
}

// Helper: Calculate Mood tier from last 10 matches
function calculateMoodTier(matches: Match[]): 1 | 2 | 3 | 4 {
  if (matches.length === 0) return 3; // Default to mid-tier if no data
  
  const moodEI = calculateEfficiencyIndex(matches);
  return categorizeTier(moodEI);
}

// Helper: Detect Mind vs Mood gap and identify patterns
function detectMoodVsMindGap(mindTier: number, moodTier: number): TeamMood {
  const mindMoodGap = Math.abs(mindTier - moodTier);
  const isSleepingGiant = mindTier === 1 && moodTier === 4;
  const isOverPerformer = mindTier === 4 && moodTier === 1;
  
  return {
    tier: moodTier as 1 | 2 | 3 | 4,
    mindMoodGap,
    isSleepingGiant,
    isOverPerformer,
  };
}

// Helper: Calculate formation frequency from matches
function calculateFormationFrequency(matches: Match[]): Record<string, number> {
  const formationCounts: Record<string, number> = {};
  
  for (const match of matches) {
    const formation = match.formation || 'unknown';
    formationCounts[formation] = (formationCounts[formation] || 0) + 1;
  }
  
  // Convert to percentages
  const total = matches.length;
  const frequencies: Record<string, number> = {};
  
  for (const [formation, count] of Object.entries(formationCounts)) {
    frequencies[formation] = (count / total) * 100;
  }
  
  return frequencies;
}

// Helper: Get most played formation
function getMostPlayedFormation(formationFrequency: Record<string, number>): string {
  let maxFreq = 0;
  let mostPlayed = 'unknown';
  
  for (const [formation, freq] of Object.entries(formationFrequency)) {
    if (freq > maxFreq) {
      maxFreq = freq;
      mostPlayed = formation;
    }
  }
  
  return mostPlayed;
}

// Helper: Calculate goal minute distribution from goal minute data (from api-football)
function calculateGoalMinuteDistributionFromData(goalMinutes: Array<{minute: number; goals: number}>): {
  distribution: Record<string, number>;
  firstHalfPercentage: number;
  earlyGoalPercentage: number;
  dangerZones: Array<{window: string, percentage: number}>;
} {
  const timeWindows = {
    '0-15': 0,
    '16-30': 0,
    '31-45': 0,
    '46-60': 0,
    '61-75': 0,
    '76-90': 0,
  };
  
  let totalGoals = 0;
  let firstHalfGoals = 0;
  let earlyGoals = 0;
  
  for (const {minute, goals} of goalMinutes) {
    totalGoals += goals;
    
    if (minute <= 15) {
      timeWindows['0-15'] += goals;
      earlyGoals += goals;
      firstHalfGoals += goals;
    } else if (minute <= 30) {
      timeWindows['16-30'] += goals;
      firstHalfGoals += goals;
    } else if (minute <= 45) {
      timeWindows['31-45'] += goals;
      firstHalfGoals += goals;
    } else if (minute <= 60) {
      timeWindows['46-60'] += goals;
    } else if (minute <= 75) {
      timeWindows['61-75'] += goals;
    } else {
      timeWindows['76-90'] += goals;
    }
  }
  
  // Convert to percentages
  const distribution: Record<string, number> = {};
  for (const [window, count] of Object.entries(timeWindows)) {
    distribution[window] = totalGoals > 0 ? (count / totalGoals) * 100 : 0;
  }
  
  const firstHalfPercentage = totalGoals > 0 ? (firstHalfGoals / totalGoals) * 100 : 0;
  const earlyGoalPercentage = totalGoals > 0 ? (earlyGoals / totalGoals) * 100 : 0;
  
  // Identify danger zones (windows with >20% of goals)
  const dangerZones = Object.entries(distribution)
    .filter(([_, pct]) => pct > 20)
    .map(([window, percentage]) => ({ window, percentage }))
    .sort((a, b) => b.percentage - a.percentage);
  
  return {
    distribution,
    firstHalfPercentage,
    earlyGoalPercentage,
    dangerZones,
  };
}

// Helper: Calculate goal minute distribution from matches (fallback when api-football data unavailable)
function calculateGoalMinuteDistribution(matches: Match[]): {
  distribution: Record<string, number>;
  firstHalfPercentage: number;
  earlyGoalPercentage: number;
  dangerZones: Array<{window: string, percentage: number}>;
} {
  const timeWindows = {
    '0-15': 0,
    '16-30': 0,
    '31-45': 0,
    '46-60': 0,
    '61-75': 0,
    '76-90': 0,
  };
  
  let totalGoals = 0;
  let firstHalfGoals = 0;
  let earlyGoals = 0;
  
  for (const match of matches) {
    // Process goals scored
    const goalsScored = match.goalsScored || 0;
    const goalsConceded = match.goalsConceded || 0;
    
    // For simplicity, distribute goals evenly across match time
    // In production, use actual goal minute data from API
    const goalsPerWindow = (goalsScored + goalsConceded) / 6;
    
    timeWindows['0-15'] += goalsPerWindow;
    timeWindows['16-30'] += goalsPerWindow;
    timeWindows['31-45'] += goalsPerWindow;
    firstHalfGoals += goalsPerWindow * 3;
    earlyGoals += goalsPerWindow;
    
    timeWindows['46-60'] += goalsPerWindow;
    timeWindows['61-75'] += goalsPerWindow;
    timeWindows['76-90'] += goalsPerWindow;
    
    totalGoals += goalsScored + goalsConceded;
  }
  
  // Convert to percentages
  const distribution: Record<string, number> = {};
  for (const [window, count] of Object.entries(timeWindows)) {
    distribution[window] = totalGoals > 0 ? (count / totalGoals) * 100 : 0;
  }
  
  const firstHalfPercentage = totalGoals > 0 ? (firstHalfGoals / totalGoals) * 100 : 0;
  const earlyGoalPercentage = totalGoals > 0 ? (earlyGoals / totalGoals) * 100 : 0;
  
  // Identify danger zones (windows with >20% of goals)
  const dangerZones = Object.entries(distribution)
    .filter(([_, pct]) => pct > 20)
    .map(([window, percentage]) => ({ window, percentage }))
    .sort((a, b) => b.percentage - a.percentage);
  
  return {
    distribution,
    firstHalfPercentage,
    earlyGoalPercentage,
    dangerZones,
  };
}

// Helper: Detect safety flags
function detectSafetyFlags(
  team: TeamData,
  opponent: TeamData
): SafetyFlags {
  // Regression Risk: Tier 3 team won 5+ in a row
  const regressionRisk = team.mind.tier === 3 && team.stats.currentWinStreak >= 5;
  
  // Motivation Clash: TITLE_RACE vs MID_TABLE
  const homeMotivation = calculateMotivation(team);
  const awayMotivation = calculateMotivation(opponent);
  const motivationClash = 
    (homeMotivation === 'TITLE_RACE' && awayMotivation === 'MID_TABLE') ||
    (awayMotivation === 'TITLE_RACE' && homeMotivation === 'MID_TABLE');
  
  // Live Dog: Bottom team scored in 2 of last 3 away
  const isBottomTeam = team.stats.leaguePosition >= 15;
  const recentAwayGoals = team.lastAwayMatches.slice(0, 3)
    .filter(m => (m.goalsScored || 0) > 0).length;
  const liveDog = isBottomTeam && recentAwayGoals >= 2;
  
  return {
    regressionRisk,
    motivationClash,
    liveDog,
  };
}

interface TeamMind {
  efficiencyIndex: number;        // EI = (Avg Points per Game) + (Goal Difference / 10)
  tier: 1 | 2 | 3 | 4;            // Categorized based on EI
  last50Matches: Match[];         // Extended match history for baseline
}

interface TeamMood {
  tier: 1 | 2 | 3 | 4;            // Tier based on last 10 matches
  mindMoodGap: number;            // Difference between Mind and Mood tiers
  isSleepingGiant: boolean;       // Mind Tier 1, Mood Tier 4 (value bet)
  isOverPerformer: boolean;       // Mind Tier 4, Mood Tier 1 (regression risk)
}

interface TeamDNA {
  mostPlayedFormation: string;     // e.g., "4-3-3"
  formationFrequency: Record<string, number>; // Formation usage percentages
  under25Percentage: number;       // Season Under 2.5 rate
  over25Percentage: number;        // Season Over 2.5 rate
  cleanSheetPercentage: number;    // Season clean sheet rate
  failedToScorePercentage: number; // Season failed to score rate
  goalMinuteDistribution: Record<string, number>; // Goals by time windows
  dangerZones: Array<{window: string, percentage: number}>; // High-concession windows
  firstHalfGoalPercentage: number; // % of goals in first half
  earlyGoalPercentage: number;     // % of goals in 0-15 mins
  lateStarter: boolean;            // <20% goals in first 15 mins
}

interface SafetyFlags {
  regressionRisk: boolean;         // Tier 3 team won 5+ in a row
  motivationClash: boolean;        // TITLE_RACE vs MID_TABLE
  liveDog: boolean;                // Bottom team scored in 2 of last 3 away
}

interface TeamData {
  id: number;
  name: string;
  
  // Last matches
  lastMatches: Match[];           // Last 10 all matches
  lastHomeMatches: Match[];       // Last 5 home
  lastAwayMatches: Match[];       // Last 5 away
  
  // Three-layer data strategy
  mind: TeamMind;                 // Baseline quality (50 matches)
  mood: TeamMood;                 // Recent momentum (10 matches)
  dna: TeamDNA;                   // Technical trends (season stats)
  safetyFlags: SafetyFlags;       // Non-mathematical flags
  
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
  h2hMatchCount: number;              // Total H2H matches (after filtering)
  
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
  
  // Recency-weighted stats
  weightedBttsPercentage: number;      // BTTS % weighted by match recency
  weightedAvgGoalsPerMatch: number;   // Goals avg weighted by match recency
  recencyWeights: number[];             // Weight for each match (by index)
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
  // Fetch 50 matches for Mind layer, 10 for Mood layer
  let [allMatches50, allMatches10, homeMatches, awayMatches, standings, teamStats] = await Promise.all([
    fetchTeamMatches(teamId, 50),      // Mind layer (baseline)
    fetchTeamMatches(teamId, 10),      // Mood layer (recent momentum)
    fetchTeamHomeMatches(teamId, 5),
    fetchTeamAwayMatches(teamId, 5),
    fetchTeamStandings(teamId),
    fetchTeamStatistics(teamId, c),    // DNA layer (season stats from backend endpoint)
  ]);
  
  let allMatches = allMatches10; // Use 10 matches for main calculations
  
  // Filter out friendly matches
  allMatches50 = filterNonFriendlyMatches(allMatches50);
  allMatches10 = filterNonFriendlyMatches(allMatches10);
  allMatches = filterNonFriendlyMatches(allMatches);
  homeMatches = filterNonFriendlyMatches(homeMatches);
  awayMatches = filterNonFriendlyMatches(awayMatches);
  
  // Ensure minimum match count (fallback: use all matches if filtered count is too low)
  const MIN_MATCHES = 3;
  if (allMatches.length < MIN_MATCHES) {
    // Fallback: fetch more matches or use all available
    const allMatchesUnfiltered = await fetchTeamMatches(teamId, 15);
    allMatches = filterNonFriendlyMatches(allMatchesUnfiltered);
    // If still too few, use unfiltered (better than no data)
    if (allMatches.length < MIN_MATCHES) {
      allMatches = allMatchesUnfiltered.slice(0, 10);
    }
  }
  
  // Calculate Mind layer (baseline quality from 50 matches)
  const mindEI = calculateEfficiencyIndex(allMatches50);
  const mindTier = categorizeTier(mindEI);
  
  // Calculate Mood layer (recent momentum from 10 matches)
  const moodTier = calculateMoodTier(allMatches10);
  const mood = detectMoodVsMindGap(mindTier, moodTier);
  
  // Calculate DNA layer (season statistics)
  // Note: Early season adjustments will be applied at match prediction level, not here
  
  // Use formation data from teamStats if available, otherwise calculate from matches
  const formationFrequency = teamStats.formations && teamStats.formations.length > 0
    ? teamStats.formations.reduce((acc: Record<string, number>, f: {formation: string; count: number}) => {
        acc[f.formation] = f.count;
        return acc;
      }, {})
    : calculateFormationFrequency(teamStats.matches || allMatches50);
  
  const mostPlayedFormation = getMostPlayedFormation(formationFrequency);
  
  // Use goal minute data from teamStats if available, otherwise calculate from matches
  const goalMinuteData = teamStats.goalMinutes && teamStats.goalMinutes.length > 0
    ? calculateGoalMinuteDistributionFromData(teamStats.goalMinutes)
    : calculateGoalMinuteDistribution(teamStats.matches || allMatches50);
  
  // Use raw DNA percentages (early season adjustments applied at prediction level)
  const dnaUnder25Pct = teamStats.under25Percentage || 0;
  const dnaOver25Pct = teamStats.over25Percentage || 0;
  
  const dna: TeamDNA = {
    mostPlayedFormation,
    formationFrequency,
    under25Percentage: dnaUnder25Pct,
    over25Percentage: dnaOver25Pct,
    cleanSheetPercentage: teamStats.cleanSheetPercentage || 0,
    failedToScorePercentage: teamStats.failedToScorePercentage || 0,
    goalMinuteDistribution: goalMinuteData.distribution,
    dangerZones: goalMinuteData.dangerZones,
    firstHalfGoalPercentage: goalMinuteData.firstHalfPercentage,
    earlyGoalPercentage: goalMinuteData.earlyGoalPercentage,
    lateStarter: goalMinuteData.earlyGoalPercentage < 20,
  };
  
  // Calculate stats
  const stats = calculateTeamStats(allMatches, standings);
  
  const teamData: TeamData = {
    id: teamId,
    name: allMatches[0]?.homeTeam?.id === teamId 
      ? allMatches[0].homeTeam.name 
      : allMatches[0]?.awayTeam?.name || 'Unknown',
    lastMatches: allMatches,
    lastHomeMatches: homeMatches,
    lastAwayMatches: awayMatches,
    mind: {
      efficiencyIndex: mindEI,
      tier: mindTier,
      last50Matches: allMatches50,
    },
    mood,
    dna,
    safetyFlags: {
      regressionRisk: false,
      motivationClash: false,
      liveDog: false,
    }, // Will be calculated later with opponent context
    stats,
    lastMatchDate: allMatches[0]?.date || new Date(),
    nextMatchDate: await getNextMatch(teamId),
    daysSinceLastMatch: allMatches[0]?.date ? calculateDaysSince(allMatches[0].date) : 0,
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
  let matches = await fetchH2HMatches(homeTeamId, awayTeamId, 10);
  
  // Filter out friendly matches
  matches = filterNonFriendlyMatches(matches);
  
  // Calculate recency weights
  const recencyWeights = calculateH2HRecencyWeights(matches);
  
  // Calculate weighted averages
  const bttsValues = matches.map(m => m.bothTeamsScored ? 100 : 0);
  const weightedBttsPercentage = calculateWeightedAverage(bttsValues, recencyWeights);
  
  const goalsValues = matches.map(m => m.totalGoals || 0);
  const weightedAvgGoalsPerMatch = calculateWeightedAverage(goalsValues, recencyWeights);
  
  // Calculate simple averages (for comparison)
  const bttsCount = matches.filter(m => m.bothTeamsScored).length;
  const bttsPercentage = matches.length > 0 
    ? (bttsCount / matches.length) * 100 
    : 0;
  
  const avgGoalsPerMatch = matches.length > 0
    ? matches.reduce((sum, m) => sum + (m.totalGoals || 0), 0) / matches.length
    : 0;
  
  const h2hData: H2HData = {
    matches,
    h2hMatchCount: matches.length,
    homeTeamWins: matches.filter(m => m.winnerId === homeTeamId).length,
    awayTeamWins: matches.filter(m => m.winnerId === awayTeamId).length,
    draws: matches.filter(m => m.result === 'D').length,
    bttsCount,
    bttsPercentage,
    weightedBttsPercentage,
    over25Count: matches.filter(m => (m.totalGoals || 0) > 2.5).length,
    over25Percentage: matches.length > 0
      ? (matches.filter(m => (m.totalGoals || 0) > 2.5).length / matches.length) * 100
      : 0,
    avgGoalsPerMatch,
    weightedAvgGoalsPerMatch,
    avgHomeGoals: matches.length > 0
      ? matches.reduce((sum, m) => sum + (m.homeGoals || 0), 0) / matches.length
      : 0,
    avgAwayGoals: matches.length > 0
      ? matches.reduce((sum, m) => sum + (m.awayGoals || 0), 0) / matches.length
      : 0,
    firstHalfGoalsPercentage: 0, // Calculate if data available
    recencyWeights,
  };
  
  await c.env.KV.put(cacheKey, JSON.stringify(h2hData), {
    expirationTtl: 7 * 24 * 60 * 60,
  });
  
  return h2hData;
}
```

#### 1.2 Stats Calculation

**Important:** All stats calculations now use filtered matches (friendlies excluded) and account for early season adjustments.

**Backend Endpoint Note:** The `fetchTeamStatistics()` function calls a backend endpoint (`/api/teams/:teamId/statistics`) which will be implemented separately. This backend endpoint will fetch team statistics from api-football's team statistics endpoint and return the data in a standardized format.

```typescript
// /api/utils/stats-calculator.ts

// Helper: Fetch team statistics from backend endpoint
// Backend Implementation: GET /api/teams/:teamId/statistics
// This endpoint will fetch from api-football and return:
// - formations: Array<{formation: string; count: number}>
// - goalMinutes: Array<{minute: number; goals: number}>
// - under25Percentage, over25Percentage, cleanSheetPercentage, failedToScorePercentage
// Note: This will call a backend endpoint that fetches from api-football's team statistics endpoint
// The backend endpoint will be implemented separately and will handle the api-football integration
async function fetchTeamStatistics(
  teamId: number,
  c: Context
): Promise<{
  matches: Match[];
  under25Percentage: number;
  over25Percentage: number;
  cleanSheetPercentage: number;
  failedToScorePercentage: number;
  formations?: Array<{formation: string; count: number}>;
  goalMinutes?: Array<{minute: number; goals: number}>;
}> {
  // Fetch from backend team statistics endpoint
  // Backend will handle api-football integration: GET /api/teams/:teamId/statistics
  const cacheKey = `team-stats:${teamId}`;
  
  // Check cache (24 hour TTL for season stats)
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached && !isStale(cached, 24 * 60 * 60)) {
    return cached;
  }
  
  // Call backend endpoint (which will fetch from api-football)
  const response = await fetch(`${c.env.API_BASE_URL}/api/teams/${teamId}/statistics`, {
    headers: {
      'Authorization': `Bearer ${c.env.API_KEY}`,
    },
  });
  
  if (!response.ok) {
    console.warn(`Failed to fetch team statistics for ${teamId}, using defaults`);
    return {
      matches: [],
      under25Percentage: 0,
      over25Percentage: 0,
      cleanSheetPercentage: 0,
      failedToScorePercentage: 0,
    };
  }
  
  const data = await response.json();
  
  const result = {
    matches: data.matches || [],
    under25Percentage: data.under25Percentage || 0,
    over25Percentage: data.over25Percentage || 0,
    cleanSheetPercentage: data.cleanSheetPercentage || 0,
    failedToScorePercentage: data.failedToScorePercentage || 0,
    formations: data.formations || [],
    goalMinutes: data.goalMinutes || [],
  };
  
  // Cache for 24 hours
  await c.env.KV.put(cacheKey, JSON.stringify(result), {
    expirationTtl: 24 * 60 * 60,
  });
  
  return result;
}

// Helper: Calculate formation stability with tiered confidence reduction
// Returns stability score, stability status, and market-specific confidence reduction
function calculateFormationStability(
  matchFormation: string,
  mostPlayedFormation: string,
  formationFrequency: Record<string, number>,
  isEarlySeason: boolean = false
): { 
  isStable: boolean; 
  stabilityScore: number;
  confidenceReduction: number; // Base reduction percentage (will be adjusted per market)
} {
  if (!matchFormation || !mostPlayedFormation) {
    return { isStable: false, stabilityScore: 0, confidenceReduction: 0 };
  }
  
  const usagePercentage = matchFormation === mostPlayedFormation
    ? formationFrequency[mostPlayedFormation] || 0
    : formationFrequency[matchFormation] || 0;
  
  // Early season: More lenient threshold (30% vs 20%)
  const stabilityThreshold = isEarlySeason ? 30 : 20;
  const isStable = usagePercentage >= stabilityThreshold;
  
  // Tiered confidence reduction based on usage percentage
  let baseReduction = 0;
  if (usagePercentage < 20) {
    baseReduction = 25; // Very experimental: 20-25% reduction
  } else if (usagePercentage < 40) {
    baseReduction = 15; // Experimental: 10-15% reduction
  } else if (usagePercentage < 60) {
    baseReduction = 10; // Occasionally used: 5-10% reduction
  } else if (usagePercentage < 80) {
    baseReduction = 5; // Secondary formation: 0-5% reduction
  }
  // usagePercentage >= 80: No reduction (stable)
  
  // Early season: Reduce penalty by 50% (teams experiment more early season)
  if (isEarlySeason) {
    baseReduction = baseReduction * 0.5;
  }
  
  return {
    isStable,
    stabilityScore: usagePercentage,
    confidenceReduction: baseReduction,
  };
}

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

### Algorithm Improvements Summary

**All five improvements are now integrated:**

1. **H2H Recency Weighting:** Recent matches (2025) get exponentially higher weight than older ones (2023). Uses `weightedBttsPercentage` and `weightedAvgGoalsPerMatch` in predictions.

2. **Friendly Match Filtering:** All matches with "Friendly" in league name are excluded. Fallback logic ensures minimum match count requirements.

3. **Rest Days Adjustment:** When `daysSinceLastMatch > 10`, recent form weight is reduced by 30-50% (more reduction for longer rest), with weight redistributed to H2H and historical factors.

4. **Early Season Detection:** When round < 5, recent form weight reduced by 40% (teams not yet in rhythm), H2H and historical data weights increased accordingly.

5. **Low H2H Count Detection:** When H2H matches < 5, H2H factor weight reduced by 40-60% (less reliable with small sample), redistributed to recent form and home advantage. Warning insight added.

**Example: Combined Impact**

```typescript
// Scenario: Early season (Round 3), team rested 12 days, only 3 H2H matches

Base BTTS weights:
- Scoring Rate: 25%
- H2H: 25%
- Defensive Form: 20%
- Recent Form: 35%

After adjustments:
- Scoring Rate: 25% (unchanged)
- H2H: 15% (reduced from 25% due to low count: 25% * 0.4 = 10% reduction)
- Defensive Form: 20% (unchanged)
- Recent Form: 20% (reduced from 35%: 10% early season + 5% rest days = 15% reduction)
- Home Advantage: 20% (gained 5% from H2H reduction)

Result: More conservative predictions, less reliance on limited data
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
  | 'DEFENSIVE_WEAKNESS'
  | 'SLEEPING_GIANT'
  | 'OVER_PERFORMER'
  | 'FORMATION_INSTABILITY'
  | 'REGRESSION_RISK';

function detectPatterns(
  teamData: TeamData,
  context: 'home' | 'away'
): Pattern[] {
  const patterns: Pattern[] = [];
  const matches = context === 'home' 
    ? teamData.lastHomeMatches 
    : teamData.lastAwayMatches;
  
  // Sleeping Giant pattern (Mind Tier 1, Mood Tier 4)
  if (teamData.mood.isSleepingGiant) {
    patterns.push({
      type: 'SLEEPING_GIANT',
      severity: 'HIGH',
      priority: 95,
      data: {
        mindTier: teamData.mind.tier,
        moodTier: teamData.mood.tier,
        gap: teamData.mood.mindMoodGap,
      }
    });
  }
  
  // Over-performer pattern (Mind Tier 4, Mood Tier 1)
  if (teamData.mood.isOverPerformer) {
    patterns.push({
      type: 'OVER_PERFORMER',
      severity: 'HIGH',
      priority: 90,
      data: {
        mindTier: teamData.mind.tier,
        moodTier: teamData.mood.tier,
        gap: teamData.mood.mindMoodGap,
      }
    });
  }
  
  // Formation instability pattern
  // This will be detected in the match context, not here
  
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
  
  {
    pattern: 'SLEEPING_GIANT',
    emoji: '💤',
    priority: 95,
    template: (data, teamName) => {
      return `💎 Value Alert: ${teamName} is Tier ${data.mindTier} quality but Tier ${data.moodTier} form (${data.gap}-tier gap)`;
    }
  },
  
  {
    pattern: 'OVER_PERFORMER',
    emoji: '⚠️',
    priority: 90,
    template: (data, teamName) => {
      return `⚠️ Regression Risk: ${teamName} is Tier ${data.mindTier} quality but Tier ${data.moodTier} form - due for correction`;
    }
  },
  
  {
    pattern: 'FORMATION_INSTABILITY',
    emoji: '🔄',
    priority: 80,
    template: (data, teamName) => {
      return `🔄 Experimental formation: ${data.matchFormation} (usually plays ${data.mostPlayedFormation})`;
    }
  },
  
  {
    pattern: 'REGRESSION_RISK',
    emoji: '📉',
    priority: 85,
    template: (data, teamName) => {
      return `📉 Regression Risk: ${teamName} won ${data.streak} in a row (Tier ${data.tier} team)`;
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
    'SLEEPING_GIANT': 'FORM',
    'OVER_PERFORMER': 'FORM',
    'FORMATION_INSTABILITY': 'FORM',
    'REGRESSION_RISK': 'FORM',
  };
  return map[type] || 'FORM';
}
```

---

### Phase 4: Market Predictions (Week 2-3)

**Goal:** Calculate probabilities for each betting market

```typescript
// /api/analysis/market-predictor.ts

// Helper: Adjust weights based on rest days
// If daysSinceLastMatch > 10, reduce recent form weight
function adjustWeightsForRestDays(
  baseWeights: Record<string, number>,
  daysSinceLastMatch: number
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  if (daysSinceLastMatch > 10) {
    // Reduce recent form weight by 30-50% (more reduction for longer rest)
    const reductionFactor = Math.min(0.5, 0.3 + (daysSinceLastMatch - 10) * 0.02);
    adjusted.recentForm = adjusted.recentForm * (1 - reductionFactor);
    
    // Redistribute reduced weight to other factors (H2H, historical data)
    const weightToRedistribute = adjusted.recentForm * reductionFactor;
    adjusted.h2h = (adjusted.h2h || 0) + weightToRedistribute * 0.6;
    adjusted.leaguePosition = (adjusted.leaguePosition || 0) + weightToRedistribute * 0.4;
  }
  
  return adjusted;
}

// Helper: Adjust weights for early season (< 5 rounds)
// Reduce recent form weight, increase H2H and historical data weight
function adjustWeightsForEarlySeason(
  baseWeights: Record<string, number>,
  isEarly: boolean
): Record<string, number> {
  if (!isEarly) return baseWeights;
  
  const adjusted = { ...baseWeights };
  
  // Reduce recent form by 40% (teams not yet in rhythm)
  const formReduction = adjusted.recentForm * 0.4;
  adjusted.recentForm = adjusted.recentForm * 0.6;
  
  // Increase H2H weight (more reliable than early season form)
  adjusted.h2h = (adjusted.h2h || 0) + formReduction * 0.6;
  
  // Increase historical/league position weight
  adjusted.leaguePosition = (adjusted.leaguePosition || 0) + formReduction * 0.4;
  
  return adjusted;
}

// Helper: Adjust weights for low H2H count
// If H2H matches < 5, reduce H2H weight by 40-60%
function adjustWeightsForLowH2H(
  baseWeights: Record<string, number>,
  h2hMatchCount: number
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  if (h2hMatchCount < 5) {
    // Reduce H2H weight: 40% reduction for 4 matches, 60% for 1 match
    const reductionFactor = 0.4 + (5 - h2hMatchCount) * 0.05; // 0.4 to 0.6
    const h2hReduction = (adjusted.h2h || 0) * reductionFactor;
    adjusted.h2h = (adjusted.h2h || 0) * (1 - reductionFactor);
    
    // Redistribute reduced weight to recent form and other factors
    adjusted.recentForm = (adjusted.recentForm || 0) + h2hReduction * 0.7;
    adjusted.homeAdvantage = (adjusted.homeAdvantage || 0) + h2hReduction * 0.3;
  }
  
  return adjusted;
}

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
  h2hData: H2HData,
  matchContext?: { 
    round?: string; 
    leagueName?: string;
    homeFormation?: string;
    awayFormation?: string;
  }
): Promise<MarketPrediction[]> {
  const predictions: MarketPrediction[] = [];
  
  // Detect early season
  const isEarlySeason = matchContext?.round 
    ? isEarlySeason(matchContext.round)
    : false;
  
  // Calculate formation stability for both teams (with early season context)
  const homeFormationStability = matchContext?.homeFormation
    ? calculateFormationStability(
        matchContext.homeFormation,
        homeTeamData.dna.mostPlayedFormation,
        homeTeamData.dna.formationFrequency,
        isEarlySeason
      )
    : { isStable: true, stabilityScore: 100, confidenceReduction: 0 };
  
  const awayFormationStability = matchContext?.awayFormation
    ? calculateFormationStability(
        matchContext.awayFormation,
        awayTeamData.dna.mostPlayedFormation,
        awayTeamData.dna.formationFrequency,
        isEarlySeason
      )
    : { isStable: true, stabilityScore: 100, confidenceReduction: 0 };
  
  // Calculate combined formation impact (capped at 30% total reduction)
  const totalFormationReduction = Math.min(30, 
    homeFormationStability.confidenceReduction + awayFormationStability.confidenceReduction
  );
  
  // Calculate safety flags (no manager context needed)
  homeTeamData.safetyFlags = detectSafetyFlags(homeTeamData, awayTeamData);
  awayTeamData.safetyFlags = detectSafetyFlags(awayTeamData, homeTeamData);
  
  // 1. BTTS (40% less impact from formations)
  predictions.push(await predictBTTS(
    homeTeamData, 
    awayTeamData, 
    h2hData,
    isEarlySeason,
    { 
      homeFormationStability, 
      awayFormationStability,
      totalFormationReduction: totalFormationReduction * 0.6 // 40% less impact
    }
  ));
  
  // 2. Over/Under 2.5 (40% less impact from formations)
  predictions.push(await predictOver25(
    homeTeamData, 
    awayTeamData, 
    h2hData,
    isEarlySeason,
    { 
      homeFormationStability, 
      awayFormationStability,
      totalFormationReduction: totalFormationReduction * 0.6 // 40% less impact
    }
  ));
  
  // 3. Match Result (Full impact from formations)
  predictions.push(await predictMatchResult(
    homeTeamData, 
    awayTeamData, 
    h2hData,
    isEarlySeason,
    { 
      homeFormationStability, 
      awayFormationStability,
      totalFormationReduction // Full impact
    }
  ));
  
  // 4. First Half (20% less impact from formations)
  predictions.push(await predictFirstHalf(
    homeTeamData, 
    awayTeamData, 
    h2hData,
    isEarlySeason,
    { 
      homeFormationStability, 
      awayFormationStability,
      totalFormationReduction: totalFormationReduction * 0.8 // 20% less impact
    }
  ));
  
  return predictions;
}

async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Market-adjusted reduction
  }
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  const conflicts: ConflictingSignal[] = [];
  
  // Base weights for BTTS market
  let weights = {
    scoringRate: 0.25,
    h2h: 0.25,
    defensiveForm: 0.20,
    recentForm: 0.35,
  };
  
  // Adjust weights based on context
  weights = adjustWeightsForRestDays(weights, homeTeam.daysSinceLastMatch);
  weights = adjustWeightsForRestDays(weights, awayTeam.daysSinceLastMatch);
  weights = adjustWeightsForEarlySeason(weights, isEarlySeason);
  weights = adjustWeightsForLowH2H(weights, h2h.h2hMatchCount);
  
  // Factor 1: Home team scoring rate
  const homeScored = homeTeam.lastHomeMatches.filter(m => m.goalsScored > 0).length;
  const homeScoredPct = homeTeam.lastHomeMatches.length > 0
    ? (homeScored / homeTeam.lastHomeMatches.length) * 100
    : 0;
  const homeScoreScore = homeScoredPct; // 0-100
  
  insights.push({
    text: `${homeTeam.name} scored in ${homeScored} of last ${homeTeam.lastHomeMatches.length} home games (${homeScoredPct.toFixed(0)}%)`,
    emoji: '⚽',
    priority: 90,
    category: 'SCORING',
    severity: homeScoredPct >= 80 ? 'HIGH' : 'MEDIUM',
  });
  
  // Factor 2: Away team scoring rate
  const awayScored = awayTeam.lastAwayMatches.filter(m => m.goalsScored > 0).length;
  const awayScoredPct = awayTeam.lastAwayMatches.length > 0
    ? (awayScored / awayTeam.lastAwayMatches.length) * 100
    : 0;
  const awayScoreScore = awayScoredPct;
  
  insights.push({
    text: `${awayTeam.name} scored in ${awayScored} of last ${awayTeam.lastAwayMatches.length} away games (${awayScoredPct.toFixed(0)}%)`,
    emoji: '⚽',
    priority: 90,
    category: 'SCORING',
    severity: awayScoredPct >= 80 ? 'HIGH' : 'MEDIUM',
  });
  
  // Factor 3: H2H BTTS (use weighted percentage if available, fallback to simple)
  const h2hBTTSScore = h2h.weightedBttsPercentage > 0 
    ? h2h.weightedBttsPercentage 
    : h2h.bttsPercentage;
  
  // Add warning if low H2H count
  if (h2h.h2hMatchCount < 5) {
    insights.push({
      text: `⚠️ Limited H2H data: Only ${h2h.h2hMatchCount} previous meetings`,
      emoji: '⚠️',
      priority: 60,
      category: 'H2H',
      severity: 'MEDIUM',
    });
  }
  
  if (h2h.bttsPercentage >= 60 || h2h.weightedBttsPercentage >= 60) {
    const displayPct = h2h.weightedBttsPercentage > 0 
      ? h2h.weightedBttsPercentage 
      : h2h.bttsPercentage;
    insights.push({
      text: `BTTS in ${h2h.bttsCount} of last ${h2h.matches.length} H2H meetings (${displayPct.toFixed(0)}%)`,
      emoji: '📊',
      priority: 95,
      category: 'H2H',
      severity: displayPct >= 80 ? 'HIGH' : 'MEDIUM',
    });
  }
  
  // Factor 4: Home defensive weakness
  const homeDefenseScore = homeTeam.lastHomeMatches.length > 0
    ? 100 - (homeTeam.stats.cleanSheets / homeTeam.lastHomeMatches.length * 100)
    : 50;
  
  if (homeTeam.stats.cleanSheetDrought >= 8) {
    insights.push({
      text: `${homeTeam.name}: 0 clean sheets in last ${homeTeam.stats.cleanSheetDrought} games`,
      emoji: '🔓',
      priority: 85,
      category: 'DEFENSIVE',
      severity: homeTeam.stats.cleanSheetDrought >= 12 ? 'CRITICAL' : 'HIGH',
    });
  }
  
  // Factor 5: Away defensive weakness
  const awayDefenseScore = awayTeam.lastAwayMatches.length > 0
    ? 100 - (awayTeam.stats.cleanSheets / awayTeam.lastAwayMatches.length * 100)
    : 50;
  
  // Apply DNA layer: Use season Under/Over distributions
  // If season DNA shows strong Under tendency, adjust BTTS probability
  const homeDnaAdjustment = homeTeam.dna.under25Percentage > 70 ? -5 : 0;
  const awayDnaAdjustment = awayTeam.dna.under25Percentage > 70 ? -5 : 0;
  
  // Apply Formation Stability: Use market-adjusted reduction (already reduced by 40% for BTTS)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0);
  
  // Apply Safety Flags
  let safetyAdjustment = 0;
  if (homeTeam.safetyFlags.liveDog || awayTeam.safetyFlags.liveDog) {
    // Live Dog flag: Switch to BTTS recommendation
    safetyAdjustment += 10;
  }
  
  // Calculate weighted score using adjusted weights
  const scoringWeight = weights.scoringRate / 2; // Split between home and away
  const defensiveWeight = weights.defensiveForm / 2; // Split between home and away
  
  let bttsScore = (
    homeScoreScore * scoringWeight +
    awayScoreScore * scoringWeight +
    h2hBTTSScore * weights.h2h +
    homeDefenseScore * defensiveWeight +
    awayDefenseScore * defensiveWeight
  );
  
  // Apply adjustments
  bttsScore += homeDnaAdjustment + awayDnaAdjustment + formationAdjustment + safetyAdjustment;
  bttsScore = Math.max(0, Math.min(100, bttsScore)); // Clamp to 0-100
  
  // Convert to probability
  const yesProbability = bttsScore;
  const noProbability = 100 - yesProbability;
  
  // Determine rating
  const rating = getRating(yesProbability);
  
  // Adjust confidence based on formation stability (market-adjusted)
  let finalConfidence = confidence;
  const formationReduction = formationStability?.totalFormationReduction || 0;
  
  if (formationReduction > 0) {
    // Apply tiered confidence reduction based on market-adjusted formation impact
    if (finalConfidence === 'HIGH' && formationReduction > 12) {
      finalConfidence = 'MEDIUM';
    } else if (finalConfidence === 'MEDIUM' && formationReduction > 18) {
      finalConfidence = 'LOW';
    }
    
    // Add formation instability insights with early season context
    if (!formationStability?.homeFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      const formationName = 'Unknown'; // Will be provided from match context in actual implementation
      insights.push({
        text: `🔄 ${homeTeam.name}: Experimental formation (${formationStability.homeFormationStability.stabilityScore.toFixed(0)}% usage, usually plays ${homeTeam.dna.mostPlayedFormation})${earlySeasonNote}`,
        emoji: '🔄',
        priority: 80,
        category: 'FORM',
        severity: formationStability.homeFormationStability.stabilityScore < 20 ? 'HIGH' : 'MEDIUM',
      });
    }
    
    if (!formationStability?.awayFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      const formationName = 'Unknown'; // Will be provided from match context in actual implementation
      insights.push({
        text: `🔄 ${awayTeam.name}: Experimental formation (${formationStability.awayFormationStability.stabilityScore.toFixed(0)}% usage, usually plays ${awayTeam.dna.mostPlayedFormation})${earlySeasonNote}`,
        emoji: '🔄',
        priority: 80,
        category: 'FORM',
        severity: formationStability.awayFormationStability.stabilityScore < 20 ? 'HIGH' : 'MEDIUM',
      });
    }
  }
  
  // Add DNA insights
  if (homeTeam.dna.under25Percentage > 70) {
    insights.push({
      text: `${homeTeam.name} season DNA: ${homeTeam.dna.under25Percentage.toFixed(0)}% Under 2.5 (vs ${(100 - homeScoredPct).toFixed(0)}% in L5) - Trust the DNA`,
      emoji: '🧬',
      priority: 75,
      category: 'SCORING',
      severity: 'MEDIUM',
    });
  }
  
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
    confidence: finalConfidence,
    insights: topInsights,
    conflictingSignals: conflicts.length > 0 ? conflicts : undefined,
    recommendation,
  };
}

// Predict Over/Under 2.5 Goals with Goal Efficiency (DNA layer)
async function predictOver25(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Market-adjusted reduction (40% less impact)
  }
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  
  // Base weights
  let weights = {
    avgGoalsPerGame: 0.30,
    recentForm: 0.30,
    h2h: 0.20,
    defensiveWeakness: 0.25,
  };
  
  // Apply adjustments
  weights = adjustWeightsForRestDays(weights, homeTeam.daysSinceLastMatch);
  weights = adjustWeightsForRestDays(weights, awayTeam.daysSinceLastMatch);
  weights = adjustWeightsForEarlySeason(weights, isEarlySeason);
  weights = adjustWeightsForLowH2H(weights, h2h.h2hMatchCount);
  
  // Calculate average goals
  const homeAvgGoals = homeTeam.stats.avgGoalsScored;
  const awayAvgGoals = awayTeam.stats.avgGoalsScored;
  const combinedAvgGoals = homeAvgGoals + awayAvgGoals;
  
  // Apply Goal Efficiency (DNA layer) - Frustration Filter
  // Trust long-term DNA over recent outliers
  const homeDnaUnderRate = homeTeam.dna.under25Percentage;
  const awayDnaUnderRate = awayTeam.dna.under25Percentage;
  
  let dnaAdjustment = 0;
  if (homeDnaUnderRate > 70 || awayDnaUnderRate > 70) {
    // Strong Under DNA: reduce Over probability even if recent form suggests Over
    const avgDnaUnderRate = (homeDnaUnderRate + awayDnaUnderRate) / 2;
    dnaAdjustment = -(avgDnaUnderRate - 50) * 0.3; // -6% to -9% adjustment
    
    insights.push({
      text: `🧬 Season DNA: ${homeTeam.name} ${homeDnaUnderRate.toFixed(0)}% Under 2.5, ${awayTeam.name} ${awayDnaUnderRate.toFixed(0)}% Under 2.5 - Trust the DNA over recent form`,
      emoji: '🧬',
      priority: 85,
      category: 'SCORING',
      severity: 'HIGH',
    });
  }
  
  // Calculate score
  let overScore = combinedAvgGoals * 20; // Scale to 0-100
  overScore += dnaAdjustment;
  
  // Apply formation stability adjustment (market-adjusted: 40% less impact for O/U)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0);
  overScore += formationAdjustment;
  
  // Apply safety flags
  if (homeTeam.safetyFlags.regressionRisk || awayTeam.safetyFlags.regressionRisk) {
    overScore -= 3; // Regression risk teams may score less
  }
  
  overScore = Math.max(0, Math.min(100, overScore));
  
  const yesProbability = overScore;
  const noProbability = 100 - yesProbability;
  const rating = getRating(yesProbability);
  
  // Calculate confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (Math.abs(yesProbability - 50) > 25) confidence = 'HIGH';
  if (Math.abs(yesProbability - 50) < 10) confidence = 'LOW';
  
  // Adjust confidence for formation instability (market-adjusted impact)
  const formationReduction = formationStability?.totalFormationReduction || 0;
  if (formationReduction > 0) {
    if (confidence === 'HIGH' && formationReduction > 12) {
      confidence = 'MEDIUM';
    } else if (confidence === 'MEDIUM' && formationReduction > 18) {
      confidence = 'LOW';
    }
  }
  
  return {
    market: 'OVER_25',
    probabilities: { yes: yesProbability, no: noProbability },
    rating,
    confidence,
    insights: insights.slice(0, 5),
    recommendation: rating === 'LIKELY' || rating === 'VERY_LIKELY' 
      ? 'Over 2.5 - Yes ✅' 
      : rating === 'UNLIKELY' || rating === 'VERY_UNLIKELY'
      ? 'Under 2.5 - Yes ✅'
      : 'Over 2.5 - Neutral 🤔',
  };
}

// Predict Match Result (1X2) with Mind/Mood/DNA layers
async function predictMatchResult(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Full impact for match result
  }
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  
  // Base weights
  let weights = {
    recentForm: 0.30,
    h2h: 0.25,
    homeAdvantage: 0.20,
    motivation: 0.18,
    rest: 0.12,
    leaguePosition: 0.10,
  };
  
  // Apply adjustments
  weights = adjustWeightsForRestDays(weights, homeTeam.daysSinceLastMatch);
  weights = adjustWeightsForRestDays(weights, awayTeam.daysSinceLastMatch);
  weights = adjustWeightsForEarlySeason(weights, isEarlySeason);
  weights = adjustWeightsForLowH2H(weights, h2h.h2hMatchCount);
  
  
  // Calculate probabilities (simplified - full implementation would use all factors)
  let homeProb = 40; // Base home advantage
  let drawProb = 25;
  let awayProb = 35;
  
  // Apply Mind/Mood gap
  if (homeTeam.mood.isSleepingGiant) {
    homeProb += 10; // Value bet: Tier 1 quality, Tier 4 form
    insights.push({
      text: `💎 Value Alert: ${homeTeam.name} is Tier ${homeTeam.mind.tier} quality but Tier ${homeTeam.mood.tier} form`,
      emoji: '💤',
      priority: 95,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  if (awayTeam.mood.isSleepingGiant) {
    awayProb += 10;
    insights.push({
      text: `💎 Value Alert: ${awayTeam.name} is Tier ${awayTeam.mind.tier} quality but Tier ${awayTeam.mood.tier} form`,
      emoji: '💤',
      priority: 95,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  if (homeTeam.mood.isOverPerformer) {
    homeProb -= 8; // Regression risk
    insights.push({
      text: `⚠️ Regression Risk: ${homeTeam.name} is Tier ${homeTeam.mind.tier} quality but Tier ${homeTeam.mood.tier} form`,
      emoji: '📉',
      priority: 90,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  if (awayTeam.mood.isOverPerformer) {
    awayProb -= 8;
    insights.push({
      text: `⚠️ Regression Risk: ${awayTeam.name} is Tier ${awayTeam.mind.tier} quality but Tier ${awayTeam.mood.tier} form`,
      emoji: '📉',
      priority: 90,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  // Apply Motivation Clash: +5% to motivated team
  if (homeTeam.safetyFlags.motivationClash) {
    const homeMotivation = calculateMotivation(homeTeam);
    const awayMotivation = calculateMotivation(awayTeam);
    if (homeMotivation === 'TITLE_RACE' && awayMotivation === 'MID_TABLE') {
      homeProb += 5;
    }
  }
  
  // Apply Regression Risk: -15% confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (homeTeam.safetyFlags.regressionRisk || awayTeam.safetyFlags.regressionRisk) {
    confidence = 'LOW';
  }
  
  // Apply formation stability: reduce confidence (full impact for match result)
  const formationReduction = formationStability?.totalFormationReduction || 0;
  if (formationReduction > 0) {
    if (confidence === 'HIGH' && formationReduction > 15) {
      confidence = 'MEDIUM';
    } else if (confidence === 'MEDIUM' && formationReduction > 20) {
      confidence = 'LOW';
    }
    
    // Add formation insights
    if (!formationStability?.homeFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      insights.push({
        text: `🔄 ${homeTeam.name}: Experimental formation (${formationStability.homeFormationStability.stabilityScore.toFixed(0)}% usage)${earlySeasonNote}`,
        emoji: '🔄',
        priority: 85,
        category: 'FORM',
        severity: formationStability.homeFormationStability.stabilityScore < 20 ? 'HIGH' : 'MEDIUM',
      });
    }
    
    if (!formationStability?.awayFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      insights.push({
        text: `🔄 ${awayTeam.name}: Experimental formation (${formationStability.awayFormationStability.stabilityScore.toFixed(0)}% usage)${earlySeasonNote}`,
        emoji: '🔄',
        priority: 85,
        category: 'FORM',
        severity: formationStability.awayFormationStability.stabilityScore < 20 ? 'HIGH' : 'MEDIUM',
      });
    }
  }
  
  // Normalize probabilities
  const total = homeProb + drawProb + awayProb;
  homeProb = (homeProb / total) * 100;
  drawProb = (drawProb / total) * 100;
  awayProb = (awayProb / total) * 100;
  
  const maxProb = Math.max(homeProb, drawProb, awayProb);
  const rating = maxProb >= 50 ? 'LIKELY' : maxProb >= 40 ? 'NEUTRAL' : 'UNLIKELY';
  
  return {
    market: 'MATCH_RESULT',
    probabilities: { home: homeProb, draw: drawProb, away: awayProb },
    rating,
    confidence,
    insights: insights.slice(0, 5),
    recommendation: maxProb === homeProb 
      ? `${homeTeam.name} Win ✅`
      : maxProb === awayProb
      ? `${awayTeam.name} Win ✅`
      : 'Draw ✅',
  };
}

// Predict First Half Result using Goal Minute Distribution
async function predictFirstHalf(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Market-adjusted reduction (20% less impact)
  }
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  
  // Use Goal Minute Distribution from DNA layer
  const homeFirstHalfPct = homeTeam.dna.firstHalfGoalPercentage;
  const awayFirstHalfPct = awayTeam.dna.firstHalfGoalPercentage;
  const homeEarlyGoalPct = homeTeam.dna.earlyGoalPercentage;
  const awayEarlyGoalPct = awayTeam.dna.earlyGoalPercentage;
  
  // Detect late starters
  if (homeTeam.dna.lateStarter) {
    insights.push({
      text: `🐌 ${homeTeam.name}: Late starter - ${homeEarlyGoalPct.toFixed(0)}% goals in first 15 mins`,
      emoji: '🐌',
      priority: 80,
      category: 'TIMING',
      severity: 'MEDIUM',
    });
  }
  if (awayTeam.dna.lateStarter) {
    insights.push({
      text: `🐌 ${awayTeam.name}: Late starter - ${awayEarlyGoalPct.toFixed(0)}% goals in first 15 mins`,
      emoji: '🐌',
      priority: 80,
      category: 'TIMING',
      severity: 'MEDIUM',
    });
  }
  
  // Add Danger Zone insights
  if (homeTeam.dna.dangerZones.length > 0) {
    const topDangerZone = homeTeam.dna.dangerZones[0];
    insights.push({
      text: `⚠️ Danger Zone: ${homeTeam.name} concedes ${topDangerZone.percentage.toFixed(0)}% of goals in ${topDangerZone.window} min window`,
      emoji: '⚠️',
      priority: 75,
      category: 'DEFENSIVE',
      severity: 'MEDIUM',
    });
  }
  if (awayTeam.dna.dangerZones.length > 0) {
    const topDangerZone = awayTeam.dna.dangerZones[0];
    insights.push({
      text: `⚠️ Danger Zone: ${awayTeam.name} concedes ${topDangerZone.percentage.toFixed(0)}% of goals in ${topDangerZone.window} min window`,
      emoji: '⚠️',
      priority: 75,
      category: 'DEFENSIVE',
      severity: 'MEDIUM',
    });
  }
  
  // Calculate first half probability
  // If both teams are late starters, higher chance of draw at half time
  const avgFirstHalfPct = (homeFirstHalfPct + awayFirstHalfPct) / 2;
  let firstHalfScore = avgFirstHalfPct;
  
  // Late starters: reduce first half goals probability
  if (homeTeam.dna.lateStarter && awayTeam.dna.lateStarter) {
    firstHalfScore -= 15;
    insights.push({
      text: `⏰ Both teams are late starters - "Draw at Half Time" is a high-confidence play`,
      emoji: '⏰',
      priority: 85,
      category: 'TIMING',
      severity: 'HIGH',
    });
  }
  
  // Apply formation stability adjustment (market-adjusted: 20% less impact for First Half)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0);
  firstHalfScore += formationAdjustment;
  
  firstHalfScore = Math.max(0, Math.min(100, firstHalfScore));
  const yesProbability = firstHalfScore;
  const noProbability = 100 - yesProbability;
  const rating = getRating(yesProbability);
  
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (Math.abs(yesProbability - 50) > 20) confidence = 'HIGH';
  if (Math.abs(yesProbability - 50) < 10) confidence = 'LOW';
  
  // Adjust confidence for formation instability (market-adjusted impact)
  const formationReduction = formationStability?.totalFormationReduction || 0;
  if (formationReduction > 0) {
    if (confidence === 'HIGH' && formationReduction > 14) {
      confidence = 'MEDIUM';
    } else if (confidence === 'MEDIUM' && formationReduction > 20) {
      confidence = 'LOW';
    }
  }
  
  return {
    market: 'FIRST_HALF',
    probabilities: { yes: yesProbability, no: noProbability },
    rating,
    confidence,
    insights: insights.slice(0, 5),
    recommendation: homeTeam.dna.lateStarter && awayTeam.dna.lateStarter
      ? 'Draw at Half Time ✅'
      : rating === 'LIKELY' || rating === 'VERY_LIKELY'
      ? 'Goals in First Half ✅'
      : 'No Goals in First Half ✅',
  };
}

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
      h2h,
      {
        round: match.league?.round,
        leagueName: match.league?.name,
        homeFormation: match.homeFormation, // From lineup data
        awayFormation: match.awayFormation, // From lineup data
      }
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
          mind: {
            efficiencyIndex: homeTeam.mind.efficiencyIndex,
            tier: homeTeam.mind.tier,
          },
          mood: {
            tier: homeTeam.mood.tier,
            isSleepingGiant: homeTeam.mood.isSleepingGiant,
            isOverPerformer: homeTeam.mood.isOverPerformer,
          },
          dna: {
            mostPlayedFormation: homeTeam.dna.mostPlayedFormation,
            under25Percentage: homeTeam.dna.under25Percentage,
            lateStarter: homeTeam.dna.lateStarter,
          },
        },
        awayTeam: {
          form: awayTeam.stats.form,
          position: awayTeam.stats.leaguePosition,
          daysSinceLastMatch: awayTeam.daysSinceLastMatch,
          motivation: calculateMotivation(awayTeam),
          mind: {
            efficiencyIndex: awayTeam.mind.efficiencyIndex,
            tier: awayTeam.mind.tier,
          },
          mood: {
            tier: awayTeam.mood.tier,
            isSleepingGiant: awayTeam.mood.isSleepingGiant,
            isOverPerformer: awayTeam.mood.isOverPerformer,
          },
          dna: {
            mostPlayedFormation: awayTeam.dna.mostPlayedFormation,
            under25Percentage: awayTeam.dna.under25Percentage,
            lateStarter: awayTeam.dna.lateStarter,
          },
        },
        match: {
          round: match.league?.round,
          earlySeason: match.league?.round ? isEarlySeason(match.league.round) : false,
          homeFormation: match.homeFormation,
          awayFormation: match.awayFormation,
          formationStability: {
            home: {
              isStable: homeFormationStability.isStable,
              stabilityScore: homeFormationStability.stabilityScore,
              confidenceReduction: homeFormationStability.confidenceReduction,
            },
            away: {
              isStable: awayFormationStability.isStable,
              stabilityScore: awayFormationStability.stabilityScore,
              confidenceReduction: awayFormationStability.confidenceReduction,
            },
          },
        },
        h2h: {
          matchCount: h2h.h2hMatchCount,
          isLimited: h2h.h2hMatchCount < 5,
        },
        safetyFlags: {
          home: homeTeam.safetyFlags,
          away: awayTeam.safetyFlags,
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
    },
    "match": {
      "round": "Regular Season - 20",
      "earlySeason": false
    },
    "h2h": {
      "matchCount": 5,
      "isLimited": false
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