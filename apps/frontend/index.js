// Must be the first import (before React / navigation / screens).
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

function Root() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ExpoRoot context={require.context("./app")} />
		</GestureHandlerRootView>
	);
}

export default registerRootComponent(Root);

