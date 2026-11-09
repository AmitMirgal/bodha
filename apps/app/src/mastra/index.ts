import { Mastra } from "@mastra/core";
import { captureReviewAgent, reviewAgent, trainerAgent } from "./agents";

// Stateless orchestration plus ordinary Supabase app records.
// Do not enable Mastra memory/storage. Observability is omitted so prompt
// tracing stays off (Mastra 1.x uses a no-op entrypoint when unset).
export const mastra = new Mastra({
	agents: { trainerAgent, reviewAgent, captureReviewAgent },
	logger: false,
});
