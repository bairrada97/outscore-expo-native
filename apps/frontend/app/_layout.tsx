import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { TimeZoneProvider } from '@/context/timezone-context';
import {
  createPersistOptions,
  createQueryClient,
  createQueryPersister,
} from '@/queries/query-client';

// Import global styles for Uniwind
import "../global.css";

// Keep splash screen visible until ready
SplashScreen.preventAutoHideAsync();

// Create query client and persister
const queryClient = createQueryClient();
const persister = createQueryPersister();
const persistOptions = createPersistOptions(persister);

export default function RootLayout() {
  useEffect(() => {
    // Setup focus management for React Query
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    });

    // Hide splash screen after initial setup
    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    
    hideSplash();

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <HeroUINativeProvider>
            <TimeZoneProvider>
              <StatusBar style="auto" />
              <Stack
                screenOptions={{
                  headerShown: false,
                }}
              />
            </TimeZoneProvider>
          </HeroUINativeProvider>
         </GestureHandlerRootView>
        </PersistQueryClientProvider>
  );
}
