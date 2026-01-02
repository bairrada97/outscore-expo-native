import { formatInTimeZone } from 'date-fns-tz';

export function isValidTimezone(timezone: string): boolean {
  try {
    formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
    return true;
  } catch (error) {
    return false;
  }
}