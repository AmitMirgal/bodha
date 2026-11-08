import { RequestContext } from "@mastra/core/request-context";
import { describe, expect, it } from "vitest";
import { getSessionEvidenceTool } from "./tools";

describe("mastra tools", () => {
	it("refuses to run without authorized request context", async () => {
		const execute = getSessionEvidenceTool.execute;
		if (!execute) {
			throw new Error("get-session-evidence is missing execute.");
		}
		await expect(execute({ limit: 1 }, {})).rejects.toThrow(
			/authorization context/,
		);
	});

	it("scopes queries to request-context session, not tool arguments", async () => {
		const calls: unknown[] = [];
		const supabase = {
			from(table: string) {
				calls.push(table);
				const query = {
					select: () => query,
					eq: (column: string, value: string) => {
						calls.push([column, value]);
						return query;
					},
					order: () => query,
					limit: () => query,
					in: () => query,
					// biome-ignore lint/suspicious/noThenProperty: supabase query mock is thenable
					then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
						resolve({ data: [], error: null }),
				};
				return query;
			},
		};
		const requestContext = new RequestContext();
		requestContext.setRaw("userId", "11111111-1111-1111-1111-111111111111");
		requestContext.setRaw("sessionId", "22222222-2222-2222-2222-222222222222");
		requestContext.setRaw("supabase", supabase);
		await getSessionEvidenceTool.execute?.({ limit: 2 }, { requestContext });
		expect(calls).toContainEqual([
			"session_id",
			"22222222-2222-2222-2222-222222222222",
		]);
		expect(calls).toContainEqual([
			"user_id",
			"11111111-1111-1111-1111-111111111111",
		]);
	});
});
