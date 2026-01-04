import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

const TIMEZONE_KEY = 'userTimeZone';
const DEFAULT_TIMEZONE = 'UTC';

/**
 * Gets the device's timezone directly
 */
export function getDeviceTimeZone(): string {
  // First try Expo Localization
  try {
    const timeZone = Localization.getCalendars()[0]?.timeZone;
    if (timeZone && timeZone !== 'UTC') {
      return timeZone;
    }
  } catch (error) {
    console.warn('Failed to get timezone from Expo Localization:', error);
  }

  // Then try the browser/JS API
  try {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimeZone && browserTimeZone !== 'UTC') {
      return browserTimeZone;
    }
  } catch (error) {
    console.warn('Failed to get timezone from Intl API:', error);
  }

  // Fall back to default
  return DEFAULT_TIMEZONE;
}

/**
 * Stores the user's timezone in AsyncStorage
 */
export async function storeTimeZone(): Promise<string> {
  const timeZone = getDeviceTimeZone();
  
  try {
    await AsyncStorage.setItem(TIMEZONE_KEY, timeZone);
    return timeZone;
  } catch (error) {
    console.error('Failed to store the time zone', error);
    return timeZone;
  }
}

/**
 * Gets the user's timezone from storage or device
 */
export async function getStoredTimeZone(): Promise<string> {
  try {
    const storedTimeZone = await AsyncStorage.getItem(TIMEZONE_KEY);
    
    if (storedTimeZone) {
      return storedTimeZone;
    }
    
    // If not in storage, get from device and store it
    const deviceTimeZone = getDeviceTimeZone();
    await AsyncStorage.setItem(TIMEZONE_KEY, deviceTimeZone);
    
    return deviceTimeZone;
  } catch (error) {
    console.error('Failed to retrieve the time zone', error);
    return getDeviceTimeZone();
  }
}

/**
 * Initializes the timezone, ensuring we always have a valid value
 */
export async function initializeTimeZone(): Promise<string> {
  return getStoredTimeZone();
}

