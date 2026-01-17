import type { Insight } from "../types";

export type InsightTextPart = { text: string; bold?: boolean };

// Bold numbers/ordinals/percentages like: 26, 2.8, -15, 47, 24.4%, 2nd, 1st, 3rd, 4th, 2+
const BOLD_TOKEN_RE =
	/(-?\d+(?:\.\d+)?%?|\b\d+(?:st|nd|rd|th)\b|\b\d\+\b)/g;

export function splitInsightTextParts(text: string): InsightTextPart[] | undefined {
	if (!text) return undefined;

	let lastIndex = 0;
	let match: RegExpExecArray | null = null;
	const parts: InsightTextPart[] = [];

	// Reset regex state (global)
	BOLD_TOKEN_RE.lastIndex = 0;

	while ((match = BOLD_TOKEN_RE.exec(text)) !== null) {
		const start = match.index;
		const end = start + match[0].length;

		if (start > lastIndex) {
			parts.push({ text: text.slice(lastIndex, start) });
		}

		parts.push({ text: match[0], bold: true });
		lastIndex = end;
	}

	if (lastIndex < text.length) {
		parts.push({ text: text.slice(lastIndex) });
	}

	// If we didn't actually split into multiple parts, don't send `parts`.
	return parts.length > 1 ? parts : undefined;
}

export function attachInsightParts(insight: Insight): Insight {
	if (insight.parts && insight.parts.length > 0) return insight;
	const parts = splitInsightTextParts(insight.text);
	return parts ? { ...insight, parts } : insight;
}

export function attachInsightPartsToList(insights: Insight[]): Insight[] {
	return insights.map(attachInsightParts);
}

