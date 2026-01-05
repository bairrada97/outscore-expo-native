import * as Localization from 'expo-localization';

const DEFAULT_TIMEZONE = 'UTC';

/**
 * Gets the device's timezone directly
 */
export function getDeviceTimeZone(): string {
  // First try Expo Localization
  try {
    const timeZone = Localization.getCalendars()[0]?.timeZone;
    if (timeZone) {
      return timeZone;
    }
  } catch (error) {
    console.warn('Failed to get timezone from Expo Localization:', error);
  }

  // Then try the browser/JS API
  try {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimeZone) {
      return browserTimeZone;
    }
  } catch (error) {
    console.warn('Failed to get timezone from Intl API:', error);
  }

  // Fall back to default
  return DEFAULT_TIMEZONE;
}

