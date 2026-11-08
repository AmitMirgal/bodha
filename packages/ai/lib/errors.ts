export class ToolsUnsupportedError extends Error {
	constructor(
		message = "This provider does not support agent tool use. BODHA will not fall back to a one-shot completion.",
	) {
		super(message);
		this.name = "ToolsUnsupportedError";
	}
}
