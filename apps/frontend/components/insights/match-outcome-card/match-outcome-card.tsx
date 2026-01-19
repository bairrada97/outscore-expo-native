import type { MatchOutcomeCardProps } from "./types";
import { normalizeLabel, titleCase } from "./utils";
import { MatchOutcomeCardView } from "./match-outcome-card-view";

export function MatchOutcomeCard({
	homeTeam,
	awayTeam,
	probabilityDistribution,
	signalStrength,
	modelReliability,
	insights = [],
}: MatchOutcomeCardProps) {
	const homeValue = probabilityDistribution.home ?? 0;
	const drawValue = probabilityDistribution.draw ?? 0;
	const awayValue = probabilityDistribution.away ?? 0;
	const total = homeValue + drawValue + awayValue || 1;
	const maxSide = Math.max(homeValue, drawValue, awayValue);

	const strengthLabel = titleCase(normalizeLabel(signalStrength));
	const reliabilityLabel = titleCase(normalizeLabel(modelReliability));

	return (
		<MatchOutcomeCardView
			homeTeam={homeTeam}
			awayTeam={awayTeam}
			probabilityDistribution={probabilityDistribution}
			strengthLabel={strengthLabel}
			reliabilityLabel={reliabilityLabel}
			insights={insights}
			homeValue={homeValue}
			drawValue={drawValue}
			awayValue={awayValue}
			total={total}
			maxSide={maxSide}
		/>
	);
}

