import { DateTabs } from "@/components/date-tabs/date-tabs";
import { isWeb } from "@/utils/platform";
import { Stack } from "expo-router";
import { View } from "react-native";

export default function HomeScreen() {
	return (
		<>
			<Stack.Screen
				options={{
					title: "Football Matches",
				}}
			/>
			<View className={isWeb ? "bg-neu-02" : "flex-1 bg-neu-02"}>
				<DateTabs />
			</View>
		</>
	);
}
