import { RequestContext } from "@mastra/core/request-context";
import {
	assertAgentToolsAllowed,
	type ResolvedLlmConfig,
	usageFromAgentOutput,
} from "@repo/ai/provider";
import type { RunWithDb } from "../lib/db/rls";
import { parseModelReview } from "../lib/reports/assemble";
import type { ModelReview } from "../lib/reports/schema";
import type { AgentRole } from "./context";
import { mastra } from "./index";

const BUDGETS = {
	trainer: { maxSteps: 6, timeoutMs: 45_000, maxTokens: 800 },
	review: { maxSteps: 8, timeoutMs: 60_000, maxTokens: 2000 },
};

const TRAINER_REQUIRED_TOOLS = ["get-exercise-snapshot"];
const REVIEW_REQUIRED_TOOLS = [
	"get-exercise-snapshot",
	"get-session-evidence",
	"get-latest-test-run",
];

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
	runWithDb: RunWithDb;
	sessionId: string;
	userId: string;
}

function toMastraMessages(messages: ChatTurn[]) {
	return messages.map((message) =>
		message.role === "user"
			? { role: "user" as const, content: message.content }
			: { role: "assistant" as const, content: message.content }
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
		capabilitiesJson: string;
	}>();
	requestContext.set("userId", input.userId);
	requestContext.set("sessionId", input.sessionId);
	requestContext.set("provider", input.config.provider);
	requestContext.set("model", input.config.model);
	requestContext.set("baseUrl", input.config.baseUrl);
	requestContext.set("apiKey", input.apiKey);
	requestContext.set(
		"capabilitiesJson",
		JSON.stringify(input.config.capabilities)
	);
	requestContext.setRaw("runWithDb", input.runWithDb);
	return requestContext;
}

interface ToolNameCarrier {
	name?: string;
	payload?: { toolName?: string };
	toolName?: string;
}

export function collectToolNames(response: {
	steps?: {
		toolCalls?: ToolNameCarrier[];
		toolResults?: ToolNameCarrier[];
	}[];
	toolCalls?: ToolNameCarrier[];
	toolResults?: ToolNameCarrier[];
}): string[] {
	const names: string[] = [];
	const push = (item: ToolNameCarrier | undefined) => {
		const name = item?.toolName ?? item?.payload?.toolName ?? item?.name;
		if (typeof name === "string") {
			names.push(name);
		}
	};
	for (const item of response.toolResults ?? []) {
		push(item);
	}
	for (const item of response.toolCalls ?? []) {
		push(item);
	}
	for (const step of response.steps ?? []) {
		for (const item of step.toolResults ?? []) {
			push(item);
		}
		for (const item of step.toolCalls ?? []) {
			push(item);
		}
	}
	return [...new Set(names)];
}

export function assertRequiredTools(
	response: Parameters<typeof collectToolNames>[0],
	requiredIds: string[],
	label: string
): string[] {
	const names = collectToolNames(response);
	const missing = requiredIds.filter((id) => !names.includes(id));
	if (missing.length > 0) {
		throw new MissingToolUseError(
			`${label} did not use required tools (${missing.join(", ")}). Refusing a one-shot completion.`
		);
	}
	return names;
}

export async function generateWithBudget<T>(
	run: (signal: AbortSignal) => Promise<T>,
	timeoutMs: number,
	label: string
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const budget = new Promise<never>((_, reject) => {
		const fail = () =>
			reject(new AgentBudgetError(`${label} hit the time budget.`));
		if (controller.signal.aborted) {
			fail();
			return;
		}
		controller.signal.addEventListener("abort", fail, { once: true });
	});
	try {
		return await Promise.race([run(controller.signal), budget]);
	} catch (error) {
		if (
			controller.signal.aborted ||
			(error instanceof Error &&
				(error.name === "AbortError" || error.name === "AgentBudgetError"))
		) {
			throw error instanceof AgentBudgetError
				? error
				: new AgentBudgetError(`${label} hit the time budget.`);
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

export async function runTrainer(input: RunInput) {
	assertAgentToolsAllowed(input.config);
	const agent = mastra.getAgentById("mati-trainer");
	const budget = BUDGETS.trainer;
	const response = await generateWithBudget(
		(abortSignal) =>
			agent.generate(toMastraMessages(input.messages), {
				requestContext: contextFor(input),
				maxSteps: budget.maxSteps,
				abortSignal,
				modelSettings: { maxOutputTokens: budget.maxTokens },
			}),
		budget.timeoutMs,
		"Trainer"
	);
	const tools = assertRequiredTools(
		response,
		TRAINER_REQUIRED_TOOLS,
		"Trainer"
	);
	return {
		text: response.text ?? "",
		toolCount: tools.length,
		tools,
		usage: usageFromAgentOutput(response),
	};
}

export async function runReview(input: RunInput) {
	assertAgentToolsAllowed(input.config);
	const agent = mastra.getAgentById("mati-review");
	const budget = BUDGETS.review;
	const response = await generateWithBudget(
		(abortSignal) =>
			agent.generate(toMastraMessages(input.messages), {
				requestContext: contextFor(input),
				maxSteps: budget.maxSteps,
				abortSignal,
				modelSettings: { maxOutputTokens: budget.maxTokens },
			}),
		budget.timeoutMs,
		"Review"
	);
	const tools = assertRequiredTools(response, REVIEW_REQUIRED_TOOLS, "Review");
	const parsed = parseModelReview(extractJson(response.text ?? ""));
	if (!parsed.success) {
		throw new Error("Review output was not a valid learning report.");
	}
	return {
		model: parsed.data as ModelReview,
		toolCount: tools.length,
		tools,
		usage: usageFromAgentOutput(response),
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
export const mastraRequiredTools = {
	trainer: TRAINER_REQUIRED_TOOLS,
	review: REVIEW_REQUIRED_TOOLS,
};
export const mastraDocs = {
	agents: "https://mastra.ai/docs/agents/overview",
	tools: "https://mastra.ai/docs/agents/tools",
	models: "https://mastra.ai/models",
	requestContext: "https://mastra.ai/docs/server/request-context",
	nextjs: "https://mastra.ai/integrations/frameworks/next-js",
};
