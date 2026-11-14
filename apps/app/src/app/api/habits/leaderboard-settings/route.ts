import { NextResponse } from "next/server";
import { withUserDb } from "../../../../lib/db/client";
import {
	loadLeaderboardSettings,
	saveLeaderboardSettings,
} from "../../../../lib/habits/load";
import {
	GamificationMigrationRequiredError,
	isMissingGamificationSchema,
} from "../../../../lib/habits/schema";
import {
	leaderboardSettingsWriteError,
	parseLeaderboardSettingsBody,
} from "../../../../lib/habits/settings";
import { requireUser } from "../../../../lib/supabase/server";

function migrationResponse() {
	return NextResponse.json(
		{ error: new GamificationMigrationRequiredError().message },
		{ status: 503 }
	);
}

export async function GET() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		const settings = await withUserDb(userId, (db) =>
			loadLeaderboardSettings(db, userId)
		);
		return NextResponse.json(settings);
	} catch (error) {
		if (!isMissingGamificationSchema(error)) {
			throw error;
		}
		return migrationResponse();
	}
}

export async function PUT(request: Request) {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
	}
	const parsed = parseLeaderboardSettingsBody(body);
	if (!parsed.ok) {
		return NextResponse.json({ error: parsed.error }, { status: 400 });
	}
	try {
		const settings = await withUserDb(userId, (db) =>
			saveLeaderboardSettings(db, userId, {
				displayName: parsed.displayName,
				optedIn: parsed.optedIn,
			})
		);
		return NextResponse.json(settings);
	} catch (error) {
		const mapped = leaderboardSettingsWriteError(error);
		if (mapped) {
			return NextResponse.json(
				{ error: mapped.error },
				{ status: mapped.status }
			);
		}
		throw error;
	}
}
