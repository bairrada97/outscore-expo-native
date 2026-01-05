import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { COLORS } from '@/utils/theme';

export default function TabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
          ...(Platform.OS === 'web' && { height: 48 }),
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerTitleAlign: 'left',
      }}
    />
  );
}

