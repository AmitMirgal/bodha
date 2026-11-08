import { RequestContext } from "@mastra/core/request-context";
import { normalizeUsage, type ResolvedLlmConfig } from "@repo/ai/provider";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	type LearningReport,
	reportSchema,
	validateReportAgainstEvidence,
} from "../lib/reports/schema";
import type { AgentRole } from "./context";
import { mastra } from "./index";

const BUDGETS = {
	trainer: { maxSteps: 6, timeoutMs: 45_000 },
	review: { maxSteps: 8, timeoutMs: 60_000 },
};

export class AgentBudgetError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AgentBudgetError";
	}
}

export class MissingToolUseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MissingToolUseError";
	}
}

export type ChatTurn =
	| { role: "user"; content: string }
	| { role: "assistant"; content: string };

export function asChatTurn(role: string, content: string): ChatTurn | null {
	if (role === "user") {
		return { role: "user", content };
	}
	if (role === "assistant") {
		return { role: "assistant", content };
	}
	return null;
}

interface RunInput {
	apiKey: string;
	config: ResolvedLlmConfig;
	messages: ChatTurn[];
	role: AgentRole;
	sessionId: string;
	supabase: SupabaseClient;
	userId: string;
}

function toMastraMessages(messages: ChatTurn[]) {
	return messages.map((message) =>
		message.role === "user"
			? { role: "user" as const, content: message.content }
			: { role: "assistant" as const, content: message.content },
	);
}

function contextFor(input: RunInput) {
	const requestContext = new RequestContext<{
		userId: string;
		sessionId: string;
		provider: string;
		model: string;
		baseUrl: string;
		apiKey: string;
	}>();
	requestContext.set("userId", input.userId);
	requestContext.set("sessionId", input.sessionId);
	requestContext.set("provider", input.config.provider);
	requestContext.set("model", input.config.model);
	requestContext.set("baseUrl", input.config.baseUrl);
	requestContext.set("apiKey", input.apiKey);
	requestContext.setRaw("supabase", input.supabase);
	return requestContext;
}

function countToolResults(response: {
	toolResults?: unknown[];
	steps?: { toolResults?: unknown[] }[];
}): number {
	const direct = response.toolResults?.length ?? 0;
	const nested =
		response.steps?.reduce(
			(sum, step) => sum + (step.toolResults?.length ?? 0),
			0,
		) ?? 0;
	return Math.max(direct, nested);
}

export async function runTrainer(input: RunInput) {
	const agent = mastra.getAgentById("bodha-trainer");
	const budget = BUDGETS.trainer;
	const response = await Promise.race([
		agent.generate(toMastraMessages(input.messages), {
			requestContext: contextFor(input),
			maxSteps: budget.maxSteps,
		}),
		new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new AgentBudgetError("Trainer hit the time budget.")),
				budget.timeoutMs,
			);
		}),
	]);

	const toolCount = countToolResults(response);
	if (toolCount < 1) {
		throw new MissingToolUseError(
			"Trainer did not use required tools. Refusing a one-shot completion.",
		);
	}

	return {
		text: response.text ?? "",
		toolCount,
		usage: normalizeUsage(response.usage ?? null),
	};
}

export async function runReview(
	input: RunInput & {
		evidence: { id: string; kind: string; sessionId: string }[];
	},
) {
	const agent = mastra.getAgentById("bodha-review");
	const budget = BUDGETS.review;
	const response = await Promise.race([
		agent.generate(toMastraMessages(input.messages), {
			requestContext: contextFor(input),
			maxSteps: budget.maxSteps,
		}),
		new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new AgentBudgetError("Review hit the time budget.")),
				budget.timeoutMs,
			);
		}),
	]);

	const toolCount = countToolResults(response);
	if (toolCount < 2) {
		throw new MissingToolUseError(
			"Review did not retrieve evidence with tools. Refusing an ungrounded one-shot report.",
		);
	}

	const rawText = response.text ?? "";
	const jsonText = extractJson(rawText);
	const parsed = reportSchema.safeParse(jsonText);
	if (!parsed.success) {
		throw new Error("Review output was not a valid learning report.");
	}
	const validated = validateReportAgainstEvidence(
		parsed.data,
		input.evidence,
		input.sessionId,
	);
	if (!validated.ok) {
		throw new Error(validated.error);
	}
	return {
		report: validated.report as LearningReport,
		toolCount,
		usage: normalizeUsage(response.usage ?? null),
	};
}

const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/;

function extractJson(text: string): unknown {
	const trimmed = text.trim();
	const fenced = trimmed.match(JSON_FENCE);
	const candidate = fenced ? fenced[1] : trimmed;
	return JSON.parse(candidate);
}

export const mastraBudgets = BUDGETS;
export const mastraDocs = {
	agents: "https://mastra.ai/docs/agents/overview",
	tools: "https://mastra.ai/docs/agents/tools",
	models: "https://mastra.ai/models",
	requestContext: "https://mastra.ai/docs/server/request-context",
	nextjs: "https://mastra.ai/integrations/frameworks/next-js",
};
