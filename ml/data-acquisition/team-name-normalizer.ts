const STOP_WORDS = new Set([
	"fc",
	"cf",
	"sc",
	"afc",
	"ac",
	"ss",
	"cd",
	"ud",
	"de",
	"al",
	"the",
]);

const REPLACEMENTS: Array<[RegExp, string]> = [
	[/á|à|â|ã|ä/g, "a"],
	[/é|è|ê|ë/g, "e"],
	[/í|ì|î|ï/g, "i"],
	[/ó|ò|ô|õ|ö/g, "o"],
	[/ú|ù|û|ü/g, "u"],
	[/ç/g, "c"],
	[/ñ/g, "n"],
];

export const normalizeTeamName = (raw: string) => {
	let value = raw.trim().toLowerCase();
	REPLACEMENTS.forEach(([pattern, replacement]) => {
		value = value.replace(pattern, replacement);
	});
	value = value.replace(/[^a-z0-9\s]/g, " ");
	const parts = value.split(/\s+/).filter(Boolean);
	const filtered = parts.filter((part) => !STOP_WORDS.has(part));
	return filtered.join(" ").trim();
};
