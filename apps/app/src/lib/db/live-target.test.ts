import { describe, expect, it } from "vitest";
import {
	inspectLivePrismaTarget,
	LIVE_PRISMA_SKIPPED_REASON,
	type LivePrismaTargetEnv,
} from "./live-target";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ISOLATED_URL =
	"postgresql://postgres.abcd1234:encoded@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

function env(overrides: LivePrismaTargetEnv = {}): LivePrismaTargetEnv {
	return {
		BODHA_LIVE_ISOLATED_TARGET: "1",
		BODHA_LIVE_PRISMA_RLS: "1",
		BODHA_LIVE_USER_A_ID: USER_A,
		BODHA_LIVE_USER_B_ID: USER_B,
		DATABASE_URL: ISOLATED_URL,
		...overrides,
	};
}

describe("inspectLivePrismaTarget", () => {
	it("skips by default without opening a database", () => {
		const target = inspectLivePrismaTarget({});
		expect(target).toEqual({
			kind: "skipped",
			reason: LIVE_PRISMA_SKIPPED_REASON,
		});
	});

	it("refuses opt-in without an isolated-target confirmation", () => {
		const target = inspectLivePrismaTarget(
			env({
				BODHA_LIVE_ISOLATED_TARGET: undefined,
				MATI_LIVE_ISOLATED_TARGET: undefined,
			})
		);
		expect(target.kind).toBe("refused");
		if (target.kind !== "refused") {
			throw new Error("expected refused");
		}
		expect(target.reason).toMatch(/ISOLATED_TARGET/);
		expect(target.reason).toMatch(/No connection was opened/);
	});

	it("refuses production-looking pooler hosts without connecting", () => {
		const target = inspectLivePrismaTarget(
			env({
				DATABASE_URL:
					"postgresql://postgres.abcd1234:encoded@aws-0-prod-1.pooler.supabase.com:6543/postgres",
			})
		);
		expect(target.kind).toBe("refused");
		if (target.kind !== "refused") {
			throw new Error("expected refused");
		}
		expect(target.reason).toMatch(/production/);
	});

	it("refuses session-mode pooler ports", () => {
		const target = inspectLivePrismaTarget(
			env({
				DATABASE_URL:
					"postgresql://postgres.abcd1234:encoded@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
			})
		);
		expect(target.kind).toBe("refused");
		if (target.kind !== "refused") {
			throw new Error("expected refused");
		}
		expect(target.reason).toMatch(/6543/);
	});

	it("refuses non-pooler hosts", () => {
		const target = inspectLivePrismaTarget(
			env({
				DATABASE_URL: "postgresql://postgres:encoded@127.0.0.1:6543/postgres",
			})
		);
		expect(target.kind).toBe("refused");
		if (target.kind !== "refused") {
			throw new Error("expected refused");
		}
		expect(target.reason).toMatch(/pooler/);
	});

	it("accepts an isolated transaction-mode pooler URL", () => {
		const target = inspectLivePrismaTarget(env());
		expect(target.kind).toBe("ready");
		if (target.kind !== "ready") {
			throw new Error("expected ready");
		}
		expect(target.connectionString).toContain("pgbouncer=true");
		expect(target.connectionString).toContain(":6543");
		expect(target.userAId).toBe(USER_A);
		expect(target.userBId).toBe(USER_B);
	});

	it("refuses an unencoded password without echoing it or connecting", () => {
		const target = inspectLivePrismaTarget(
			env({
				DATABASE_URL:
					"postgresql://postgres.abcd1234:s3cret@xx@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
			})
		);
		expect(target.kind).toBe("refused");
		if (target.kind !== "refused") {
			throw new Error("expected refused");
		}
		expect(target.reason).toMatch(/unencoded reserved '@'/);
		expect(target.reason).toMatch(/No connection was opened/);
		expect(target.reason).not.toMatch(/s3cret/);
	});
});
