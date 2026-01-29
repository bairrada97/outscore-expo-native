const pad = (value: number) => String(value).padStart(2, "0");

export const parseDate = (value: string): Date | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
	if (isoDateOnly) {
		const [year, month, day] = trimmed.split("-").map(Number);
		const date = new Date(Date.UTC(year, month - 1, day));
		if (!Number.isNaN(date.getTime())) return date;
	} else {
		const direct = new Date(trimmed);
		if (!Number.isNaN(direct.getTime())) return direct;
	}

	const slashMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
	if (slashMatch) {
		const day = Number(slashMatch[1]);
		const month = Number(slashMatch[2]) - 1;
		let year = Number(slashMatch[3]);
		if (year < 100) year += year >= 70 ? 1900 : 2000;
		const date = new Date(Date.UTC(year, month, day));
		if (!Number.isNaN(date.getTime())) return date;
	}

	const yearFirst = trimmed.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
	if (yearFirst) {
		const year = Number(yearFirst[1]);
		const month = Number(yearFirst[2]) - 1;
		const day = Number(yearFirst[3]);
		const date = new Date(Date.UTC(year, month, day));
		if (!Number.isNaN(date.getTime())) return date;
	}

	return null;
};

export const toISODate = (date: Date) =>
	`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
		date.getUTCDate(),
	)}`;
