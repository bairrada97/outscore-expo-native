import { Stack } from "expo-router";

export default function FixtureLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: true,
			}}
		>
			<Stack.Screen
				name="[id]"
				options={{
					title: "Fixture Details",
					headerBackTitle: "Back",
				}}
			/>
		</Stack>
	);
}
