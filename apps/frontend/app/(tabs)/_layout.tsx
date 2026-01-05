import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#187C56',
          ...(Platform.OS === 'web' && { height: 48 }),
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerTitleAlign: 'left',
      }}
    />
  );
}

