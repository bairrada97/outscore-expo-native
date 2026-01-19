import { Text } from "@/components/ui/text";
import type { GoalInsight } from "./types";

export const normalizeLabel = (value?: string) => {
	if (!value) return "Balanced";
	return value.replace(/_/g, " ").toLowerCase();
};

export const titleCase = (value: string) =>
	value.replace(/\b\w/g, (char) => char.toUpperCase());

export const formatPercent = (value?: number) => {
	if (!Number.isFinite(value)) return "0.0%";
	return `${Number(value).toFixed(1)}%`;
};

export const isWatchOutInsight = (insight: GoalInsight) =>
	insight.category === "WARNING" || insight.severity === "CRITICAL";

export const renderInsightText = (insight: GoalInsight) => {
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

export function getGoalLineLabel(line?: number, isOver?: boolean): string {
	if (typeof line !== "number") return isOver ? "Favors Over" : "Favors Under";
	return isOver ? `Favors +${line} Goals` : `Favors -${line} Goals`;
}

