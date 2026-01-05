import { addDays, format, isSameDay, parseISO, startOfDay, subDays } from 'date-fns';
import { DAYS_AFTER_TODAY, DAYS_BEFORE_TODAY } from './constants';

/**
 * Format a date for API requests (YYYY-MM-DD)
 */
export function formatDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Get today's date formatted for API
 */
export function getTodayFormatted(): string {
  return formatDateForApi(new Date());
}

/**
 * Get the date range for the tabs (2 days before, today, 2 days after)
 */
export function getDateRange(baseDate: Date = new Date()): Date[] {
  // Normalize to start of day to ensure consistent times
  const normalized = startOfDay(baseDate);
  const dates: Date[] = [];
  
  // Add days before today
  for (let i = DAYS_BEFORE_TODAY; i > 0; i--) {
    dates.push(subDays(normalized, i));
  }
  
  // Add today
  dates.push(normalized);
  
  // Add days after today
  for (let i = 1; i <= DAYS_AFTER_TODAY; i++) {
    dates.push(addDays(normalized, i));
  }
  
  return dates;
}

/**
 * Get the initial tab index based on the current date or URL param
 */
export function getInitialTabIndex(
  currentDate: Date | string | 'live',
  todayDate: Date = new Date()
): number {
  if (currentDate === 'live') {
    return DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY + 1; // Last tab (LIVE)
  }
  
  const dateToCheck = typeof currentDate === 'string' 
    ? parseISO(currentDate) 
    : currentDate;
  
  const dates = getDateRange(todayDate);
  const index = dates.findIndex(date => isSameDay(date, dateToCheck));
  
  // Default to today's index if not found
  return index >= 0 ? index : DAYS_BEFORE_TODAY;
}

/**
 * Get the tab index for today
 */
export function getTodayTabIndex(): number {
  return DAYS_BEFORE_TODAY;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: Date): boolean {
  return startOfDay(date) < startOfDay(new Date());
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(date: Date): boolean {
  return startOfDay(date) > startOfDay(new Date());
}

