// Must be the first import (before React / navigation / screens).
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "expo-router/entry";

function Root({ children }) {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			{children}
		</GestureHandlerRootView>
	);
}

export default Root;

