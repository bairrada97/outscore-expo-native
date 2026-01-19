import { Text } from "@/components/ui/text";
import type {
	MatchOutcomeInsight,
	MatchOutcomeProbabilityDistribution,
} from "./types";

export const formatPercent = (value?: number) => {
	if (!Number.isFinite(value)) return "0.0%";
	return `${Number(value).toFixed(1)}%`;
};

export const normalizeLabel = (value?: string) => {
	if (!value) return "Balanced";
	return value.replace(/_/g, " ").toLowerCase();
};

export const titleCase = (value: string) =>
	value.replace(/\b\w/g, (char) => char.toUpperCase());

export const isWatchOutInsight = (insight: MatchOutcomeInsight) =>
	insight.category === "WARNING" || insight.severity === "CRITICAL";

export const renderInsightText = (insight: MatchOutcomeInsight) => {
	if (insight.parts && insight.parts.length > 0) {
		return insight.parts.map((part, idx) => (
			<Text
				key={`${idx}-${part.text}`}
				variant={part.bold ? "body-02--semi" : "body-02"}
				className="text-neu-10 dark:text-neu-01"
			>
				{part.text}
			</Text>
		));
	}
	return (
		<Text variant="body-02" className="text-neu-10 dark:text-neu-01">
			{insight.text}
		</Text>
	);
};

export function getOutcomeEdgeLabel(
	probabilityDistribution: MatchOutcomeProbabilityDistribution,
) {
	const home = probabilityDistribution.home ?? 0;
	const draw = probabilityDistribution.draw ?? 0;
	const away = probabilityDistribution.away ?? 0;
	const ordered = [
		{ key: "home", value: home },
		{ key: "draw", value: draw },
		{ key: "away", value: away },
	].sort((a, b) => b.value - a.value);

	const top = ordered[0];
	const second = ordered[1];
	const min = ordered[2];
	const pick =
		top.key === "home"
			? "Favors Home Side"
			: top.key === "away"
				? "Favors Away Side"
				: "Favors Draw";

	const SLIGHT_LEAN_MARGIN_PCT = 5;
	if (top.value - min.value <= SLIGHT_LEAN_MARGIN_PCT) {
		return "Balanced outlook";
	}
	if (top.value - second.value <= SLIGHT_LEAN_MARGIN_PCT) {
		return `Slight lean: ${pick}`;
	}
	return pick;
}

