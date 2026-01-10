# Phase 3: Insight Generation (Week 2)

**Reference:** See "Phase 3: Insight Generation" section in `betting-insights-algorithm.md`

## Overview

Phase 3 converts detected patterns into human-readable insights using template-based generation. Insights are prioritized, categorized, and formatted for display to users.

## Dependencies

- **Phase 1:** Core Data Layer (TeamData, H2HData structures)
- **Phase 2:** Pattern Detection (Pattern types and detection functions)

## Sub-Phases

### 3.1 Insight Template System

**Reference:** See "3.1 Insight Template System" in `betting-insights-algorithm.md`

**Goal:** Create template system for converting patterns to human-readable text

#### Sub-tasks:

1. **Insight Template Definition**
   - Define template structure with pattern type, emoji, priority, and template function
   - Create templates for all pattern types

2. **Template Functions**
   - Implement template functions for each pattern type
   - Handle different severity levels with appropriate messaging
   - Include team names and contextual data

3. **Emoji Assignment**
   - Assign appropriate emojis to each pattern type
   - Ensure emojis convey pattern meaning clearly

#### Template Examples:

- `LONG_LOSING_STREAK`: "🔴 {teamName} lost {streak} consecutive {venue} matches"
- `LONG_WINNING_STREAK`: "🔥 {teamName} won {streak} consecutive {venue} matches"
- `SCORING_STREAK`: "⚽ {teamName} scored in {streak} consecutive matches"
- `CLEAN_SHEET_DROUGHT`: "🔓 {teamName} haven't kept a clean sheet in {drought} games"
- `FIRST_HALF_WEAKNESS`: "🐌 {teamName} scored 1st half in only {gamesWithGoals} of L{total} ({percentage}%)"
- `HIGH_SCORING_FORM`: "🔥 {teamName} averaging {avgGoals} goals per game (L5)"
- `DEFENSIVE_WEAKNESS`: "⚠️ {teamName} conceding {avgConceded} goals per game (L5)"
- `BTTS_STREAK`: "📊 BTTS in {count} of last {total} H2H meetings ({percentage}%)"
- `H2H_DOMINANCE`: "🏆 {teamName} won {wins} of last {total} H2H meetings ({percentage}%)"
- `SLEEPING_GIANT`: "💎 Value Alert: {teamName} is Tier {mindTier} quality but Tier {moodTier} form ({gap}-tier gap)"
- `OVER_PERFORMER`: "⚠️ Regression Risk: {teamName} is Tier {mindTier} quality but Tier {moodTier} form - due for correction"
- `FORMATION_INSTABILITY`: "🔄 Experimental formation: {matchFormation} (usually plays {mostPlayedFormation})"
- `REGRESSION_RISK`: "📉 Regression Risk: {teamName} won {streak} in a row (Tier {tier} team)"

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/insight-generator.ts` - Main insight generation logic
- `apps/backend/src/modules/betting-insights/templates/insight-templates.ts` - Template definitions
- `apps/backend/src/modules/betting-insights/types.ts` - Add Insight interface

#### Validation Criteria:

- ✅ All pattern types have corresponding templates
- ✅ Template functions generate correct text for all severity levels
- ✅ Emojis are appropriate and consistent
- ✅ Team names are correctly inserted
- ✅ Numeric values are formatted correctly (percentages, averages)
- ✅ Context-specific messaging (venue, streak length) works correctly

---

### 3.2 Insight Generation & Categorization

**Reference:** See "3.2 Insight Generation & Categorization" in `betting-insights-algorithm.md`

**Goal:** Generate insights from patterns and categorize them

#### Sub-tasks:

1. **Insight Generation Function**
   - Convert patterns to insights using templates
   - Match patterns to templates
   - Generate insight text, emoji, priority, category, severity

2. **Pattern Categorization**
   - Categorize patterns into: FORM, H2H, TIMING, DEFENSIVE, SCORING
   - Map pattern types to categories

3. **Priority Sorting**
   - Sort insights by priority (highest first)
   - Ensure most important insights appear first

#### Categories:

- `FORM` - Form-related patterns (streaks, sleeping giant, over-performer)
- `H2H` - Head-to-head patterns (BTTS streak, H2H dominance)
- `TIMING` - Timing-related patterns (first half weakness)
- `DEFENSIVE` - Defensive patterns (clean sheet drought, defensive weakness)
- `SCORING` - Scoring patterns (scoring streak, high scoring form)

#### Files to Create:

- Extend `apps/backend/src/modules/betting-insights/analysis/insight-generator.ts` - Add generation and categorization functions
- `apps/backend/src/modules/betting-insights/utils/categorization.ts` - Pattern categorization logic

#### Validation Criteria:

- ✅ All patterns generate insights correctly
- ✅ Insights are categorized correctly
- ✅ Insights are sorted by priority (highest first)
- ✅ Missing templates are handled gracefully
- ✅ Insight text is human-readable and grammatically correct

---

## Key Data Structures

### Insight Interface

```typescript
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
```

## Implementation Checklist

### Insight Template System
- [ ] Create `INSIGHT_TEMPLATES` constant with all templates
- [ ] Implement template functions for each pattern type
- [ ] Assign appropriate emojis
- [ ] Handle different severity levels in templates
- [ ] Test template functions with various data inputs

### Insight Generation
- [ ] Implement `generateInsights()` function
- [ ] Implement `categorizePattern()` function
- [ ] Implement priority sorting
- [ ] Handle missing templates gracefully
- [ ] Format numeric values correctly (percentages, decimals)

### Testing
- [ ] Unit tests for template functions
- [ ] Unit tests for insight generation
- [ ] Test with all pattern types
- [ ] Test edge cases (empty patterns, missing data)
- [ ] Verify categorization is correct
- [ ] Verify sorting by priority works
- [ ] Test text formatting (percentages, decimals, team names)

## Notes

- Templates use function-based approach for flexibility
- Team names are passed to template functions for insertion
- Numeric values should be formatted appropriately (percentages with 0 decimals, averages with 1 decimal)
- Priority scores from Phase 2 determine insight order
- Categories help organize insights for display
- Severity levels match pattern severity from Phase 2
- H2H insights don't require team name (already in context)

