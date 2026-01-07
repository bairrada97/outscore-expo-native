# Outscore - Football Fixtures App

## Product Overview

Outscore is a high-performance, cross-platform football fixtures application that provides real-time match information, scores, and schedules. The app delivers sub-50ms response times through an aggressive multi-layer caching strategy while maintaining real-time updates for live matches.

### Vision
To be the fastest and most reliable football fixtures app, providing users with instant access to match information regardless of their location or timezone.

---

## Core Features

### 1. Match Fixtures Display - Homepage
**Description**: Display football matches organized by date and competition.

**Requirements**:
- Show matches for a 5-day window (2 days before today, today, 2 days after today)
- Group matches by country and league
- Display match information including:
  - Home and away teams with flags
  - Match status (Not Started, Live, Finished, Postponed, etc.)
  - Scores (full-time, penalty shootout, extra time)
  - Match time/date in user's local timezone
  - Live match elapsed time (e.g., "45'")
- Support multiple match statuses:
  - Not Started (NS)
  - Live (1H, 2H, HT, ET, INT, BT, P)
  - Finished (FT, AET, PEN)
  - Postponed/Cancelled (PST, CANC, ABD, WO, INT, TBD)

**User Stories**:
- As a user, I want to see all matches for today in my local timezone
- As a user, I want to navigate between different dates easily
- As a user, I want to see match statuses clearly (live, finished, upcoming)

---

### 2. Date Navigation
**Description**: Intuitive date-based navigation with calendar tabs.

**Requirements**:
- Display 5 date tabs: 2 days before, today, 2 days after
- Show "Today" label on current day tab
- Display day number and abbreviated weekday (e.g., "15 MON")
- Animated tab indicator showing active date
- Calendar button for date selection (future enhancement)
- Support for swipe gestures on native platforms
- Smooth tab transitions with animations
- Auto-scroll to today's tab on app load or if any date params are shared in the url scroll to that day
- Support deep linking to specific dates via URL params

**User Stories**:
- As a user, I want to quickly switch between dates to see past and upcoming matches
- As a user, I want to know which date I'm currently viewing
- As a user, I want smooth animations when switching dates

---

### 3. Live Matches
**Description**: Dedicated view for all currently live matches.

**Requirements**:
- Dedicated "LIVE" tab with icon indicator
- Show only matches that are currently in progress
- Real-time score updates (15-second refresh interval)
- Visual indicator for live matches (red accent color)
- Display elapsed time for live matches
- Auto-refresh live data every 15 seconds
- Show match status badges (HT, PEN, BT, INT, elapsed time)
- Highlight live matches with visual indicators

**User Stories**:
- As a user, I want to see all live matches in one place
- As a user, I want live scores to update automatically
- As a user, I want to know how long a match has been playing

---

### 4. Favorite Competitions
**Description**: Personalized view of matches from user's favorite leagues.

**Requirements**:
- Display favorite competitions section at the top
- Filter matches by favorite league IDs
- Show "No matches" message when no favorites have matches
- Support multiple favorite leagues
- Group matches by league within favorites section
- Show favorite competitions before "All competitions" section
- Empty state when user has no favorites configured

**User Stories**:
- As a user, I want to see matches from my favorite leagues first
- As a user, I want to quickly access matches I care about most
- As a user, I want to know when my favorite teams are playing

---

### 5. Timezone Support
**Description**: Automatic timezone detection and timezone-aware match display.

**Requirements**:
- Automatically detect device timezone on app launch
- Update timezone when user travels (detect device timezone changes)
- Display all match times in user's local timezone
- Group matches by local date (not UTC date)
- Support 61+ timezones (validated against backend list)
- Update timezone automatically when app comes to foreground
- Poll for timezone changes every 2 hours (safety net)
- Use browser/device APIs for timezone detection:
  - Expo Localization (native)
  - Intl.DateTimeFormat (web fallback)

**User Stories**:
- As a user traveling, I want match times to automatically update to my new timezone
- As a user, I want to see matches grouped by my local date
- As a user, I want match times displayed in my local time format

---

### 6. Match Cards
**Description**: Individual match display cards with comprehensive information.

**Requirements**:
- Display team names with country flags
- Show team scores (home/away)
- Display match status badge
- Show match time or elapsed time
- Visual indicators:
  - Live match indicator (red accent bar)
  - Goal highlight animation (60-second highlight after goal)
  - Winner indicator for finished matches
- Support different card layouts:
  - Standard fixture card
  - Compact card variant
  - New design variant
- Clickable cards (future: navigate to match details)
- Show penalty shootout scores when applicable
- Display extra time scores when applicable

**User Stories**:
- As a user, I want to quickly see which team is winning
- As a user, I want to know if a match is live or finished
- As a user, I want to see when a goal is scored with visual feedback

---

### 7. Performance & Caching
**Description**: Optimized performance with intelligent caching strategies.

**Requirements**:
- Sub-50ms response times for cached requests
- 95%+ cache hit rate
- Multi-layer caching:
  - Edge Cache (L1): <10ms response time
  - R2 Storage (L3): Persistent cache for historical/future data
- Smart cache invalidation:
  - Today's matches: 15-second refresh
  - Yesterday's matches: 1-hour cache
  - Tomorrow's matches: 1-hour cache
  - Older past: 1-day cache
  - Future dates: 3-day cache
- Prefetch fixtures for all date tabs in background
- Use React Query for client-side caching and deduplication
- Optimize for React Compiler (memoization, stable callbacks)

**User Stories**:
- As a user, I want the app to load instantly
- As a user, I want smooth navigation without loading delays
- As a user, I want data to be fresh but not wait for slow networks

---

### 8. Real-time Updates
**Description**: Live match data updates without manual refresh.

**Requirements**:
- Auto-refresh live matches every 15 seconds
- Background refresh scheduler (Durable Objects)
- Stale-while-revalidate pattern (show cached data while fetching fresh)
- Visual loading indicators during refresh
- Refetch on window/tab focus (web)
- Refetch on app foreground (native)
- Exponential backoff retry logic for failed requests
- Retry only on 503 (Service Unavailable) or 429 (Rate Limited) errors

**User Stories**:
- As a user watching live matches, I want scores to update automatically
- As a user, I want to see the latest data when I return to the app
- As a user, I want updates without manual refresh

---

## Technical Requirements

### Platform Support
- **Web**: Responsive design, max-width 800px, optimized for desktop and tablet
- **Native**: iOS and Android via React Native/Expo
- **Cross-platform**: Shared codebase with platform-specific optimizations

### Performance Targets
- **API Response Time**: <50ms for cached requests
- **Time to Interactive**: <1.5s on web, <3s on native
- **Cache Hit Rate**: 95%+
- **Bundle Size**: Optimized for fast loading
- **Memory Usage**: Efficient rendering with virtualization

### Data Requirements
- Support 61+ timezones
- Handle multiple match statuses
- Support various competition types
- Handle large datasets efficiently (virtualization)

### Accessibility
- Screen reader support
- Keyboard navigation (web)
- Proper ARIA labels
- High contrast support (dark mode)

---

## User Experience Requirements

### Visual Design

#### Colors

**Primary Colors:**
- **Primary Green (m-01)**: `rgb(24 124 86)` - Main brand color, used for active states and accents
- **Primary Light Variants**:
  - `m-01-light-01`: `rgb(38 151 108)` - Hover states, gradients
  - `m-01-light-02`: `rgb(52 183 120)` - Goal highlights, subtle accents
  - `m-01-light-03`: `rgb(58 206 135)` - Live match indicators
  - `m-01-light-04`: `rgb(102 227 167)` - Dark mode accents
- **Primary Dark**: `m-01-dark-01`: `rgb(36 87 68)` - Darker variant

**Secondary Colors:**
- **Secondary Lime (m-02)**: `rgb(118 197 39)` - Secondary accent, gradients
- **Secondary Variants**:
  - `m-02-dark-01`: `rgb(106 184 69)` - Gradient stops
  - `m-02-dark-02`: `rgb(103 170 71)`
  - `m-02-light-01`: `rgb(139 221 33)`
  - `m-02-light-02`: `rgb(151 233 46)`
  - `m-02-light-03`: `rgb(191 243 124)`

**Neutral Scale (Light Mode):**
- **Background**: `neu-02`: `rgb(249 249 249)` - Main background
- **Cards/Surface**: `neu-01`: `rgb(255 255 255)` - Card backgrounds
- **Subtle Background**: `neu-03`: `rgb(240 241 241)` - Secondary surfaces
- **Borders**: `neu-04`: `rgb(227 229 228)` - Card dividers, borders
- **Text Primary**: `neu-10`: `rgb(79 86 84)` - Main text color
- **Text Secondary**: `neu-07`: `rgb(139 149 145)` - Secondary text
- **Text Tertiary**: `neu-06`: `rgb(195 200 198)` - Muted text

**Neutral Scale (Dark Mode):**
- **Background**: `neu-13`: `rgb(19 20 19)` - Main dark background
- **Cards/Surface**: `neu-11`: `rgb(49 53 52)` - Card backgrounds
- **Borders**: `neu-10`: `rgb(79 86 84)` - Card dividers
- **Text Primary**: `neu-01`: `rgb(255 255 255)` - Main text
- **Text Secondary**: `neu-06`: `rgb(195 200 198)` - Secondary text
- **Text Tertiary**: `neu-07`: `rgb(139 149 145)` - Muted text

**Semantic Colors:**
- **Red**: `rgb(212 66 66)` - Live matches, errors, alerts
- **Orange**: `rgb(248 148 32)` - Warnings
- **Yellow**: `rgb(255 209 46)` - Notifications
- **Teal**: `rgb(35 205 174)` - Info states
- **Cyan**: `rgb(56 186 215)` - Links, highlights
- **Blue**: `rgb(20 121 178)` - Interactive elements

**Gradients:**
- **Gradient 01**: `106.45deg` from `m-01-light-01` to `m-02-dark-01` - Tab indicators, active states
- **Gradient 02**: `112.63deg` from `m-02` to `m-01-light-01` - Accent gradients
- **Gradient 03**: `97.5deg` from `m-02-dark-01` to `m-02-light-02` - Button backgrounds
- **Gradient 04**: `360deg` from `m-01` to `m-01-light-01` - Subtle accents

#### Typography

**Font Family:**
- **Primary**: Source Sans 3 (Regular, SemiBold, Bold)
- **Fallback**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

**Font Weights:**
- **Regular**: `font-sans-regular` - Body text, default
- **SemiBold**: `font-sans-semibold` - Headings, emphasis
- **Bold**: `font-sans-bold` - Strong emphasis, titles

**Text Variants:**

**Titles:**
- **Title 01**: `font-sans-semibold`, `uppercase`, `max-w-[400px]` - Section headers
- **Title 02**: `font-sans-semibold`, `uppercase`, `text-[0.875rem]` (14px), `max-w-[400px]` - Subsection headers

**Highlights:**
- **Highlight 01**: `font-sans-regular`, `text-[1.25rem]` (20px) - Large numbers, dates
- **Highlight 02**: `font-sans-bold`, `text-[1.25rem]` (20px) - Emphasized numbers
- **Highlight 03**: `font-sans-regular`, `text-[1.125rem]` (18px) - Medium emphasis
- **Highlight 04**: `font-sans-bold`, `text-[1.125rem]` (18px) - Bold medium emphasis

**Body Text:**
- **Body 01**: `font-sans-regular`, `text-[1rem]` (16px) - Primary body text
- **Body 01 Semi**: `font-sans-semibold`, `text-[1rem]` (16px) - Emphasized body
- **Body 02**: `font-sans-regular`, `text-[0.875rem]` (14px) - Secondary body text
- **Body 02 Semi**: `font-sans-semibold`, `text-[0.875rem]` (14px) - Emphasized secondary

**Captions:**
- **Caption 01**: `font-sans-semibold`, `text-[0.75rem]` (12px), `uppercase` - Labels, badges
- **Caption 02**: `font-sans-regular`, `text-[0.75rem]` (12px) - Small text, metadata
- **Caption 03**: `font-sans-semibold`, `text-[0.625rem]` (10px) - Tiny labels

**Headings (Semantic):**
- **H1**: `text-4xl`, `font-sans-bold`, `text-center`, `tracking-tight` - Page titles
- **H2**: `text-3xl`, `font-sans-semibold`, `tracking-tight`, `border-b`, `pb-2` - Section titles
- **H3**: `text-2xl`, `font-sans-semibold`, `tracking-tight` - Subsection titles
- **H4**: `text-xl`, `font-sans-semibold`, `tracking-tight` - Card titles

#### Spacing Scale

**Base Spacing Units:**
- `4px` - Minimal spacing (tight groups)
- `8px` - Small spacing (icon to text, small gaps)
- `16px` - Standard spacing (card padding, element gaps)
- `24px` - Medium spacing (section gaps, icon sizes)
- `32px` - Large spacing (major sections)
- `40px` - Extra large spacing (title sections)
- `48px` - XXL spacing (major layout gaps)
- `56px` - XXXL spacing
- `64px` - Maximum spacing

**Component-Specific Spacing:**
- **Card Padding**: `px-16` (16px horizontal) - Standard card padding
- **Card Height**: `h-64` (256px) - Fixture card height
- **Tab Bar Height**: `h-48` (48px) - Date tabs bar
- **Title Section Height**: `h-40` (160px) - Section header height
- **Icon Sizes**: `h-24 w-24` (96px), `h-20 w-20` (80px), `h-16 w-16` (64px)
- **Live Indicator**: `w-[2px]`, `h-48` (192px) - Vertical bar
- **Gap Between Elements**: `gap-x-[14px]` (14px horizontal), `gap-y-1` (4px vertical)

#### Layout Patterns

**Container Constraints:**
- **Max Width**: `800px` on web - Centered layout with max constraint
- **Full Width**: Native platforms use full screen width
- **Centering**: `self-center` or `alignSelf: "center"` - Center containers

**Content Structure:**
- **Main Content Padding**: `px-8` (32px) or `px-16` (64px) - Horizontal padding
- **Vertical Spacing**: `gap-y-1` to `gap-y-4` - Vertical element spacing
- **Section Spacing**: `24px` between major sections
- **Card Spacing**: `gap-0` (no gap) or `gap-x-[14px]` (14px) - Between cards

**Component Layouts:**
- **Fixture Cards**: `flex-row`, `items-center`, `h-64`, `px-16` - Horizontal card layout
- **Date Tabs**: `flex-row`, `items-stretch`, `h-12` - Horizontal tab bar
- **Title Sections**: `flex-row`, `items-center`, `h-40`, `px-0` - Horizontal header
- **Country Items**: Accordion with `h-40` trigger height

#### Border Radius

**Standard Radius:**
- `rounded-[4px]` - Small radius (buttons, badges, indicators)
- `rounded-md` - Medium radius (8px) - Status badges
- `rounded-lg` - Large radius (12px) - Title section accent bar
- `rounded-full` - Full radius (circular elements like flags)

#### Shadows

**Shadow Variants:**
- **sha-01**: `0px 5px 10px rgba(19, 20, 19, 0.12)` - Subtle elevation, cards
- **sha-02**: `0px 4px 12px rgba(19, 20, 19, 0.04)` - Light elevation
- **sha-03**: `0px 6px 24px rgba(52, 183, 120, 0.2)` - Colored shadow (green accent)
- **sha-04**: `0px 32px 72px rgba(19, 20, 19, 0.4)` - Heavy elevation, modals
- **sha-05**: `0px -5px 10px rgba(19, 20, 19, 0.12)` - Top shadow
- **sha-06**: `0px 5px 18px rgba(19, 20, 19, 0.3)` - Dark mode shadows
- **sha-07**: `-2px 2px 3px -1px rgba(19, 20, 19, 0.32)` - Inset shadow

#### Components

**Fixture Cards:**
- **Height**: `h-64` (64px)
- **Padding**: `px-16` (16px horizontal)
- **Background**: `bg-neu-01` (light) / `bg-neu-11` (dark)
- **Border**: `h-px` divider at bottom (`bg-neu-04` / `bg-neu-10`)
- **Live Indicator**: `w-[2px]`, `h-48`, `bg-m-01-light-03`, `rounded-[4px]`
- **Goal Highlight**: `inset-1`, `rounded-[4px]`, `bg-m-01-light-02` with opacity

**Status Badges:**
- **Padding**: `px-2 py-1` (8px horizontal, 4px vertical)
- **Border Radius**: `rounded-md` (8px)
- **Min Width**: `min-w-48` (48px)
- **Live Badge**: `bg-red/10`, `text-red`
- **Finished Badge**: `bg-neu-03`, `text-neu-07`

**Date Tabs:**
- **Height**: `h-48` (48px)
- **Background**: `bg-neu-01` (light) / `bg-neu-11` (dark)
- **Tab Indicator**: Gradient (`from-m-02` to `m-01-light-01`), animated
- **Active Tab**: White text (`text-neu-01`)
- **Inactive Tab**: Muted text (`text-neu-09/70` / `text-neu-06`)

**Title Sections:**
- **Height**: `h-40` (40px)
- **Accent Bar**: `h-4 w-16`, `rounded-r-lg`, gradient (`from-m-02-dark-01` to `m-02-light-02`)
- **Text**: `title-02` variant, `text-m-01` (light) / `text-m-01-light-04` (dark)
- **Spacing**: `gap-2` (8px) between accent and text

**Buttons:**
- **Padding**: `px-2 py-1` (standard) or `px-4 py-2` (large)
- **Border Radius**: `rounded-md` (8px) or `rounded-[4px]` (4px)
- **Background**: Primary color (`bg-m-01`) or gradient
- **Text**: `uppercase`, `font-sans-semibold`, `caption-01` variant

**Icons:**
- **Standard Size**: `h-24 w-24` (96px) or `h-20 w-20` (80px)
- **Small Size**: `h-16 w-16` (64px)
- **Color**: `currentColor` or specific color classes (`text-m-01`, `text-neu-01`)

#### Dark Mode

**Implementation:**
- Uses `dark:` prefix for dark mode styles
- Automatic detection via system preferences
- Consistent color mapping:
  - Light backgrounds → Dark backgrounds (`neu-02` → `neu-13`)
  - Light cards → Dark cards (`neu-01` → `neu-11`)
  - Dark text → Light text (`neu-10` → `neu-01`)
  - Borders adapt (`neu-04` → `neu-10`)

**Dark Mode Specific:**
- Shadows: `sha-06` for elevated elements
- Text colors: Lighter variants for readability
- Accent colors: Slightly brighter (`m-01-light-04`)

#### Animations & Transitions

**Tab Transitions:**
- Smooth spring animations for tab indicator
- Opacity interpolation for tab content
- `Animated.spring` with `tension: 300`, `friction: 30`

**Goal Detection:**
- 60-second highlight animation after goal
- Opacity-based overlay (`opacity-10`)
- Automatic fade-out after timeout

**Loading States:**
- Skeleton loaders (future)
- Smooth transitions between states
- `startTransition` for non-urgent updates

#### Responsive Design

**Web:**
- Max width: `800px` - Centered layout
- Responsive padding: Adapts to screen size
- Touch-friendly: Minimum 44px touch targets

**Native:**
- Full screen width
- Platform-specific optimizations
- Native gestures (swipe, pull-to-refresh)

#### Accessibility

**Color Contrast:**
- WCAG AA compliant color combinations
- High contrast in dark mode
- Semantic color usage (red for live, green for active)

**Typography:**
- Minimum 12px font size
- Clear hierarchy with weight and size
- Uppercase labels for emphasis

**Interactive Elements:**
- Minimum 44px touch targets
- Clear focus states
- Screen reader support via ARIA labels

### Interaction Patterns
- Swipe gestures on native (date navigation)
- Click/tap for date selection
- Smooth tab transitions
- Loading states for data fetching
- Empty states for no matches
- Error states with retry options

### Information Architecture
1. **Home Screen**: Date tabs + fixtures list
2. **Date Tabs**: 5-day window navigation that exists on home screen
3. **Live Tab**: All live matches that exists on home screen
4. **Favorites Section**: Top of each date view
5. **All Competitions**: Below favorites

---

## Future Enhancements (Not Currently Implemented)

### Planned Features
- **Match Details**: Deep dive into individual match information
- **Team Details**: Team statistics and history
- **Push Notifications**: Goal alerts, match start reminders
- **User Preferences**: Customizable favorite teams/leagues
- **Match Predictions**: AI-powered predictions
- **Head-to-Head**: Historical match data between teams
- **Calendar Integration**: Add matches to device calendar
- **Share Functionality**: Share match information
- **Search**: Search for teams, leagues, or matches
- **Filters**: Filter by competition, team, or match status

---

## Non-Functional Requirements

### Reliability
- 99.9% uptime target
- Graceful error handling
- Offline support (cached data)
- Retry logic for failed requests

### Security
- CORS protection
- Rate limiting
- Input validation (Zod schemas)
- Secure API communication (HTTPS)

### Scalability
- Handle high traffic loads
- Efficient quota management
- Atomic operations for concurrent requests
- Edge distribution for global users

### Maintainability
- TypeScript for type safety
- Modular architecture
- Comprehensive error logging
- Performance monitoring

---

## Success Metrics

### Performance Metrics
- Average API response time <50ms
- Cache hit rate >95%
- Time to interactive <2s
- Zero layout shifts (CLS)

### User Engagement Metrics
- Daily active users
- Average session duration
- Matches viewed per session
- Date tab navigation frequency

### Technical Metrics
- Error rate <0.1%
- API quota usage efficiency
- Cache efficiency
- Bundle size optimization

---

## Product Requirements Summary

### Must Have (MVP)
✅ Date-based match navigation (5-day window)  
✅ Live matches view  
✅ Match cards with scores and status  
✅ Timezone-aware display  
✅ Favorite competitions section  
✅ Real-time updates (15s refresh)  
✅ Cross-platform support (web + native)  
✅ Performance optimization (caching)  

### Should Have (Next Release)
- Match details page
- User preferences (favorite teams/leagues)
- Push notifications
- Search functionality

### Nice to Have (Future)
- Team statistics
- Match predictions
- Calendar integration
- Social sharing
- Advanced filters

---

## Architecture Overview

### Frontend
- **Framework**: React Native with Expo
- **State Management**: React Query + Context API
- **Styling**: Uniwind + RN Reusables as Component Library (Tailwind CSS)
- **Routing**: Expo Router
- **Performance**: React Compiler optimizations

### Backend
- **Platform**: Cloudflare Workers
- **Framework**: Hono
- **Caching**: Multi-layer (Edge Cache, R2 Storage)
- **Scheduling**: Durable Objects
- **API**: API-Football (RapidAPI)

### Data Flow
1. User requests fixtures for a date
2. Backend checks cache layers (Edge → R2)
3. If cache miss, fetch from API-Football
4. Transform data for user's timezone
5. Cache transformed response
6. Return to frontend
7. Frontend displays with React Query caching

---

*Last Updated: 2026*
*Version: 1.0*

