const WIDTH_KEY = "bodha.ui.aiWidth";

export function loadAiWidth(): number {
	try {
		return Number(localStorage.getItem(WIDTH_KEY)) || 380;
	} catch {
		return 380;
	}
}

export function saveAiWidth(width: number) {
	try {
		localStorage.setItem(WIDTH_KEY, String(width));
	} catch {
		// Private mode: the round still works.
	}
}

export function assertNoLegacyKeyMigration() {
	// Intentionally does not read or write legacy browser trainer keys.
}
