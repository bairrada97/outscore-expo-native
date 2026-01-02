import { format, formatInTimeZone } from 'date-fns-tz';

export interface TimezoneFetchStrategy {
  datesToFetch: string[];
  reason: string;
}

/**
 * Get the current hour in the specified timezone
 */
export const getCurrentHourInTimezone = (timezone: string): number => {
  const userNow = new Date();
  return parseInt(formatInTimeZone(userNow, timezone, 'HH'));
};

/**
 * Get the dates we need to fetch based on the user's timezone and current time
 */
export const getDatesToFetch = (
  requestedDate: string,
  timezone: string,
  currentHour: number
): TimezoneFetchStrategy => {
  // Helper function to get the day before or after a date
  const getAdjacentDate = (date: string, offsetDays: number): string => {
    const dateObj = new Date(date);
    dateObj.setDate(dateObj.getDate() + offsetDays);
    return format(dateObj, 'yyyy-MM-dd');
  };

  // If user is ahead of UTC (positive offset)
  if (currentHour >= 20) {
    return {
      datesToFetch: [getAdjacentDate(requestedDate, -1), requestedDate],
      reason: `User timezone ahead of UTC (${timezone}), fetching yesterday and today`
    };
  }
  // If user is behind UTC (negative offset)
  else if (currentHour <= 4) {
    return {
      datesToFetch: [requestedDate, getAdjacentDate(requestedDate, 1)],
      reason: `User timezone behind UTC (${timezone}), fetching today and tomorrow`
    };
  }
  // For users in timezones close to UTC, we might need all three days
  else {
    return {
      datesToFetch: [
        getAdjacentDate(requestedDate, -1),
        requestedDate,
        getAdjacentDate(requestedDate, 1)
      ],
      reason: `User timezone near UTC (${timezone}), fetching all three days for safety`
    };
  }
};

/**
 * Format a date in the specified timezone
 */
export const formatDateInTimezone = (date: string, timezone: string, formatStr: string): string => {
  try {
    return formatInTimeZone(date, timezone, formatStr);
  } catch (e) {
    return format(new Date(date), formatStr);
  }
}; 