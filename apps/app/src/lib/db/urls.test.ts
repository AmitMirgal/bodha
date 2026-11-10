import { describe, expect, it } from "vitest";
import {
	assertDirectUrl,
	assertServerDatabaseUrl,
	DatabaseUrlError,
	encodeDbPassword,
	PRISMA_GENERATE_PLACEHOLDER,
	prismaCliKind,
	resolvePrismaCliDatasourceUrl,
	withTransactionPoolerOptions,
} from "./urls";

const ENCODED_TX =
	"postgresql://postgres.example:p%40ss@db.example.test:6543/postgres";
const ENCODED_DIRECT =
	"postgresql://postgres.example:p%40ss@db.example.test:5432/postgres";
const UNENCODED_TX =
	"postgresql://postgres.example:s3cret@xx@db.example.test:6543/postgres";

function secretHits(message: string): string[] {
	const hits: string[] = [];
	if (message.includes("s3cret")) {
		hits.push("password");
	}
	if (message.includes("db.example.test")) {
		hits.push("host");
	}
	if (message.includes("postgres.example")) {
		hits.push("user");
	}
	if (message.includes("postgresql://")) {
		hits.push("url");
	}
	return hits;
}

describe("database URL helpers", () => {
	it("URL-encodes reserved password characters (generic example)", () => {
		expect(encodeDbPassword("p@ss")).toBe("p%40ss");
		expect(encodeDbPassword("p@ss:word/x")).toBe("p%40ss%3Aword%2Fx");
	});

	it("adds pgbouncer=true on the transaction-mode pooler port", () => {
		const url =
			"postgresql://postgres.example:encoded@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
		expect(withTransactionPoolerOptions(url)).toContain("pgbouncer=true");
		expect(withTransactionPoolerOptions(url)).toContain(":6543");
	});

	it("does not add pgbouncer on the session-mode pooler port", () => {
		const url =
			"postgresql://postgres.example:encoded@aws-0-us-east-1.pooler.supabase.com:5432/postgres";
		expect(withTransactionPoolerOptions(url)).not.toContain("pgbouncer");
	});

	it("refuses missing or public database URLs", () => {
		expect(() => assertServerDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
		expect(() => assertServerDatabaseUrl("NEXT_PUBLIC_oops")).toThrow(
			/must not be a public/
		);
	});

	it("rejects an unencoded '@' in the password without echoing the URL", () => {
		expect(() => assertServerDatabaseUrl(UNENCODED_TX)).toThrow(
			DatabaseUrlError
		);
		try {
			assertServerDatabaseUrl(UNENCODED_TX);
		} catch (error) {
			expect(error).toBeInstanceOf(DatabaseUrlError);
			const message = error instanceof Error ? error.message : "";
			expect(secretHits(message)).toEqual([]);
			expect(message).toMatch(/p@ss/);
			expect(message).toMatch(/p%40ss/);
			expect(message).toMatch(/unencoded reserved '@'/);
		}
	});

	it("accepts a percent-encoded password on the transaction pooler", () => {
		const url = assertServerDatabaseUrl(ENCODED_TX);
		expect(url).toContain("p%40ss");
		expect(url).toContain("pgbouncer=true");
		expect(url).toContain(":6543");
	});

	it("rejects an unparseable URL without echoing it", () => {
		expect(() => assertServerDatabaseUrl("postgresql://not a url")).toThrow(
			DatabaseUrlError
		);
		try {
			assertServerDatabaseUrl("postgresql://not a url");
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			expect(message).not.toMatch(/not a url/);
			expect(message).toMatch(/p%40ss/);
		}
	});
});

describe("Prisma CLI datasource URL", () => {
	it("classifies generate vs connecting commands", () => {
		expect(
			prismaCliKind([
				"node",
				"prisma",
				"generate",
				"--config=./prisma.config.ts",
			])
		).toBe("generate");
		expect(prismaCliKind(["node", "prisma", "migrate", "dev"])).toBe(
			"connecting"
		);
		expect(prismaCliKind(["node", "prisma", "db", "pull"])).toBe("connecting");
		expect(prismaCliKind(["node", "prisma", "db", "push"])).toBe("connecting");
		expect(prismaCliKind(["node", "prisma", "format"])).toBe("generate");
	});

	it("uses a generate-only placeholder when DIRECT_URL is unset", () => {
		expect(
			resolvePrismaCliDatasourceUrl({}, ["node", "prisma", "generate"])
		).toBe(PRISMA_GENERATE_PLACEHOLDER);
	});

	it("fails migrate and db pull without DIRECT_URL", () => {
		expect(() =>
			resolvePrismaCliDatasourceUrl({}, ["node", "prisma", "migrate", "dev"])
		).toThrow(/DIRECT_URL is required/);
		expect(() =>
			resolvePrismaCliDatasourceUrl({}, ["node", "prisma", "db", "pull"])
		).toThrow(/DIRECT_URL is required/);
		try {
			resolvePrismaCliDatasourceUrl({}, [
				"node",
				"prisma",
				"migrate",
				"deploy",
			]);
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			expect(message).toMatch(/prisma migrate deploy/);
			expect(message).not.toMatch(/postgresql:\/\//);
		}
	});

	it("uses DIRECT_URL for migrate when the session-pooler URL is encoded", () => {
		const url = resolvePrismaCliDatasourceUrl({ DIRECT_URL: ENCODED_DIRECT }, [
			"node",
			"prisma",
			"migrate",
			"dev",
		]);
		expect(url).toContain("p%40ss");
		expect(url).toContain(":5432");
		expect(url).not.toContain("pgbouncer");
	});

	it("rejects an unencoded DIRECT_URL without echoing secrets", () => {
		const raw =
			"postgresql://postgres.example:s3cret@xx@db.example.test:5432/postgres";
		expect(() => assertDirectUrl(raw)).toThrow(DatabaseUrlError);
		try {
			assertDirectUrl(raw);
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			expect(secretHits(message)).toEqual([]);
			expect(message).toMatch(/DIRECT_URL/);
		}
	});
});
