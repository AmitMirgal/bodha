import { parseDisplayName } from "./display-name";
import {
	GamificationMigrationRequiredError,
	isMissingGamificationSchema,
} from "./schema";

const CHECK_CONSTRAINT = /23514|check constraint/i;
const OPT_IN_REQUIRES_NAME = /opt_in_requires_name/i;
const FOREIGN_KEY = /foreign key/i;
const RLS_DENIED = /row-level security|42501|permission denied/i;

export class LeaderboardSettingsError extends Error {
	readonly status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = "LeaderboardSettingsError";
		this.status = status;
	}
}

export type LeaderboardSettingsParseResult =
	| { displayName: string | null; ok: true; optedIn: boolean }
	| { error: string; ok: false };

function prismaCode(error: unknown): string | undefined {
	if (error && typeof error === "object" && "code" in error) {
		const { code } = error;
		return typeof code === "string" ? code : undefined;
	}
	return undefined;
}

function errorText(error: unknown): string {
	if (error instanceof Error) {
		const meta =
			"meta" in error && error.meta && typeof error.meta === "object"
				? JSON.stringify(error.meta)
				: "";
		return `${error.message} ${meta}`;
	}
	return String(error);
}

export function parseLeaderboardSettingsBody(
	body: unknown
): LeaderboardSettingsParseResult {
	if (!body || typeof body !== "object") {
		return { error: "Invalid JSON.", ok: false };
	}
	const record = body as { displayName?: unknown; optedIn?: unknown };
	const optedIn = record.optedIn === true;
	if (optedIn) {
		const parsed = parseDisplayName(
			typeof record.displayName === "string" ? record.displayName : ""
		);
		if ("error" in parsed) {
			return { error: parsed.error, ok: false };
		}
		return { displayName: parsed.name, ok: true, optedIn: true };
	}
	if (
		typeof record.displayName !== "string" ||
		record.displayName.trim() === ""
	) {
		return { displayName: null, ok: true, optedIn: false };
	}
	const parsed = parseDisplayName(record.displayName);
	if ("error" in parsed) {
		return { displayName: null, ok: true, optedIn: false };
	}
	return { displayName: parsed.name, ok: true, optedIn: false };
}

export function leaderboardSettingsWriteError(error: unknown): {
	error: string;
	status: number;
} | null {
	if (error instanceof LeaderboardSettingsError) {
		return { error: error.message, status: error.status };
	}
	if (isMissingGamificationSchema(error)) {
		return {
			error: new GamificationMigrationRequiredError().message,
			status: 503,
		};
	}
	const code = prismaCode(error);
	const text = errorText(error);
	if (code === "P2004" || CHECK_CONSTRAINT.test(text)) {
		if (OPT_IN_REQUIRES_NAME.test(text)) {
			return {
				error:
					"Choose a display name between 3 and 24 characters before opting in.",
				status: 400,
			};
		}
		return {
			error:
				"Use letters, numbers, spaces, dots, hyphens, or underscores. No email addresses.",
			status: 400,
		};
	}
	if (code === "P2003" || FOREIGN_KEY.test(text)) {
		return {
			error:
				"Your account profile is not ready yet. Sign out and sign in again, then retry.",
			status: 409,
		};
	}
	if (RLS_DENIED.test(text)) {
		return {
			error:
				"Could not update leaderboard settings for this account. Sign out and sign in again, then retry.",
			status: 403,
		};
	}
	return null;
}
