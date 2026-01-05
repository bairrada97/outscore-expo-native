/**
 * Convert timezone query parameter to valid timezone string
 */
export function queryToTimezone(timezone: string | null | undefined): string {
	if (!timezone) return "UTC";

	// Normalize common variations
	const normalized = timezone.trim().replace(/\s+/g, "_");

	// Common timezone mappings
	const timezoneMap: Record<string, string> = {
		"UTC": "UTC",
		"GMT": "UTC",
		"Europe/Lisbon": "Europe/Lisbon",
		"Europe/Amsterdam": "Europe/Amsterdam",
		"Europe/London": "Europe/London",
		"America/New_York": "America/New_York",
		// Add more as needed
	};

	return timezoneMap[normalized] || normalized;
}

