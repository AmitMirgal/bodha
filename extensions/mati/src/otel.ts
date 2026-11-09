import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const OTEL_ENABLED = "github.copilot.chat.otel.enabled";
export const OTEL_EXPORTER = "github.copilot.chat.otel.exporterType";
export const OTEL_OUTFILE = "github.copilot.chat.otel.outfile";
export const OTEL_CAPTURE_CONTENT = "github.copilot.chat.otel.captureContent";
export const OTEL_CAPTURE_IDENTITY = "github.copilot.chat.otel.captureIdentity";

const DIGITS = /^\d+$/;

export interface CopilotOtelUsage {
	cachedTokens: number | null;
	conversationId: string;
	inputTokens: number | null;
	model: string | null;
	occurredAt: string;
	operationId: string;
	outputTokens: number | null;
	reasoningTokens: number | null;
}

export interface OtelPlan {
	action: "write" | "skip";
	next: Record<string, unknown> | null;
	reason: string;
}

export function defaultOtelOutfile(matiHome?: string): string {
	return path.join(
		matiHome ?? path.join(homedir(), ".mati"),
		"otel",
		"copilot.jsonl"
	);
}

export function defaultVscodeSettingsPath(): string {
	return (
		process.env.MATI_VSCODE_SETTINGS_PATH ||
		path.join(homedir(), ".config", "Code", "User", "settings.json")
	);
}

function asInt(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.trunc(value);
	}
	if (typeof value === "string" && value.length > 0 && DIGITS.test(value)) {
		return Number(value);
	}
	if (value && typeof value === "object" && "intValue" in value) {
		return asInt((value as { intValue: unknown }).intValue);
	}
	if (value && typeof value === "object" && "stringValue" in value) {
		return asInt((value as { stringValue: unknown }).stringValue);
	}
	return null;
}

function asString(value: unknown): string | null {
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	if (value && typeof value === "object" && "stringValue" in value) {
		const inner = (value as { stringValue: unknown }).stringValue;
		return typeof inner === "string" && inner.length > 0 ? inner : null;
	}
	return null;
}

function attributeMap(raw: unknown): Record<string, unknown> {
	if (!raw) {
		return {};
	}
	if (Array.isArray(raw)) {
		const out: Record<string, unknown> = {};
		for (const item of raw) {
			if (!item || typeof item !== "object") {
				continue;
			}
			const row = item as { key?: unknown; value?: unknown };
			if (typeof row.key === "string") {
				out[row.key] = row.value;
			}
		}
		return out;
	}
	if (typeof raw === "object") {
		return raw as Record<string, unknown>;
	}
	return {};
}

function chatSpanFromObject(
	record: Record<string, unknown>
): CopilotOtelUsage | null {
	const name = asString(record.name) ?? asString(record.spanName);
	if (name && name !== "chat" && !name.includes("chat")) {
		return null;
	}
	const attrs = attributeMap(record.attributes);
	if (Object.keys(attrs).length === 0 && !name) {
		return null;
	}
	const conversationId =
		asString(attrs["gen_ai.conversation.id"]) ??
		asString(attrs["gen_ai.session.id"]);
	if (!conversationId) {
		return null;
	}
	const cacheRead = asInt(attrs["gen_ai.usage.cache_read.input_tokens"]);
	const cacheCreate = asInt(attrs["gen_ai.usage.cache_creation.input_tokens"]);
	let cachedTokens: number | null = null;
	if (cacheRead !== null || cacheCreate !== null) {
		cachedTokens = (cacheRead ?? 0) + (cacheCreate ?? 0);
	}
	const spanId =
		asString(record.spanId) ??
		asString(record.span_id) ??
		asString(record.id) ??
		createHash("sha256")
			.update(JSON.stringify({ conversationId, attrs }))
			.digest("hex")
			.slice(0, 24);
	return {
		cachedTokens,
		conversationId,
		inputTokens: asInt(attrs["gen_ai.usage.input_tokens"]),
		model: asString(attrs["gen_ai.request.model"]),
		occurredAt:
			asString(record.startTimeUnixNano) &&
			DIGITS.test(String(record.startTimeUnixNano))
				? new Date(
						Number(String(record.startTimeUnixNano).slice(0, 13))
					).toISOString()
				: (asString(record.timestamp) ?? new Date().toISOString()),
		operationId: `otel:${spanId}`,
		outputTokens: asInt(attrs["gen_ai.usage.output_tokens"]),
		reasoningTokens:
			asInt(attrs["gen_ai.usage.reasoning.output_tokens"]) ??
			asInt(attrs["gen_ai.usage.reasoning_tokens"]),
	};
}

function walkSpans(raw: unknown, found: CopilotOtelUsage[]): void {
	if (!raw) {
		return;
	}
	if (Array.isArray(raw)) {
		for (const item of raw) {
			walkSpans(item, found);
		}
		return;
	}
	if (typeof raw !== "object") {
		return;
	}
	const record = raw as Record<string, unknown>;
	if (record.resourceSpans || record.scopeSpans || record.spans) {
		walkSpans(record.resourceSpans, found);
		walkSpans(record.scopeSpans, found);
		walkSpans(record.spans, found);
		return;
	}
	const parsed = chatSpanFromObject(record);
	if (parsed) {
		found.push(parsed);
	}
}

export function parseCopilotOtelLine(raw: unknown): CopilotOtelUsage[] {
	const found: CopilotOtelUsage[] = [];
	walkSpans(raw, found);
	return found;
}

export function planCopilotOtel(
	existing: Record<string, unknown> | null,
	outfile: string
): OtelPlan {
	const current = existing ?? {};
	const exporter = current[OTEL_EXPORTER];
	const enabled = current[OTEL_ENABLED];
	if (
		typeof exporter === "string" &&
		exporter.length > 0 &&
		(exporter !== "file" || current[OTEL_OUTFILE] !== outfile)
	) {
		return {
			action: "skip",
			next: null,
			reason:
				"Copilot OTel already uses another exporter. Leaving it unchanged. Token counts stay missing until that exporter is removed.",
		};
	}
	if (enabled === true && exporter && exporter !== "file") {
		return {
			action: "skip",
			next: null,
			reason:
				"Copilot OTel is already enabled with a non-file exporter. Leaving it unchanged.",
		};
	}
	return {
		action: "write",
		reason:
			"Mati will write a Copilot OTel file exporter with captureContent false.",
		next: {
			...current,
			[OTEL_ENABLED]: true,
			[OTEL_EXPORTER]: "file",
			[OTEL_OUTFILE]: outfile,
			[OTEL_CAPTURE_CONTENT]: false,
			[OTEL_CAPTURE_IDENTITY]: false,
		},
	};
}

export function readJsonObject(
	filePath: string
): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch {
		return null;
	}
}

export function installCopilotOtel(options: {
	matiHome?: string;
	settingsPath?: string;
}): OtelPlan {
	const settingsPath = options.settingsPath ?? defaultVscodeSettingsPath();
	const outfile = defaultOtelOutfile(options.matiHome);
	mkdirSync(path.dirname(outfile), { recursive: true });
	const existing = readJsonObject(settingsPath);
	const plan = planCopilotOtel(existing, outfile);
	if (plan.action !== "write" || !plan.next) {
		return plan;
	}
	mkdirSync(path.dirname(settingsPath), { recursive: true });
	writeFileSync(settingsPath, `${JSON.stringify(plan.next, null, 2)}\n`);
	return plan;
}

export function uninstallCopilotOtel(options: {
	managed: boolean;
	matiHome?: string;
	settingsPath?: string;
}): void {
	if (!options.managed) {
		return;
	}
	const settingsPath = options.settingsPath ?? defaultVscodeSettingsPath();
	const current = readJsonObject(settingsPath);
	if (!current) {
		return;
	}
	delete current[OTEL_ENABLED];
	delete current[OTEL_EXPORTER];
	delete current[OTEL_OUTFILE];
	delete current[OTEL_CAPTURE_CONTENT];
	delete current[OTEL_CAPTURE_IDENTITY];
	writeFileSync(settingsPath, `${JSON.stringify(current, null, 2)}\n`);
}

export function ingestBodyFromOtel(
	span: CopilotOtelUsage,
	workspaceHash: string
) {
	return {
		editor: "vscode" as const,
		editorTaskId: span.conversationId,
		events: [
			{
				cachedTokens: span.cachedTokens,
				idempotencyKey: `vscode:${span.conversationId}:usage:${span.operationId}`,
				inputTokens: span.inputTokens,
				kind: "usage" as const,
				model: span.model,
				occurredAt: span.occurredAt,
				operationId: span.operationId,
				outputTokens: span.outputTokens,
				provenance: "measured" as const,
				reasoningTokens: span.reasoningTokens,
				source: "copilot_otel_chat_span" as const,
			},
		],
		workspaceHash,
	};
}
