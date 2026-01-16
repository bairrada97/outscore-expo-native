import { View } from "react-native";
import { type MatchFact, MatchFactCard } from "./match-fact-card";

type MatchFactsGridProps = {
	facts: MatchFact[];
};

export function MatchFactsGrid({ facts }: MatchFactsGridProps) {
	return (
		<View className="flex-row flex-wrap gap-8">
			{facts.map((fact) => (
				<View
					key={fact.id}
					className="flex-1 min-w-0 basis-[calc((100%-16px)/2)] xs:basis-[calc((100%-16px)/3)]"
				>
					<MatchFactCard fact={fact} />
				</View>
			))}
		</View>
	);
}
