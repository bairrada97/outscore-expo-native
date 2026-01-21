export type MatchOutcomeCalibrationConfig = {
	temperature: number;
	updatedAt: string;
	source: string;
};

export const MATCH_OUTCOME_CALIBRATION: MatchOutcomeCalibrationConfig = {
	temperature: 1,
	updatedAt: "unfitted",
	source: "default",
};
