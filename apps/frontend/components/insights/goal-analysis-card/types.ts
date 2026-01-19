export type GoalInsight = {
	text: string;
	parts?: Array<{ text: string; bold?: boolean }>;
	emoji?: string;
	category?: string;
	severity?: string;
};

export type ProbabilityDistribution = {
	over?: number;
	under?: number;
	yes?: number;
	no?: number;
};

export type GoalSimulation = {
	scenarioType: string;
	line?: number;
	probabilityDistribution?: ProbabilityDistribution;
	signalStrength?: string;
	modelReliability?: string;
	mostProbableOutcome?: string;
	insights?: GoalInsight[];
};

export type GoalAnalysisCardProps = {
	overUnderSimulations: GoalSimulation[];
	bttsSimulation?: GoalSimulation | null;
};

