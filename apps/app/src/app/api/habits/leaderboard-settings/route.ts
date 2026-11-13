import { NextResponse } from "next/server";
import { withUserDb } from "../../../../lib/db/client";
import { parseDisplayName } from "../../../../lib/habits/display-name";
import {
	loadLeaderboardSettings,
	saveLeaderboardSettings,
} from "../../../../lib/habits/load";
import {
	GamificationMigrationRequiredError,
	isMissingGamificationSchema,
} from "../../../../lib/habits/schema";
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
	if (!body || typeof body !== "object") {
		return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
	}
	const record = body as { displayName?: unknown; optedIn?: unknown };
	const optedIn = record.optedIn === true;
	let displayName: string | null = null;
	if (optedIn || typeof record.displayName === "string") {
		const parsed = parseDisplayName(
			typeof record.displayName === "string" ? record.displayName : ""
		);
		if ("error" in parsed) {
			if (optedIn) {
				return NextResponse.json({ error: parsed.error }, { status: 400 });
			}
			displayName = null;
		} else {
			displayName = parsed.name;
		}
	}
	try {
		const settings = await withUserDb(userId, (db) =>
			saveLeaderboardSettings(db, userId, { displayName, optedIn })
		);
		return NextResponse.json(settings);
	} catch (error) {
		if (!isMissingGamificationSchema(error)) {
			throw error;
		}
		return migrationResponse();
	}
}
