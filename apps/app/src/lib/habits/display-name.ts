const DISPLAY_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]$/;

export function normalizeDisplayName(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

export function parseDisplayName(
	value: unknown
): { name: string } | { error: string } {
	if (typeof value !== "string") {
		return { error: "Choose a display name between 3 and 24 characters." };
	}
	const name = normalizeDisplayName(value);
	if (name.length < 3 || name.length > 24) {
		return { error: "Display names must be 3 to 24 characters." };
	}
	if (name.includes("@") || !DISPLAY_NAME.test(name)) {
		return {
			error:
				"Use letters, numbers, spaces, dots, hyphens, or underscores. No email addresses.",
		};
	}
	return { name };
}
