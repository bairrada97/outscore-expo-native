import { Text } from "@/components/ui/text";
import { Image } from "expo-image";
import { View } from "react-native";

interface TeamBadgeProps {
	team: {
		id: number;
		name: string;
		logo: string;
	};
}
const blurhash =
	"|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[";
export function TeamBadge({ team }: TeamBadgeProps) {
	return (
		<View className="items-center gap-y-8">
			{/* Team logo container */}
			<View className="relative flex h-40 w-40 items-center justify-center rounded-full border-2 border-m-01-light-02 bg-neu-01 shadow-sha-01">
				{team.logo ? (
					<Image
						source={{ uri: team.logo, cacheKey: `team-logo-${team.id}` }}
						cachePolicy="memory-disk"
						style={{ width: 28, height: 28 }}
						contentFit="contain"
						transition={0}
						placeholder={{ blurhash }}
					/>
				) : (
					<View className="h-[28px] w-[28px] rounded-full bg-neu-04" />
				)}
			</View>

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
