import { DateTabs } from "@/components/date-tabs";
import { isWeb } from "@/utils/platform";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
	return (
		<SafeAreaView
			className={isWeb ? "bg-neu-02" : "flex-1 bg-neu-02"}
			edges={["top"]}
		>
			<View className={isWeb ? "" : "flex-1"}>
				<DateTabs />
			</View>
		</SafeAreaView>
	);
}
