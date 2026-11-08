export class PersistenceError extends Error {
	constructor(message = "Could not persist the record.") {
		super(message);
		this.name = "PersistenceError";
	}
}

export class RevisionConflictError extends Error {
	constructor(
		message = "This session was updated elsewhere. Reload and retry.",
	) {
		super(message);
		this.name = "RevisionConflictError";
	}
}

const SECRETISH =
	/(api[_-]?key|authorization:|bearer\s+\S+|sk-[a-zA-Z0-9_-]{8,}|xai-[a-zA-Z0-9_-]{8,}|password=)/i;
const UUIDISH =
	/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export function redactProviderError(error: unknown): string {
	if (
		error &&
		typeof error === "object" &&
		"name" in error &&
		(error.name === "LlmConfigError" ||
			error.name === "MissingToolUseError" ||
			error.name === "AgentBudgetError" ||
			error.name === "PersistenceError" ||
			error.name === "RevisionConflictError" ||
			error.name === "ToolsUnsupportedError" ||
			error.name === "EncryptionConfigError" ||
			error.name === "EndpointValidationError")
	) {
		const message =
			error instanceof Error
				? error.message
				: "The request could not be completed.";
		return sanitizeExternalMessage(message);
	}
	const raw =
		error instanceof Error
			? error.message
			: "The language-model provider rejected the request.";
	if (SECRETISH.test(raw) || raw.length > 240) {
		return "The language-model provider rejected the request.";
	}
	return sanitizeExternalMessage(raw);
}

function sanitizeExternalMessage(message: string): string {
	return message
		.replace(SECRETISH, "[redacted]")
		.replace(UUIDISH, "[id]")
		.slice(0, 240);
}
