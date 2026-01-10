import SvgB009 from "@/components/ui/SvgIcons/B009";
import { isWeb } from "@/utils/platform";
import { Stack, useRouter } from "expo-router";
import { Platform, TouchableOpacity } from "react-native";

export default function FixtureLayout() {
	const router = useRouter();

	return (
		<Stack
			screenOptions={{
				headerShown: true,
				presentation: "pageSheet",
				headerStyle: {
					backgroundColor: "rgb(24 124 86)",
					...(isWeb && { height: 48 }),
				},
				headerTintColor: "#fff",
				headerTitleStyle: {
					fontWeight: "semibold",
					fontFamily: "SourceSans3-SemiBold",
				},
				title: "FIXTURE DETAILS",

				headerLeft: () => (
					<TouchableOpacity
						onPress={() => router.push("/")}
						style={{
							marginLeft: Platform.OS === "ios" ? 0 : 16,
							marginRight: 16,
							justifyContent: "center",
							alignItems: "center",
						}}
					>
						<SvgB009 width={24} height={24} color="#fff" />
					</TouchableOpacity>
				),
			}}
		/>
	);
}
