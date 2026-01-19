import { Text } from "@/components/ui/text";
import { View } from "react-native";
import type { MatchOutcomeProbabilityDistribution, MatchOutcomeInsight } from "./types";
import { getOutcomeEdgeLabel } from "./utils";
import { MatchOutcomeBadges } from "./match-outcome-badges";
import { MatchOutcomeProbabilities } from "./match-outcome-probabilities";
import { MatchOutcomeSignalsAccordion } from "./match-outcome-signals-accordion";

export type MatchOutcomeCardViewProps = {
	homeTeam: string;
	awayTeam: string;
	probabilityDistribution: MatchOutcomeProbabilityDistribution;
	strengthLabel: string;
	reliabilityLabel: string;
	insights: MatchOutcomeInsight[];
	homeValue: number;
	drawValue: number;
	awayValue: number;
	total: number;
	maxSide: number;
};

export function MatchOutcomeCardView({
	homeTeam,
	awayTeam,
	probabilityDistribution,
	strengthLabel,
	reliabilityLabel,
	insights,
	homeValue,
	drawValue,
	awayValue,
	total,
	maxSide,
}: MatchOutcomeCardViewProps) {
	return (
		<View className="shadow-sha-01 dark:shadow-sha-06 rounded-lg bg-neu-01 dark:bg-neu-11 p-16">
			<View className="flex-row items-center gap-8">
				<Text variant="caption-01" className="uppercase text-m-01 dark:text-m-01-light-04">
					Match Outcome
				</Text>
			</View>

			<View className="bg-neu-02 dark:bg-neu-12 px-16 py-16 gap-y-16 rounded-lg mt-8">
				<View className="gap-y-8">
					<Text variant="highlight-03" className="text-neu-10 dark:text-neu-01">
						{getOutcomeEdgeLabel(probabilityDistribution)}
					</Text>

					<MatchOutcomeBadges
						strengthLabel={strengthLabel}
						reliabilityLabel={reliabilityLabel}
					/>
				</View>

				<MatchOutcomeProbabilities
					homeValue={homeValue}
					drawValue={drawValue}
					awayValue={awayValue}
					total={total}
					maxSide={maxSide}
				/>

				<View className="h-px bg-neu-04/60 dark:bg-neu-10/60" />

				<MatchOutcomeSignalsAccordion insights={insights} />

				<View className="gap-y-4">
					<Text variant="caption-03" className="uppercase text-neu-07 dark:text-neu-06">
						{homeTeam} vs {awayTeam}
					</Text>
				</View>
			</View>
		</View>
	);
}

