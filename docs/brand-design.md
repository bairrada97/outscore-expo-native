# Brand Design Documentation

## Overview
This documentation provides comprehensive access to the Outscore brand design system, including all UI tokens, color palettes, typography, spacing, shadows, gradients, and component styling patterns.

## Core Brand Identity

### Brand Name
**Outscore** - A high-performance, cross-platform football fixtures application

### Brand Colors
The brand uses a **green and lime** color scheme with comprehensive neutral scales for light and dark modes.

---

## Color System

### Primary Colors (M-01 - Green)
**Main Brand Green** - Used for active states, accents, live indicators

- `--color-m-01`: `rgb(24 124 86)` - Main brand color
- `--color-m-01-light-01`: `rgb(38 151 108)` - Hover states, gradients
- `--color-m-01-light-02`: `rgb(52 183 120)` - Goal highlights, subtle accents
- `--color-m-01-light-03`: `rgb(58 206 135)` - Live match indicators
- `--color-m-01-light-04`: `rgb(102 227 167)` - Dark mode accents
- `--color-m-01-dark-01`: `rgb(36 87 68)` - Darker variant

**Tailwind Classes:**
- `bg-m-01`, `text-m-01`, `border-m-01`
- `bg-m-01-light-01`, `bg-m-01-light-02`, `bg-m-01-light-03`, `bg-m-01-light-04`
- `bg-m-01-dark-01`
- Dark mode: `dark:bg-m-01-light-04`, `dark:text-m-01-light-03`

### Secondary Colors (M-02 - Lime)
**Secondary Accent** - Used for gradients, secondary accents

- `--color-m-02`: `rgb(118 197 39)` - Secondary accent
- `--color-m-02-dark-01`: `rgb(106 184 69)` - Gradient stops
- `--color-m-02-dark-02`: `rgb(103 170 71)` - Dark variation
- `--color-m-02-light-01`: `rgb(139 221 33)` - Light accent
- `--color-m-02-light-02`: `rgb(151 233 46)` - Lighter accent
- `--color-m-02-light-03`: `rgb(191 243 124)` - Lightest accent

**Tailwind Classes:**
- `bg-m-02`, `text-m-02`, `from-m-02`, `to-m-02`
- `bg-m-02-dark-01`, `bg-m-02-dark-02`
- `bg-m-02-light-01`, `bg-m-02-light-02`, `bg-m-02-light-03`

### Neutral Colors (NEU)
**13-tier neutral scale** for backgrounds, text, borders

**Light Mode Usage:**
- `--color-neu-01`: `rgb(255 255 255)` - White, card backgrounds
- `--color-neu-02`: `rgb(249 249 249)` - Light background, main app background
- `--color-neu-03`: `rgb(240 241 241)` - Subtle background, secondary surfaces
- `--color-neu-04`: `rgb(227 229 228)` - Light borders, card dividers
- `--color-neu-05`: `rgb(218 221 219)` - Medium-light borders
- `--color-neu-06`: `rgb(195 200 198)` - Muted text, tertiary text
- `--color-neu-07`: `rgb(139 149 145)` - Secondary text
- `--color-neu-08`: `rgb(112 123 119)` - Medium-dark gray
- `--color-neu-09`: `rgb(94 103 99)` - Dark gray
- `--color-neu-10`: `rgb(79 86 84)` - Primary text color (light mode)
- `--color-neu-11`: `rgb(49 53 52)` - Very dark (dark mode cards)
- `--color-neu-12`: `rgb(31 34 32)` - Near black (dark mode backgrounds)
- `--color-neu-13`: `rgb(19 20 19)` - Almost black (dark mode main background)

**Dark Mode Mapping:**
- Background: `neu-02` → `neu-13`
- Cards/Surface: `neu-01` → `neu-11`
- Borders: `neu-04` → `neu-10`
- Text Primary: `neu-10` → `neu-01`
- Text Secondary: `neu-07` → `neu-06`

**Tailwind Classes:**
- `bg-neu-01` through `bg-neu-13`
- `text-neu-01` through `text-neu-13`
- `border-neu-01` through `border-neu-13`
- Dark mode: `dark:bg-neu-13`, `dark:text-neu-01`, etc.

### Semantic Colors
**State-based colors** for specific use cases

- `--color-burgundy`: `rgb(120 47 47)` - Special states
- `--color-red`: `rgb(212 66 66)` - **Live matches, errors, alerts**
- `--color-orange`: `rgb(248 148 32)` - **Warnings**
- `--color-yellow`: `rgb(255 209 46)` - **Notifications**
- `--color-teal`: `rgb(35 205 174)` - **Info states**
- `--color-cyan`: `rgb(56 186 215)` - **Links, highlights**
- `--color-lime`: `rgb(139 221 33)` - Success states
- `--color-light-green`: `rgb(52 183 120)` - Success highlights
- `--color-dark-green`: `rgb(24 124 86)` - Success emphasis
- `--color-blue`: `rgb(20 121 178)` - **Interactive elements**

**Tailwind Classes:**
- `bg-red`, `text-red` - Live indicators
- `bg-orange`, `text-orange` - Warnings
- `bg-yellow`, `text-yellow` - Notifications
- `bg-teal`, `text-teal` - Info states
- `bg-cyan`, `text-cyan` - Links
- `bg-blue`, `text-blue` - Interactive elements

---

## Gradient System

### Brand Gradients
All gradients use directional angles with color stops

**Gradient 01** - Tab indicators, active states
- Direction: `106.45deg`
- Colors: `m-01-light-01` (8.47%) → `m-02-dark-01` (92.4%)
- Usage: `bg-linear-to-r from-m-01-light-01 to-m-02-dark-01`

**Gradient 02** - Accent gradients
- Direction: `112.63deg`
- Colors: `m-02` (10.93%) → `m-01-light-01` (88.2%)
- Usage: `bg-linear-to-r from-m-02 to-m-01-light-01`

**Gradient 03** - Button backgrounds, accents (with inverted variant)
- Direction: `97.5deg`
- Colors: `m-02-dark-01` (4.32%) → `m-02-light-02` (94.22%)
- Usage: `bg-linear-to-r from-m-02-dark-01 to-m-02-light-02`
- Inverted: `from-m-02-light-02 to-m-02-dark-01`

**Gradient 04** - Subtle accents
- Direction: `360deg`
- Colors: `m-01` (0%) → `m-01-light-01` (100%)
- Usage: `bg-linear-to-r from-m-01 to-m-01-light-01`

**Gradient 05** - Neutral gradient (with inverted variant)
- Direction: `97.5deg`
- Colors: `neu-10` (4.32%) → `neu-09` (94.22%)
- Inverted: `neu-09` → `neu-01`

**Gradient 06** - Medium neutral gradient (with inverted variant)
- Direction: `97.5deg`
- Colors: `neu-08` (4.32%) → `neu-07` (94.22%)

**Gradient 07** - Light neutral gradient (with inverted variant)
- Direction: `97.5deg`
- Colors: `neu-06` (4.32%) → `neu-05` (94.22%)

**Common Gradient Patterns:**
- `bg-linear-to-r` - Left to right
- `bg-linear-to-b` - Top to bottom
- `bg-linear-to-br` - Diagonal bottom-right
- Opacity support: `from-m-01-light-03/30` (30% opacity)

---

## Typography System

### Font Family
**Source Sans 3** - Professional, readable sans-serif

**Font Files Location:** `/apps/frontend/assets/fonts/`

**Font Variants:**
- `SourceSans3-Regular.ttf` - Regular weight (default body text)
- `SourceSans3-SemiBold.ttf` - SemiBold weight (headings, emphasis)
- `SourceSans3-Bold.ttf` - Bold weight (strong emphasis, titles)

**System Fallback:**
```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

**CSS Variables:**
- `--font-sans-regular`: Source Sans 3 Regular
- `--font-sans-semibold`: Source Sans 3 SemiBold
- `--font-sans-bold`: Source Sans 3 Bold

**Tailwind Classes:**
- `font-sans-regular` - Default body text
- `font-sans-semibold` - Headings, emphasis
- `font-sans-bold` - Strong emphasis

### Font Sizes
**Semantic size scale** with both named and numeric sizes

**CSS Variables:**
- `--font-size-10`: `0.625rem` (10px)
- `--font-size-12`: `0.75rem` (12px)
- `--font-size-14`: `0.875rem` (14px)
- `--font-size-16`: `1rem` (16px)
- `--font-size-18`: `1.125rem` (18px)
- `--font-size-20`: `1.25rem` (20px)

**Tailwind Size Classes:**
- `text-[0.625rem]` - 10px
- `text-[0.75rem]` - 12px
- `text-[0.875rem]` - 14px
- `text-[1rem]` - 16px
- `text-[1.125rem]` - 18px
- `text-[1.25rem]` - 20px

### Text Variants
**Pre-configured text styles** for consistent typography

#### Titles
- **title-01**: `font-sans-semibold uppercase max-w-[400px]` - Section headers
- **title-02**: `font-sans-semibold uppercase text-[0.875rem] max-w-[400px]` - Subsection headers (14px)

#### Highlights
- **highlight-01**: `font-sans-regular text-[1.25rem] max-w-[400px]` - Large numbers, dates (20px)
- **highlight-02**: `font-sans-bold text-[1.25rem] max-w-[400px]` - Emphasized numbers (20px, bold)
- **highlight-03**: `font-sans-regular text-[1.125rem] max-w-[400px]` - Medium emphasis (18px)
- **highlight-04**: `font-sans-bold text-[1.125rem] max-w-[400px]` - Bold medium emphasis (18px, bold)

#### Body Text
- **body-01**: `font-sans-regular text-[1rem] max-w-[400px]` - Primary body text (16px)
- **body-01--semi**: `font-sans-semibold text-[1rem] max-w-[400px]` - Emphasized body (16px, semibold)
- **body-02**: `font-sans-regular text-[0.875rem] max-w-[400px]` - Secondary body text (14px)
- **body-02--semi**: `font-sans-semibold text-[0.875rem] max-w-[400px]` - Emphasized secondary (14px, semibold)

#### Captions
- **caption-01**: `font-sans-semibold text-[0.75rem] max-w-[400px]` - Labels, badges (12px, uppercase)
- **caption-02**: `font-sans-regular text-[0.75rem] max-w-[400px]` - Small text, metadata (12px)
- **caption-03**: `font-sans-semibold text-[0.625rem] max-w-[400px]` - Tiny labels (10px)

#### Semantic Headings
- **h1**: `text-4xl font-sans-bold text-center tracking-tight` - Page titles
- **h2**: `text-3xl font-sans-semibold tracking-tight border-b pb-2` - Section titles
- **h3**: `text-2xl font-sans-semibold tracking-tight` - Subsection titles
- **h4**: `text-xl font-sans-semibold tracking-tight` - Card titles

**Usage in Components:**
```tsx
import { Text } from "@/components/ui/text";

<Text variant="title-01">Section Header</Text>
<Text variant="highlight-02">42</Text>
<Text variant="body-01">Body text content</Text>
<Text variant="caption-01">BADGE LABEL</Text>
```

---

## Spacing System

### Spacing Scale
**8px base unit** with consistent increments

**CSS Variables:**
- `--spacing-0`: `0px` - No spacing
- `--spacing-4`: `4px` - Minimal spacing (tight groups)
- `--spacing-8`: `8px` - Small spacing (icon-to-text, small gaps)
- `--spacing-16`: `16px` - **Standard spacing** (card padding, element gaps)
- `--spacing-24`: `24px` - Medium spacing (section gaps, icon sizes)
- `--spacing-32`: `32px` - Large spacing (major sections)
- `--spacing-40`: `40px` - Extra large spacing (title sections)
- `--spacing-48`: `48px` - XXL spacing (major layout gaps)
- `--spacing-56`: `56px` - XXXL spacing
- `--spacing-64`: `64px` - Maximum spacing

### Component-Specific Spacing

**Card Spacing:**
- Padding: `px-16` (16px horizontal) - Standard card padding
- Height: `h-64` (64px) - Fixture card height
- Gap: `gap-x-[14px]` (14px horizontal between elements)

**Layout Spacing:**
- Tab Bar: `h-48` (48px height)
- Title Section: `h-40` (40px height)
- Section Gap: `gap-y-4` (16px vertical spacing)
- Icon Sizes: `h-24 w-24` (24px), `h-20 w-20` (20px)

**Common Tailwind Patterns:**
- `px-8` - 8px horizontal padding
- `px-16` - 16px horizontal padding
- `py-4` - 4px vertical padding
- `py-12` - 12px vertical padding
- `gap-x-8` - 8px horizontal gap
- `gap-y-1` - 4px vertical gap
- `gap-y-4` - 16px vertical gap

---

## Shadow System

### Shadow Variants
**7 elevation levels** for depth and hierarchy

**sha-01** - Subtle elevation (cards, light elevation)
- Value: `0px 5px 10px rgba(19, 20, 19, 0.12)`
- Usage: `shadow-sha-01`
- Use case: Standard cards, subtle elevation

**sha-02** - Very light elevation
- Value: `0px 4px 12px rgba(19, 20, 19, 0.04)`
- Usage: `shadow-sha-02`
- Use case: Minimal elevation, hover states

**sha-03** - Green-tinted shadow (brand accent)
- Value: `0px 6px 24px rgba(52, 183, 120, 0.2)`
- Usage: `shadow-sha-03`
- Use case: Active states, green-themed components

**sha-04** - Heavy elevation (modals, overlays)
- Value: `0px 32px 72px rgba(19, 20, 19, 0.4)`
- Usage: `shadow-sha-04`
- Use case: Modals, popovers, floating elements

**sha-05** - Top shadow
- Value: `0px -5px 10px rgba(19, 20, 19, 0.12)`
- Usage: `shadow-sha-05`
- Use case: Bottom sheets, sticky headers

**sha-06** - Dark mode shadow
- Value: `0px 5px 18px rgba(19, 20, 19, 0.3)`
- Usage: `shadow-sha-06`, `dark:shadow-sha-06`
- Use case: Dark mode cards and elevated elements

**sha-07** - Inset/directional shadow
- Value: `-2px 2px 3px -1px rgba(19, 20, 19, 0.32)`
- Usage: `shadow-sha-07`
- Use case: Pressed states, inset effects

**Common Patterns:**
- Light mode: `shadow-sha-01`
- Dark mode: `dark:shadow-sha-06`
- Combined: `shadow-sha-01 dark:shadow-sha-06`

---

## Border Radius System

### Standard Radius Values

**Small Radius:**
- `rounded-[4px]` - Small components (buttons, badges, live indicators)
- Use case: Compact elements, tight corners

**Medium Radius:**
- `rounded-md` (8px) - Status badges, buttons
- Use case: Standard interactive elements

**Large Radius:**
- `rounded-lg` (12px) - Title section accent bars, cards
- Use case: Prominent elements, decorative accents

**Full Radius:**
- `rounded-full` - Circular elements (flags, avatars, dots)
- Use case: Circular shapes, pill buttons

**Directional Radius:**
- `rounded-tl-[8px]` - Top-left corner only
- `rounded-tr-[8px]` - Top-right corner only
- `rounded-r-lg` - Right side rounded (accent bars)

---

## Layout System

### Container Constraints

**Max Width:**
- Web: `max-w-[800px]` - Maximum content width
- Native: Full screen width
- Centering: `self-center` or `mx-auto`

**App Size Constant:**
- `--app-size`: `800px`

### Flexbox Patterns

**Common Layouts:**
- `flex-row` - Horizontal layout (default for cards)
- `flex-col` - Vertical layout (lists, stacks)
- `flex-1` - Flex grow (fill available space)
- `items-center` - Vertical centering
- `items-stretch` - Full height items
- `justify-between` - Space between items
- `justify-center` - Horizontal centering

**Utility Class:**
- `.flex-center` - Display flex with center alignment
  ```css
  display: flex;
  align-items: center;
  justify-content: center;
  ```

### Content Padding

**Horizontal Padding:**
- `px-8` (8px) - Compact padding
- `px-16` (16px) - Standard card padding
- `px-0` - No padding (full-width content)

**Vertical Padding:**
- `py-4` (4px) - Compact vertical spacing
- `py-12` (12px) - Standard vertical spacing

---

## Component Patterns

### Fixture Cards

**Standard Fixture Card:**
```tsx
<View className="h-64 px-16 flex-row items-center bg-neu-01 dark:bg-neu-11">
  {/* Live indicator */}
  <View className="w-[2px] h-48 bg-m-01-light-03 rounded-[4px]" />

  {/* Goal highlight overlay */}
  <View className="absolute inset-1 rounded-[4px] bg-m-01-light-02 opacity-10" />

  {/* Card separator (CSS class) */}
  <View className="fixture-card" />
</View>
```

**Styling:**
- Height: `h-64` (64px)
- Padding: `px-16` (16px horizontal)
- Background: `bg-neu-01` / `dark:bg-neu-11`
- Live indicator: `w-[2px] h-48 bg-m-01-light-03 rounded-[4px]`
- Goal highlight: `inset-1 rounded-[4px] bg-m-01-light-02 opacity-10`

**CSS Class `.fixture-card`:**
- Adds separator line at bottom (except last item)
- Light: `bg-neu-04`
- Dark: `bg-neu-12`

### Status Badges

```tsx
<View className="px-2 py-1 rounded-md min-w-48 bg-red/10">
  <Text className="text-red uppercase caption-01">LIVE</Text>
</View>
```

**Styling:**
- Padding: `px-2 py-1` (8px horizontal, 4px vertical)
- Border radius: `rounded-md` (8px)
- Min width: `min-w-48` (48px)
- Live: `bg-red/10 text-red`
- Finished: `bg-neu-03 text-neu-07`

### Date Tabs

```tsx
<View className="h-48 bg-neu-01 dark:bg-neu-11 flex-row">
  {/* Active tab indicator with gradient */}
  <View className="absolute inset-0 bg-linear-to-r from-m-02 to-m-01-light-01" />

  {/* Tab content */}
  <Text className="text-neu-01">Active</Text>
  <Text className="text-neu-09/70 dark:text-neu-06">Inactive</Text>
</View>
```

**Styling:**
- Height: `h-48` (48px)
- Background: `bg-neu-01` / `dark:bg-neu-11`
- Active indicator: Gradient `from-m-02 to-m-01-light-01`
- Active text: `text-neu-01` (white)
- Inactive text: `text-neu-09/70` / `dark:text-neu-06`

### Title Sections

```tsx
<View className="h-40 flex-row items-center px-0 gap-2">
  {/* Accent bar */}
  <View className="h-4 w-16 rounded-r-lg bg-linear-to-r from-m-02-dark-01 to-m-02-light-02" />

  {/* Title text */}
  <Text variant="title-02" className="text-m-01 dark:text-m-01-light-04">
    Section Title
  </Text>
</View>
```

**Styling:**
- Height: `h-40` (40px)
- Layout: `flex-row items-center`
- Accent bar: `h-4 w-16 rounded-r-lg` with gradient
- Text: `title-02` variant, `text-m-01` / `dark:text-m-01-light-04`

### Buttons

```tsx
<TouchableOpacity className="px-4 py-2 rounded-md bg-m-01">
  <Text variant="caption-01" className="text-neu-01 uppercase">
    Button Text
  </Text>
</TouchableOpacity>
```

**Styling:**
- Padding: `px-4 py-2` (16px horizontal, 8px vertical)
- Border radius: `rounded-md` (8px)
- Background: `bg-m-01` (primary green)
- Text: `caption-01`, `uppercase`, `text-neu-01` (white)

---

## Dark Mode Support

### Implementation
Uses Tailwind's `dark:` prefix for dark mode variants

**System Detection:**
- Automatic via system preferences
- `dark:` prefix applies styles in dark mode

### Color Mapping

**Backgrounds:**
- `bg-neu-02` → `dark:bg-neu-13` (main background)
- `bg-neu-01` → `dark:bg-neu-11` (cards/surfaces)

**Text:**
- `text-neu-10` → `dark:text-neu-01` (primary text)
- `text-neu-07` → `dark:text-neu-06` (secondary text)

**Borders:**
- `border-neu-04` → `dark:border-neu-10`

**Shadows:**
- `shadow-sha-01` → `dark:shadow-sha-06`

**Accents:**
- `text-m-01` → `dark:text-m-01-light-04` (brighter in dark mode)

**Common Patterns:**
```tsx
className="bg-neu-01 dark:bg-neu-11 text-neu-10 dark:text-neu-01 shadow-sha-01 dark:shadow-sha-06"
```

---

## Custom CSS Utilities

### Scrollbar Hide
Hides scrollbars across all browsers

```css
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

**Usage:** `className="scrollbar-hide"`

### Fixture Card Separator
Adds separator line between cards (except last)

```css
.fixture-card:not(:last-of-type)::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 8px;
  right: 8px;
  height: 1px;
  background: var(--color-neu-04);
}
.dark .fixture-card:not(:last-of-type)::after {
  background: var(--color-neu-12);
}
```

**Usage:** `className="fixture-card"`

### Flex Center
Quick flex centering utility

```css
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Usage:** `className="flex-center"`

---

## Animation & Transitions

### Spring Animations
Used for tab transitions and smooth UI

**React Native Animated:**
```typescript
Animated.spring(animatedValue, {
  toValue: targetValue,
  tension: 300,
  friction: 30,
  useNativeDriver: true,
})
```

### Accordion Animations
Smooth expand/collapse with easing curves

**Easing:**
```typescript
import { Easing } from 'react-native-reanimated';
Easing.bezier(0.25, 0.1, 0.25, 1); // ease-out
```

**Animations:**
- `animate-accordion-down` (web)
- `animate-accordion-up` (web)
- Chevron rotation: `rotate-180deg`

### Goal Highlight Animation
60-second highlight after goal detection

**Pattern:**
```tsx
{showGoalHighlight && (
  <View className="absolute inset-1 rounded-[4px] bg-m-01-light-02 opacity-10" />
)}
```

### Live Indicator Pulse
Subtle pulse for live match indicators

**Opacity Animation:**
- Pulse between `opacity-100` and `opacity-50`
- 2-second cycle

---

## Icon System

### Icon Library
**Lucide Icons** via `@/components/ui/icon`

**Standard Sizes:**
- Default: `size-5` (20px)
- Small: `size-4` (16px)
- Medium: `size-6` (24px)
- Large: `size-8` (32px)

**Usage:**
```tsx
import { Icon } from "@/components/ui/icon";
import { Calendar } from "lucide-react-native";

<Icon icon={Calendar} size={20} className="text-m-01" />
```

### Custom SVG Icons
**Location:** `/apps/frontend/components/ui/SvgIcons/`

**Available Icons:**
- Event icons: Goal, OwnGoal, Sub, PenaltyGoal, PenaltyMissed
- Card icons: RedCard, YellowCard, SecondYellowCard
- Navigation: Matches, Following, Leagues, MyGames
- Utility: Close, Favorite, Calendar, ViewMore

**Icon Sizes in Components:**
- Large: `h-24 w-24` (96px)
- Medium: `h-20 w-20` (80px)
- Small: `h-16 w-16` (64px)

---

## Accessibility

### Color Contrast
WCAG AA compliant color combinations

**Text Contrast:**
- Primary text: `neu-10` on `neu-01` (light mode)
- Primary text: `neu-01` on `neu-13` (dark mode)
- Minimum contrast ratio: 4.5:1

### Typography Accessibility
- Minimum font size: 12px (`caption-02`, `caption-03`)
- Clear hierarchy with weight and size
- Uppercase for labels and emphasis

### Interactive Elements
- Minimum touch target: 44px (web and native)
- Clear focus states
- ARIA labels via Text component
- Role attributes: `heading`, `code`, `blockquote`
- ARIA levels for headings: `aria-level="1"` through `"4"`

---

## Responsive Design

### Web Constraints
- Max width: `800px` - Centered layout
- Responsive padding adapts to screen size
- Touch-friendly minimum 44px targets

### Native Platforms
- Full screen width utilization
- Platform-specific optimizations
- Native gestures (swipe, pull-to-refresh)

### Platform-Specific Styling
```tsx
Platform.select({
  web: "select-text scroll-m-20 text-balance",
  native: "...",
})
```

---

## Styling Stack & Tools

### CSS Framework
- **Tailwind CSS v4.1.0** - Utility-first CSS
- **NativeWind v4.2.1** - React Native Tailwind adapter
- **Uniwind v1.2.2** - Multi-platform CSS

### Utility Libraries
- **tailwind-merge v3.4.0** - Smart class merging
- **class-variance-authority v0.7.1** - Type-safe variants
- **clsx v2.1.1** - Conditional className builder

### Helper Function
```typescript
import { cn } from "@/lib/utils";

// Combines classes intelligently
cn("bg-neu-01", "text-neu-10", isDark && "dark:bg-neu-13")
```

---

## File Locations Reference

### Design System Files
- **Global CSS:** `/apps/frontend/global.css`
- **UI Components:** `/apps/frontend/components/ui/`
- **Text Component:** `/apps/frontend/components/ui/text.tsx`
- **Icon Component:** `/apps/frontend/components/ui/icon.tsx`
- **Button Component:** `/apps/frontend/components/ui/button.tsx`
- **Accordion Component:** `/apps/frontend/components/ui/accordion.tsx`

### Assets
- **Fonts:** `/apps/frontend/assets/fonts/`
- **Icons:** `/apps/frontend/assets/icons/`
- **Images:** `/apps/frontend/assets/`

### Configuration
- **Components Config:** `/apps/frontend/components.json`
- **App Config:** `/apps/frontend/app.json`
- **Utilities:** `/apps/frontend/lib/utils.ts`
- **Constants:** `/apps/frontend/utils/constants.ts`

### Documentation
- **Product Overview:** `/.cursor/PRODUCT_OVERVIEW.md`
- **Brand Design Skill:** `/.claude/skills/brand-design/SKILL.md`

---

## Quick Reference Examples

### Common Component Patterns

**Card with shadow:**
```tsx
<View className="bg-neu-01 dark:bg-neu-11 shadow-sha-01 dark:shadow-sha-06 rounded-lg p-16">
  <Text variant="body-01" className="text-neu-10 dark:text-neu-01">
    Content
  </Text>
</View>
```

**Primary button:**
```tsx
<TouchableOpacity className="bg-m-01 px-4 py-2 rounded-md">
  <Text variant="caption-01" className="text-neu-01 uppercase">
    Click Me
  </Text>
</TouchableOpacity>
```

**Section header:**
```tsx
<View className="h-40 flex-row items-center gap-2">
  <View className="h-4 w-16 rounded-r-lg bg-linear-to-r from-m-02-dark-01 to-m-02-light-02" />
  <Text variant="title-02" className="text-m-01 dark:text-m-01-light-04">
    Header
  </Text>
</View>
```

**Live badge:**
```tsx
<View className="px-2 py-1 rounded-md bg-red/10">
  <Text variant="caption-01" className="text-red uppercase">LIVE</Text>
</View>
```

---

## Design Principles

1. **Consistency** - Use semantic tokens, not arbitrary values
2. **Dark Mode First** - Always include dark mode variants
3. **Performance** - Optimize for React Compiler with stable styles
4. **Accessibility** - WCAG AA compliance, proper ARIA labels
5. **Cross-Platform** - Design works on web, iOS, and Android
6. **Semantic Colors** - Use semantic names (red for live, green for active)
7. **Spacing Rhythm** - Follow 8px base unit spacing scale
8. **Typography Hierarchy** - Use defined text variants, not arbitrary sizes

---

## Usage Instructions

When creating new components or features:

1. **Colors:** Use semantic color tokens (`bg-m-01`, `text-neu-10`)
2. **Typography:** Use Text component with variants (`variant="title-01"`)
3. **Spacing:** Follow spacing scale (`px-16`, `gap-4`)
4. **Shadows:** Use predefined shadows (`shadow-sha-01`)
5. **Dark Mode:** Always include dark variants (`dark:bg-neu-13`)
6. **Radius:** Use standard radius values (`rounded-md`, `rounded-lg`)
7. **Layout:** Use flexbox patterns (`flex-row items-center`)
8. **Icons:** Use Icon component with Lucide icons or custom SVGs

**Good Example:**
```tsx
<View className="bg-neu-01 dark:bg-neu-11 px-16 py-4 rounded-md shadow-sha-01 dark:shadow-sha-06">
  <Text variant="body-01" className="text-neu-10 dark:text-neu-01">
    Properly styled content
  </Text>
</View>
```

**Bad Example (avoid):**
```tsx
<View style={{ backgroundColor: '#ffffff', padding: 15, borderRadius: 7 }}>
  <Text style={{ fontSize: 15, color: '#333333' }}>
    Arbitrary values, no dark mode
  </Text>
</View>
```

---

*This skill provides comprehensive brand design guidelines for the Outscore application. All UI tokens, components, and patterns are documented here for consistent implementation across the codebase.*
