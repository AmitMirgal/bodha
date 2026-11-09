import type { RunWithDb } from "../lib/db/rls";

export type AgentRole = "trainer" | "review";

export interface MatiRequestContext {
	role: AgentRole;
	runWithDb: RunWithDb;
	sessionId: string;
	userId: string;
}

export const CONTEXT_KEYS = {
	userId: "userId",
	sessionId: "sessionId",
	role: "role",
} as const;
