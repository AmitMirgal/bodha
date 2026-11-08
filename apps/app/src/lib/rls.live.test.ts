import { beforeAll, describe, expect, it } from "vitest";
import {
	AUTH_STUB,
	asUser,
	CREATE_ROLES,
	EVIDENCE_A,
	FORCE_RLS,
	GRANT_SEQUENCES,
	migrationSql,
	SESSION_A,
	SESSION_B,
	SNAP_A,
	USER_A,
	USER_B,
} from "./rls/harness";

type Queryable = {
	exec: (sql: string) => Promise<unknown>;
	query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

const liveMissing = [
	process.env.BODHA_LIVE_SUPABASE_URL ? null : "BODHA_LIVE_SUPABASE_URL",
	process.env.BODHA_LIVE_SUPABASE_PUBLISHABLE_KEY ||
	process.env.BODHA_LIVE_SUPABASE_ANON_KEY
		? null
		: "BODHA_LIVE_SUPABASE_PUBLISHABLE_KEY",
	process.env.BODHA_LIVE_USER_A_ACCESS_TOKEN
		? null
		: "BODHA_LIVE_USER_A_ACCESS_TOKEN",
	process.env.BODHA_LIVE_USER_B_ACCESS_TOKEN
		? null
		: "BODHA_LIVE_USER_B_ACCESS_TOKEN",
].filter((value): value is string => value !== null);
const hasLive = liveMissing.length === 0;

let pglite: Queryable | null = null;
let pgliteSkip = "PGlite not initialized";

async function tryPglite(): Promise<Queryable | null> {
	try {
		const mod = await import("@electric-sql/pglite");
		const db = new mod.PGlite();
		await db.exec(AUTH_STUB);
		await db.exec(CREATE_ROLES);
		await db.exec(migrationSql());
		await db.exec(FORCE_RLS);
		await db.exec(GRANT_SEQUENCES);
		await db.exec(`
      insert into auth.users (id, email) values ('${USER_A}', 'a@example.com'), ('${USER_B}', 'b@example.com');
      insert into public.profiles (id) values ('${USER_A}'), ('${USER_B}');
    `);
		await db.exec("set role authenticated");
		await db.exec(asUser(USER_A));
		await db.exec(`
      insert into public.sessions (id, user_id, exercise_id, status)
      values ('${SESSION_A}', '${USER_A}', 'shelf', 'running');
      insert into public.exercise_snapshots (
        id, session_id, user_id, exercise_id, content_hash, spec_markdown, tests_source, starter, meta
      ) values (
        '${SNAP_A}', '${SESSION_A}', '${USER_A}', 'shelf', 'sha256:x', 'spec', 'tests', '{}'::jsonb, '{}'::jsonb
      );
      insert into public.evidence_events (
        id, session_id, user_id, kind, source, observation_type, payload, idempotency_key
      ) values (
        '${EVIDENCE_A}', '${SESSION_A}', '${USER_A}', 'prompt', 'learner', 'trainer_prompt', '{"content":"hi"}'::jsonb, 'k1'
      );
    `);
		return db;
	} catch (error) {
		pgliteSkip = error instanceof Error ? error.message : String(error);
		return null;
	}
}

beforeAll(async () => {
	pglite = await tryPglite();
});

describe("local Postgres RLS (PGlite)", () => {
	it("records why local Postgres is unavailable when skipped", () => {
		if (!pglite) {
			expect.fail(`PGlite RLS harness unavailable: ${pgliteSkip}`);
		}
		expect(pglite).toBeTruthy();
	});

	it("denies anon reads of product tables", async ({ skip }) => {
		if (!pglite) {
			skip(pgliteSkip);
			return;
		}
		await pglite.exec("set role anon");
		await expect(
			pglite.query("select * from public.sessions"),
		).rejects.toThrow();
		await pglite.exec("set role authenticated");
	});

	it("keeps sessions owner-scoped across two users", async ({ skip }) => {
		if (!pglite) {
			skip(pgliteSkip);
			return;
		}
		await pglite.exec("set role authenticated");
		await pglite.exec(asUser(USER_B));
		const visible = await pglite.query<{ id: string }>(
			"select id from public.sessions",
		);
		expect(visible.rows).toEqual([]);
		await expect(
			pglite.query(
				`insert into public.sessions (id, user_id, exercise_id, status)
         values ('${SESSION_B}', '${USER_A}', 'cache', 'running')`,
			),
		).rejects.toThrow();
	});

	it("rejects forged snapshot and evidence owner links", async ({ skip }) => {
		if (!pglite) {
			skip(pgliteSkip);
			return;
		}
		await pglite.exec("set role authenticated");
		await pglite.exec(asUser(USER_B));
		await pglite.query(
			`insert into public.sessions (id, user_id, exercise_id, status)
       values ('${SESSION_B}', '${USER_B}', 'cache', 'running')`,
		);
		await expect(
			pglite.query(
				`insert into public.exercise_snapshots (
          session_id, user_id, exercise_id, content_hash, spec_markdown, tests_source, starter, meta
        ) values (
          '${SESSION_A}', '${USER_B}', 'cache', 'sha256:y', 'spec', 'tests', '{}'::jsonb, '{}'::jsonb
        )`,
			),
		).rejects.toThrow();
		await expect(
			pglite.query(
				`insert into public.messages (session_id, user_id, evidence_id, role, content)
         values ('${SESSION_B}', '${USER_B}', '${EVIDENCE_A}', 'user', 'forged')`,
			),
		).rejects.toThrow();
	});

	it("refuses UPDATE on immutable evidence (no grant, first-write-wins insert)", async ({
		skip,
	}) => {
		if (!pglite) {
			skip(pgliteSkip);
			return;
		}
		await pglite.exec("set role authenticated");
		await pglite.exec(asUser(USER_A));
		await expect(
			pglite.query(
				`update public.evidence_events set payload = '{"mutated":true}'::jsonb where id = '${EVIDENCE_A}'`,
			),
		).rejects.toThrow();
		await expect(
			pglite.query(
				`insert into public.evidence_events (
          session_id, user_id, kind, source, observation_type, payload, idempotency_key
        ) values (
          '${SESSION_A}', '${USER_A}', 'prompt', 'learner', 'trainer_prompt', '{"second":true}'::jsonb, 'k1'
        )
        on conflict (session_id, idempotency_key) do update set payload = excluded.payload`,
			),
		).rejects.toThrow();
		const existing = await pglite.query<{ payload: { content?: string } }>(
			`select payload from public.evidence_events where id = '${EVIDENCE_A}'`,
		);
		expect(existing.rows[0]?.payload).toEqual({ content: "hi" });
	});

	it("keeps remaining product tables owner-scoped", async ({ skip }) => {
		if (!pglite) {
			skip(pgliteSkip);
			return;
		}
		await pglite.exec("set role authenticated");
		await pglite.exec(asUser(USER_A));
		await pglite.query(
			`insert into public.messages (session_id, user_id, evidence_id, role, content)
       values ('${SESSION_A}', '${USER_A}', '${EVIDENCE_A}', 'user', 'hi')`,
		);
		await pglite.query(
			`insert into public.test_runs (
          session_id, user_id, snapshot_id, code_revision_hash, results, provenance
        ) values (
          '${SESSION_A}', '${USER_A}', '${SNAP_A}', 'sha256:code', '[]'::jsonb, 'browser_harness'
        )`,
		);
		await pglite.query(
			`insert into public.reports (session_id, user_id, snapshot_id, version, status)
       values ('${SESSION_A}', '${USER_A}', '${SNAP_A}', 1, 'running')`,
		);
		await pglite.query(
			`insert into public.usage_records (
          session_id, user_id, operation_id, agent_role, coverage
        ) values (
          '${SESSION_A}', '${USER_A}', 'op-1', 'trainer', 'unknown'
        )`,
		);
		await pglite.query(
			`insert into public.llm_settings (
          user_id, provider, model, base_url, encrypted_api_key, encryption_iv, encryption_tag, key_fingerprint
        ) values (
          '${USER_A}', 'openai', 'gpt-4.1', 'https://api.openai.com/v1', 'cipher', 'iv', 'tag', 'fp'
        )`,
		);
		await pglite.exec(asUser(USER_B));
		await expect(
			pglite.query("select * from public.messages"),
		).resolves.toMatchObject({ rows: [] });
		await expect(
			pglite.query("select * from public.test_runs"),
		).resolves.toMatchObject({ rows: [] });
		await expect(
			pglite.query("select * from public.reports"),
		).resolves.toMatchObject({ rows: [] });
		await expect(
			pglite.query("select * from public.usage_records"),
		).resolves.toMatchObject({ rows: [] });
		await expect(
			pglite.query("select * from public.llm_settings"),
		).resolves.toMatchObject({ rows: [] });
		await expect(
			pglite.query(
				`insert into public.llm_settings (
          user_id, provider, model, base_url, encrypted_api_key, encryption_iv, encryption_tag, key_fingerprint
        ) values (
          '${USER_A}', 'openai', 'gpt-4.1', 'https://api.openai.com/v1', 'cipher', 'iv', 'tag', 'fp'
        )`,
			),
		).rejects.toThrow();
	});
});

describe.skipIf(!hasLive)(
	"live isolated Supabase RLS (requires BODHA_LIVE_* user tokens; service role is unused)",
	() => {
		async function client(accessToken: string) {
			const { createClient } = await import("@supabase/supabase-js");
			return createClient(
				process.env.BODHA_LIVE_SUPABASE_URL ?? "",
				process.env.BODHA_LIVE_SUPABASE_PUBLISHABLE_KEY ??
					process.env.BODHA_LIVE_SUPABASE_ANON_KEY ??
					"",
				{ global: { headers: { Authorization: `Bearer ${accessToken}` } } },
			);
		}

		async function requireUserId(
			accessClient: Awaited<ReturnType<typeof client>>,
		) {
			const { data, error } = await accessClient.auth.getUser();
			if (error || !data.user) {
				throw new Error("Live access token did not resolve to a user.");
			}
			return data.user.id;
		}

		it("hides user A's session from user B, anon, and forged owner inserts", async () => {
			const userA = await client(
				process.env.BODHA_LIVE_USER_A_ACCESS_TOKEN ?? "",
			);
			const userB = await client(
				process.env.BODHA_LIVE_USER_B_ACCESS_TOKEN ?? "",
			);
			const userAId = await requireUserId(userA);
			const created = await userA
				.from("sessions")
				.insert({
					user_id: userAId,
					exercise_id: "shelf",
					status: "running",
				})
				.select("id, user_id")
				.single();
			expect(created.error).toBeNull();
			const sessionId = created.data?.id;
			const other = await userB
				.from("sessions")
				.select("id")
				.eq("id", sessionId ?? "");
			expect(other.data ?? []).toEqual([]);
			const forged = await userB.from("sessions").insert({
				id: sessionId,
				user_id: created.data?.user_id,
				exercise_id: "cache",
				status: "running",
			});
			expect(forged.error).toBeTruthy();
			const anon = await import("@supabase/supabase-js").then(
				({ createClient }) =>
					createClient(
						process.env.BODHA_LIVE_SUPABASE_URL ?? "",
						process.env.BODHA_LIVE_SUPABASE_PUBLISHABLE_KEY ??
							process.env.BODHA_LIVE_SUPABASE_ANON_KEY ??
							"",
					),
			);
			const anonRead = await anon.from("sessions").select("id");
			expect(anonRead.data ?? []).toEqual([]);
			expect(anonRead.error).toBeTruthy();
		});

		it("rejects cross-session evidence citations and evidence updates", async () => {
			const userA = await client(
				process.env.BODHA_LIVE_USER_A_ACCESS_TOKEN ?? "",
			);
			const userB = await client(
				process.env.BODHA_LIVE_USER_B_ACCESS_TOKEN ?? "",
			);
			const userAId = await requireUserId(userA);
			const userBId = await requireUserId(userB);
			const sessionA = await userA
				.from("sessions")
				.insert({
					user_id: userAId,
					exercise_id: "shelf",
					status: "running",
				})
				.select("id")
				.single();
			const sessionB = await userB
				.from("sessions")
				.insert({
					user_id: userBId,
					exercise_id: "cache",
					status: "running",
				})
				.select("id")
				.single();
			const evidence = await userA
				.from("evidence_events")
				.insert({
					session_id: sessionA.data?.id,
					user_id: userAId,
					kind: "prompt",
					source: "learner",
					observation_type: "trainer_prompt",
					payload: { content: "hi" },
					idempotency_key: `live-${crypto.randomUUID()}`,
				})
				.select("id")
				.single();
			expect(evidence.error).toBeNull();
			const forgedMessage = await userB.from("messages").insert({
				session_id: sessionB.data?.id,
				user_id: userBId,
				evidence_id: evidence.data?.id,
				role: "user",
				content: "forged",
			});
			expect(forgedMessage.error).toBeTruthy();
			const mutated = await userA
				.from("evidence_events")
				.update({ payload: { mutated: true } })
				.eq("id", evidence.data?.id ?? "");
			expect(mutated.error).toBeTruthy();
		});
	},
);

describe("RLS harness limits", () => {
	it("documents that PGlite is not Supabase PostgREST and live tests are skipped without user tokens", () => {
		expect(hasLive || liveMissing.length > 0).toBe(true);
		if (!hasLive) {
			expect(liveMissing.join(",")).not.toMatch(/SERVICE_ROLE/);
		}
	});
});
