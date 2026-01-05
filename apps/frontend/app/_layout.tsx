import { focusManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { TimeZoneProvider } from "@/context/timezone-context";
import {
	createPersistOptions,
	createQueryClient,
	createQueryPersister,
} from "@/queries/query-client";

// Import global styles for Uniwind
import "../global.css";

// Import fonts

import { isWeb } from "@/utils/platform";
import SourceSans3Bold from "../assets/fonts/SourceSans3-Bold.ttf";
// Import SourceSans3 fonts
import SourceSans3Regular from "../assets/fonts/SourceSans3-Regular.ttf";
import SourceSans3SemiBold from "../assets/fonts/SourceSans3-SemiBold.ttf";

// Keep splash screen visible until ready
SplashScreen.preventAutoHideAsync();

// Create query client and persister
const queryClient = createQueryClient();
const persister = createQueryPersister();
const persistOptions = createPersistOptions(persister);

export default function RootLayout() {
	// Load fonts on all platforms to prevent layout shifts
	// Fonts are preloaded in +html.tsx and use font-display: block to prevent shifts
	const [fontsLoaded, fontError] = useFonts({
		"SourceSans3-Regular": SourceSans3Regular,
		"SourceSans3-SemiBold": SourceSans3SemiBold,
		"SourceSans3-Bold": SourceSans3Bold,
	});

	const [appIsReady, setAppIsReady] = useState(false);

	useEffect(() => {
		// Set app as ready if fonts loaded OR if there's an error (don't block on font errors)
		if (fontsLoaded || fontError) {
			setAppIsReady(true);
		}
	}, [fontsLoaded, fontError]);

	// Fallback timeout: hide splash screen after 1.5s (web) or 3s (native) if fonts haven't loaded
	// Reduced timeout on web since fonts are preloaded and should load faster
	useEffect(() => {
		const timeout = setTimeout(
			() => {
				if (!appIsReady) {
					console.warn("Font loading timeout - proceeding without fonts");
					setAppIsReady(true);
				}
			},
			isWeb ? 1500 : 3000,
		);

		return () => clearTimeout(timeout);
	}, [appIsReady, isWeb]);

	// Safety: Force hide splash screen after app is ready, even if onLayoutRootView doesn't fire
	useEffect(() => {
		if (appIsReady) {
			const timeout = setTimeout(async () => {
				try {
					await SplashScreen.hideAsync();
				} catch (error) {
					console.warn("Error hiding splash screen in timeout:", error);
				}
			}, 500); // Small delay to allow layout to complete

			return () => clearTimeout(timeout);
		}
	}, [appIsReady]);

	useEffect(() => {
		// Setup focus management for React Query
		const subscription = AppState.addEventListener(
			"change",
			(status: AppStateStatus) => {
				if (Platform.OS !== "web") {
					focusManager.setFocused(status === "active");
				}
			},
		);

		return () => {
			subscription.remove();
		};
	}, []);

	const onLayoutRootView = useCallback(async () => {
		if (appIsReady) {
			// Hide splash screen once layout is ready
			try {
				await SplashScreen.hideAsync();
			} catch (error) {
				console.warn("Error hiding splash screen:", error);
				// Continue anyway - don't block the app
			}
		}
	}, [appIsReady]);

	// Don't render until fonts are loaded
	if (!appIsReady) {
		return null;
	}

	return (
		<PersistQueryClientProvider
			client={queryClient}
			persistOptions={persistOptions}
		>
			<GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
				<TimeZoneProvider>
					<StatusBar style="auto" />
					<View
						style={{
							flex: 1,
							width: "100%",
							maxWidth: isWeb ? 800 : undefined,
							alignSelf: "center",
						}}
					>
						<Stack
							screenOptions={{
								headerShown: false,
							}}
						/>
					</View>
				</TimeZoneProvider>
			</GestureHandlerRootView>
		</PersistQueryClientProvider>
	);
}
