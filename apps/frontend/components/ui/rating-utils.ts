export type RatingColor = "green" | "orange" | "red";

export function getRatingColor(rating: number): RatingColor {
	if (rating >= 7.0) return "green";
	if (rating < 6.0) return "red";
	return "orange";
}

export const ratingBgClasses: Record<RatingColor, string> = {
	green: "bg-light-green",
	orange: "bg-orange",
	red: "bg-red",
};
