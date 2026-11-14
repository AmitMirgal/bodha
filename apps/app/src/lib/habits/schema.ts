import type { MatiDb } from "../db/rls";
import {
	GAMIFICATION_MIGRATE_COMMAND,
	GAMIFICATION_MIGRATION_MESSAGE,
} from "./copy";
import type { LeaderboardView } from "./types";
import { LEADERBOARD_TOP_N } from "./types";
import { utcMonday } from "./week";

export {
	GAMIFICATION_MIGRATE_COMMAND,
	GAMIFICATION_MIGRATION_MESSAGE,
} from "./copy";

export class GamificationMigrationRequiredError extends Error {
	constructor() {
		super(
			`${GAMIFICATION_MIGRATION_MESSAGE} An operator must run \`${GAMIFICATION_MIGRATE_COMMAND}\`. Do not prisma db push.`
		);
		this.name = "GamificationMigrationRequiredError";
	}
}

export interface GamificationSchemaState {
	functionReady: boolean;
	tablesReady: boolean;
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

function prismaCode(error: unknown): string | undefined {
	if (error && typeof error === "object" && "code" in error) {
		const { code } = error;
		return typeof code === "string" ? code : undefined;
	}
	return undefined;
}

const GAMIFICATION_NAMES =
	/mati_leaderboard_week|leaderboard_profiles|habit_awards|capture_report_opens/i;
const MISSING =
	/does not exist|undefined_(table|function)|relation .* does not exist/i;

export function isMissingGamificationSchema(error: unknown): boolean {
	if (error instanceof GamificationMigrationRequiredError) {
		return true;
	}
	const code = prismaCode(error);
	const text = errorText(error);
	if (!GAMIFICATION_NAMES.test(text)) {
		return false;
	}
	return (
		code === "P2021" ||
		code === "42883" ||
		code === "42P01" ||
		MISSING.test(text)
	);
}

export async function readGamificationSchema(
	db: MatiDb
): Promise<GamificationSchemaState> {
	const rows = await db.$queryRaw<
		Array<{ fn: boolean | string; tables: boolean | string }>
	>`
    SELECT
      to_regprocedure('public.mati_leaderboard_week(date, integer)') IS NOT NULL AS fn,
      (
        to_regclass('public.leaderboard_profiles') IS NOT NULL
        AND to_regclass('public.habit_awards') IS NOT NULL
        AND to_regclass('public.capture_report_opens') IS NOT NULL
      ) AS tables`;
	const row = rows[0];
	return {
		functionReady: row?.fn === true || row?.fn === "t",
		tablesReady: row?.tables === true || row?.tables === "t",
	};
}

export function unavailableLeaderboardView(
	now: string = new Date().toISOString()
): LeaderboardView {
	return {
		exampleData: false,
		migrationRequired: true,
		optedIn: false,
		rows: [],
		self: null,
		topN: LEADERBOARD_TOP_N,
		weekStartsAt: utcMonday(now),
	};
}
