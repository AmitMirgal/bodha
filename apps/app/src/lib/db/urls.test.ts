import { describe, expect, it } from "vitest";
import {
	assertServerDatabaseUrl,
	encodeDbPassword,
	withTransactionPoolerOptions,
} from "./urls";

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
			/must not be public/
		);
	});
});
