import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get the appropriate API URL based on environment
const getApiBaseUrl = () => {
	// First check for environment variable or manifest extra
	const configuredApiUrl = 
		Constants.expoConfig?.extra?.apiUrl ||
		process.env.EXPO_PUBLIC_API_URL;
	
	if (configuredApiUrl) {
		console.log("Using configured API URL:", configuredApiUrl);
		return configuredApiUrl;
	}
	
	// Check for an Android-specific environment variable
	const androidApiUrl = process.env.EXPO_PUBLIC_ANDROID_API_URL;
	if (Platform.OS === 'android' && androidApiUrl) {
		console.log("Using Android-specific API URL:", androidApiUrl);
		return androidApiUrl;
	}
	
	// For web in development, use localhost with correct port
	if (Platform.OS === 'web') {
		return 'https://outscore-api.outscore.workers.dev';
	}
	
	// For iOS simulators in development, use localhost
	if (Platform.OS === 'ios') {
		return 'https://outscore-api.outscore.workers.dev';
	}
	
	// For Android devices/emulators:
	if (Platform.OS === 'android') {
		// For Expo Go on a physical device, you need to use your computer's actual IP on your local network
		// You'll need to replace this with your actual machine's IP address
		// Example: return 'http://192.168.1.100:3000';
		
		// You can find your IP address on Windows with 'ipconfig' or on Mac/Linux with 'ifconfig' or 'ip addr'
		return 'https://outscore-api.outscore.workers.dev';
		
		// For Android Emulator only (won't work with Expo Go on physical device):
		// return 'http://10.0.2.2:3000';
	}
	
	// Fallback
	return 'https://outscore-api.outscore.workers.dev'; 
};

export const getFixturesByDate = async (args: any) => {
	const baseUrl = getApiBaseUrl();
	const params = new URLSearchParams(args).toString();
	try {
	  console.log(`Fetching fixtures from: ${baseUrl}/fixtures?${params}`);
  
	  const response = await fetch(
		`${baseUrl}/fixtures?${params}`,
		{
		  headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		  },
		}
	  );
	  

	  if (!response.ok) {
		throw new Error(`API request failed with status ${response.status}`);
	  }
	  
	  const data = await response.json();
	  return data.data;
	} catch (error) {
	  console.error('Error fetching fixtures:', error);
	  throw error;
	}
  }