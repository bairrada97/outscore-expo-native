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
import SourceCodeProBlack from "../assets/fonts/SourceCodePro-Black.ttf";
import SourceCodeProBlackItalic from "../assets/fonts/SourceCodePro-BlackItalic.ttf";
import SourceCodeProBold from "../assets/fonts/SourceCodePro-Bold.ttf";
import SourceCodeProBoldItalic from "../assets/fonts/SourceCodePro-BoldItalic.ttf";
import SourceCodeProExtraBold from "../assets/fonts/SourceCodePro-ExtraBold.ttf";
import SourceCodeProExtraBoldItalic from "../assets/fonts/SourceCodePro-ExtraBoldItalic.ttf";
import SourceCodeProExtraLight from "../assets/fonts/SourceCodePro-ExtraLight.ttf";
import SourceCodeProExtraLightItalic from "../assets/fonts/SourceCodePro-ExtraLightItalic.ttf";
import SourceCodeProItalic from "../assets/fonts/SourceCodePro-Italic.ttf";
import SourceCodeProLight from "../assets/fonts/SourceCodePro-Light.ttf";
import SourceCodeProLightItalic from "../assets/fonts/SourceCodePro-LightItalic.ttf";
import SourceCodeProMedium from "../assets/fonts/SourceCodePro-Medium.ttf";
import SourceCodeProMediumItalic from "../assets/fonts/SourceCodePro-MediumItalic.ttf";
import SourceCodeProRegular from "../assets/fonts/SourceCodePro-Regular.ttf";
import SourceCodeProSemiBold from "../assets/fonts/SourceCodePro-SemiBold.ttf";
import SourceCodeProSemiBoldItalic from "../assets/fonts/SourceCodePro-SemiBoldItalic.ttf";

const isWeb = Platform.OS === "web";

// Keep splash screen visible until ready
SplashScreen.preventAutoHideAsync();

// Create query client and persister
const queryClient = createQueryClient();
const persister = createQueryPersister();
const persistOptions = createPersistOptions(persister);

export default function RootLayout() {
	const [fontsLoaded] = useFonts({
		"SourceCodePro-Black": SourceCodeProBlack,
		"SourceCodePro-BlackItalic": SourceCodeProBlackItalic,
		"SourceCodePro-Bold": SourceCodeProBold,
		"SourceCodePro-BoldItalic": SourceCodeProBoldItalic,
		"SourceCodePro-ExtraBold": SourceCodeProExtraBold,
		"SourceCodePro-ExtraBoldItalic": SourceCodeProExtraBoldItalic,
		"SourceCodePro-ExtraLight": SourceCodeProExtraLight,
		"SourceCodePro-ExtraLightItalic": SourceCodeProExtraLightItalic,
		"SourceCodePro-Italic": SourceCodeProItalic,
		"SourceCodePro-Light": SourceCodeProLight,
		"SourceCodePro-LightItalic": SourceCodeProLightItalic,
		"SourceCodePro-Medium": SourceCodeProMedium,
		"SourceCodePro-MediumItalic": SourceCodeProMediumItalic,
		"SourceCodePro-Regular": SourceCodeProRegular,
		"SourceCodePro-SemiBold": SourceCodeProSemiBold,
		"SourceCodePro-SemiBoldItalic": SourceCodeProSemiBoldItalic,
	});

	const [appIsReady, setAppIsReady] = useState(false);

	useEffect(() => {
		if (fontsLoaded) {
			setAppIsReady(true);
		}
	}, [fontsLoaded]);

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
			await SplashScreen.hideAsync();
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
