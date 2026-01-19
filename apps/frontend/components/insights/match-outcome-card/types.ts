export type MatchOutcomeInsight = {
	text: string;
	parts?: Array<{ text: string; bold?: boolean }>;
	emoji?: string;
	category?: string;
	severity?: string;
};

export type MatchOutcomeProbabilityDistribution = {
	home?: number;
	draw?: number;
	away?: number;
};

export type MatchOutcomeCardProps = {
	homeTeam: string;
	awayTeam: string;
	probabilityDistribution: MatchOutcomeProbabilityDistribution;
	signalStrength?: string;
	modelReliability?: string;
	mostProbableOutcome?: string;
	insights?: MatchOutcomeInsight[];
};

