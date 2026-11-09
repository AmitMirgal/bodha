const LOCAL_PART_SPLIT = /[._+-]/;
const NON_ALNUM = /[^A-Za-z0-9]/g;

export function emailInitials(email: string): string {
	const local = email.split("@")[0]?.trim() ?? "";
	const parts = local.split(LOCAL_PART_SPLIT).filter((part) => part.length > 0);
	if (parts.length >= 2) {
		const first = parts[0]?.[0];
		const second = parts[1]?.[0];
		if (first && second) {
			return `${first}${second}`.toUpperCase();
		}
	}
	const letters = local.replace(NON_ALNUM, "");
	if (letters.length >= 2) {
		return letters.slice(0, 2).toUpperCase();
	}
	if (letters.length === 1) {
		return letters.toUpperCase();
	}
	return "?";
}
