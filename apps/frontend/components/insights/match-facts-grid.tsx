import { View } from "react-native";
import { type MatchFact, MatchFactCard } from "./match-fact-card";

type MatchFactsGridProps = {
	facts: MatchFact[];
};

export function MatchFactsGrid({ facts }: MatchFactsGridProps) {
	return (
		<View className="flex-row flex-wrap -mx-4">
			{facts.map((fact) => (
				<View
					key={fact.id}
					className="min-w-0 w-1/2 xs:w-1/3 px-4 mb-8"
				>
					<MatchFactCard fact={fact} />
				</View>
			))}
		</View>
	);
}
