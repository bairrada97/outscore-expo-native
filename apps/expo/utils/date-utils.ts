import { format, subDays, addDays } from 'date-fns';

/**
 * Generates an array of dates centered around today:
 * [2 days ago, yesterday, today, tomorrow, 2 days from now]
 */
export const getDateRange = (todayDate = new Date()) => {
  return [
    subDays(todayDate, 2),
    subDays(todayDate, 1),
    todayDate,
    addDays(todayDate, 1),
    addDays(todayDate, 2),
  ];
};

/**
 * Gets the formatted dates array for use in API calls
 */
export const getFormattedDateRange = (todayDate = new Date()) => {
  return getDateRange(todayDate).map(date => format(date, 'yyyy-MM-dd'));
};

/**
 * Calculates the initial tab index based on the current selected date
 */
export const getInitialTabIndex = (currentDate: Date | 'live', todayDate = new Date()) => {
  if (currentDate === 'live') {
    return 5; // Live tab is at index 5
  }
  
  // Find the index of the current date in the date range
  const dateRange = getDateRange(todayDate);
  const index = dateRange.findIndex(date => 
    format(date, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
  );
  
  return index >= 0 ? index : 2; // Default to today (index 2) if not found
}; 