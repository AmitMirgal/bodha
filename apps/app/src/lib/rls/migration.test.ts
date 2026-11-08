import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	new URL(
		"../../../../../supabase/migrations/20251108120000_bodha_mvp.sql",
		import.meta.url,
	),
	"utf8",
);

describe("BODHA migration source constraints", () => {
	it("does not revoke anon on unrelated public tables", () => {
		expect(migration).not.toMatch(
			/revoke all on all tables in schema public from anon/i,
		);
	});

	it("qualifies test_runs and reports snapshot session checks", () => {
		expect(migration).toMatch(/snap\.session_id = test_runs\.session_id/);
		expect(migration).toMatch(/snap\.session_id = reports\.session_id/);
	});

	it("links messages and test evidence to the same session", () => {
		expect(migration).toMatch(
			/foreign key \(evidence_id, session_id\) references public\.evidence_events \(id, session_id\)/,
		);
		expect(migration).toMatch(
			/foreign key \(snapshot_id, session_id\) references public\.exercise_snapshots \(id, session_id\)/,
		);
	});

	it("grants insert-only on immutable evidence and snapshots", () => {
		expect(migration).toMatch(
			/grant select, insert on public\.evidence_events to authenticated/,
		);
		expect(migration).not.toMatch(
			/grant select, insert, update on public\.evidence_events/i,
		);
		expect(migration).toMatch(
			/grant select, insert on public\.exercise_snapshots to authenticated/,
		);
		expect(migration).toMatch(
			/ON CONFLICT DO UPDATE is not granted and must not be used/,
		);
	});
});
