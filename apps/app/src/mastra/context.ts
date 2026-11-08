import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentRole = "trainer" | "review";

export interface BodhaRequestContext {
	role: AgentRole;
	sessionId: string;
	supabase: SupabaseClient;
	userId: string;
}

export const CONTEXT_KEYS = {
	userId: "userId",
	sessionId: "sessionId",
	role: "role",
} as const;
