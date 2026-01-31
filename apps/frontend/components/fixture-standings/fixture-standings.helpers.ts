import type { StandingsRowData } from "@/components/card-standings";

export type DescriptionColor = {
	description: string;
	colorClass: string;
};

/** Tailwind classes for promotion/qualification positions */
const PROMOTION_COLORS = ["bg-m-01", "bg-m-02-light-01", "bg-teal", "bg-cyan"] as const;

/** Tailwind classes for relegation positions */
const RELEGATION_COLORS = ["bg-orange", "bg-red", "bg-burgundy"] as const;

/**
 * Extract unique descriptions from standings and assign color classes
 */
export function buildDescriptionColors(
	standings: StandingsRowData[],
): DescriptionColor[] {
	const uniqueDescriptions = new Set<string>();

	for (const row of standings) {
		if (row.description) {
			uniqueDescriptions.add(row.description);
		}
	}

	let promotionIndex = 0;
	let relegationIndex = 0;

	const result: DescriptionColor[] = [];

	for (const description of uniqueDescriptions) {
		if (description.toLowerCase().includes("relegation")) {
			result.push({
				description,
				colorClass: RELEGATION_COLORS[relegationIndex % RELEGATION_COLORS.length],
			});
			relegationIndex++;
		} else {
			result.push({
				description,
				colorClass: PROMOTION_COLORS[promotionIndex % PROMOTION_COLORS.length],
			});
			promotionIndex++;
		}
	}

	return result;
}

/**
 * Get the color class for a specific description
 */
export function getColorClassForDescription(
	description: string | null,
	descriptionColors: DescriptionColor[],
): string | undefined {
	if (!description) return undefined;
	return descriptionColors.find((item) => item.description === description)
		?.colorClass;
}
