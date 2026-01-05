import { Platform } from 'react-native';

/**
 * Check if the app is running on web
 */
export const isWeb = Platform.OS === 'web';

/**
 * Check if the app is running on iOS
 */
export const isIOS = Platform.OS === 'ios';

/**
 * Check if the app is running on Android
 */
export const isAndroid = Platform.OS === 'android';

/**
 * Check if the app is running on native (iOS or Android)
 */
export const isNative = isIOS || isAndroid;

/**
 * Get the current platform
 */
export const currentPlatform = Platform.OS;

