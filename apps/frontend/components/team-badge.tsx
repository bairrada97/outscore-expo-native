import { Image, View } from "react-native";

import { Text } from "@/components/ui/text";

interface TeamBadgeProps {
	team: {
		id: number;
		name: string;
		logo: string;
	};
}

export function TeamBadge({ team }: TeamBadgeProps) {
	return (
		<View className="items-center gap-2">
			{/* Team logo container */}
			<View className="h-10 w-10 items-center justify-center rounded-full border-2 border-m-01-light-02 bg-neu-01 shadow-sha-01">
				{team.logo ? (
					<Image
						source={{ uri: team.logo }}
						className="h-8 w-8"
						resizeMode="contain"
					/>
				) : (
					<View className="h-8 w-8 rounded-full bg-neu-04" />
				)}
			</View>

			{/* Team name */}
			<Text
				variant="body-02--semi"
				className="text-center text-neu-01"
				numberOfLines={1}
			>
				{team.name}
			</Text>
		</View>
	);
}
