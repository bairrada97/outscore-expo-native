/**
 * API Configuration
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://outscore-api.outscore.workers.dev';

/**
 * Cache durations in milliseconds
 */
export const FIFTEEN_SECONDS_CACHE = 15 * 1000;
export const ONE_MINUTE_CACHE = 60 * 1000;
export const FIVE_MINUTES_CACHE = 5 * 60 * 1000;
export const ONE_HOUR_CACHE = 60 * 60 * 1000;
export const ONE_DAY_CACHE = 24 * 60 * 60 * 1000;
export const ONE_WEEK_CACHE = 7 * 24 * 60 * 60 * 1000;

/**
 * Date range for fixtures tabs
 */
export const DAYS_BEFORE_TODAY = 2;
export const DAYS_AFTER_TODAY = 2;
export const TOTAL_DAYS = DAYS_BEFORE_TODAY + 1 + DAYS_AFTER_TODAY; // 5 days total

/**
 * Live button label
 */
export const LIVE_BUTTON_LABEL = 'LIVE';

/**
 * App size constraint
 */
export const APP_MAX_WIDTH = 800;

/**
 * Default timezone
 */
export const DEFAULT_TIMEZONE = "UTC";

/**
 * H2H (Head-to-Head) type constant
 */
export const H2H = "H2H";

