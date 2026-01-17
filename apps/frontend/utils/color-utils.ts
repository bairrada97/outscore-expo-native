export function toHexColor(raw?: string | null): string | undefined {
	const clean = (raw ?? "").replace("#", "").trim();
	return /^[0-9a-fA-F]{6}$/.test(clean) ? `#${clean}` : undefined;
}

