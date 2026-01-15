import SvgB009 from "@/components/ui/SvgIcons/B009";
import { Text } from "@/components/ui/text";
import { Stack, useRouter } from "expo-router";
import { TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FixtureLayout() {
	const router = useRouter();

	return (
		<Stack
			screenOptions={{
				headerShown: true,
				presentation: "card",
				animation: "slide_from_right",
				title: "MATCH INFO",
				header: () => (
					<SafeAreaView
						edges={["top"]}
						className="bg-m-01"
						style={{ backgroundColor: "rgb(24 124 86)" }}
					>
						<View className="h-48 bg-m-01 px-16 flex-row items-center">
							<View className="flex-row items-center gap-x-16 flex-1">
								<TouchableOpacity
									onPress={() => router.push("/")}
									className="items-center justify-center"
								>
									<SvgB009 width={24} height={24} color="#fff" />
								</TouchableOpacity>
								<Text variant="title-01" className="text-neu-01">
									MATCH INFO
								</Text>
								<View className="flex-1" />
							</View>
						</View>
					</SafeAreaView>
				),
			}}
		/>
	);
}
