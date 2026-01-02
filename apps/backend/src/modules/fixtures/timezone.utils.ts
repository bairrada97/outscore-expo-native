import { format } from 'date-fns';
import { formatInTimeZone, getTimezoneOffset } from 'date-fns-tz';
import { getAdjacentDate } from './date.utils';


export interface TimezoneFetchStrategy {
  datesToFetch: string[];
  reason: string;
}


export const getCurrentHourInTimezone = (timezone: string): number => {
  const userNow = new Date();
  return parseInt(formatInTimeZone(userNow, timezone, 'HH'), 10);
};

/**
 * Get the dates we need to fetch based on the user's timezone and current time
 * This handles the edge case where users in different timezones need different UTC dates
 */
export const getDatesToFetch = (
  requestedDate: string,
  timezone: string,
  currentHour: number
): TimezoneFetchStrategy => {
  // If user is ahead of UTC (positive offset) - late in their day
  if (currentHour >= 20) {
    return {
      datesToFetch: [getAdjacentDate(requestedDate, -1), requestedDate],
      reason: `User timezone ahead of UTC (${timezone}), fetching yesterday and today`,
    };
  }
  
  // If user is behind UTC (negative offset) - early in their day
  if (currentHour <= 4) {
    return {
      datesToFetch: [requestedDate, getAdjacentDate(requestedDate, 1)],
      reason: `User timezone behind UTC (${timezone}), fetching today and tomorrow`,
    };
  }
  
  // For users in timezones close to UTC, we might need all three days
  return {
    datesToFetch: [
      getAdjacentDate(requestedDate, -1),
      requestedDate,
      getAdjacentDate(requestedDate, 1),
    ],
    reason: `User timezone near UTC (${timezone}), fetching all three days for safety`,
  };
};

/**
 * Validates if a timezone string is valid by attempting to get its offset
 */
const isValidTimezone = (timezone: string): boolean => {
  try {
    getTimezoneOffset(timezone, new Date());
    return true;
  } catch {
    return false;
  }
};

export const formatDateInTimezone = (
  date: string,
  timezone: string,
  formatStr: string
): string => {
  if (!isValidTimezone(timezone)) {
    console.warn(`Invalid timezone: ${timezone}, falling back to local formatting`);
    return format(new Date(date), formatStr);
  }

  try {
    return formatInTimeZone(date, timezone, formatStr);
  } catch (error) {
    console.error(`Error formatting date in timezone ${timezone}:`, error);
    return format(new Date(date), formatStr);
  }
};

