import { readFileSync, writeFileSync } from "node:fs";

export type CsvRow = string[];

export const parseCsv = (text: string): CsvRow[] => {
	const rows: CsvRow[] = [];
	let current: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				const next = text[i + 1];
				if (next === '"') {
					field += '"';
					i += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}

		if (char === ",") {
			current.push(field);
			field = "";
			continue;
		}

		if (char === "\n") {
			current.push(field);
			field = "";
			if (current.length > 1 || current[0] !== "") {
				rows.push(current);
			}
			current = [];
			continue;
		}

		if (char === "\r") {
			continue;
		}

		field += char;
	}

	if (field.length > 0 || current.length > 0) {
		current.push(field);
		rows.push(current);
	}

	return rows;
};

export const readCsv = (path: string): CsvRow[] =>
	parseCsv(readFileSync(path, "utf-8"));

export const toRecords = (rows: CsvRow[]) => {
	const [headerRow, ...dataRows] = rows;
	if (!headerRow) return [];
	const headers = headerRow.map((cell) => cell.trim());
	return dataRows.map((row) => {
		const record: Record<string, string> = {};
		headers.forEach((header, idx) => {
			record[header] = row[idx] ?? "";
		});
		return record;
	});
};

const escapeCsvValue = (value: string | number | null | undefined) => {
	if (value === null || value === undefined) return "";
	const raw = String(value);
	if (raw.includes(",") || raw.includes("\n") || raw.includes('"')) {
		return `"${raw.replace(/"/g, '""')}"`;
	}
	return raw;
};

export const writeCsv = (path: string, rows: CsvRow[]) => {
	const payload = rows
		.map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
		.join("\n");
	writeFileSync(path, payload, "utf-8");
};
