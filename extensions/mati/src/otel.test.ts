import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	installCopilotOtel,
	OTEL_CAPTURE_CONTENT,
	OTEL_EXPORTER,
	parseCopilotOtelLine,
	planCopilotOtel,
} from "./otel";

describe("Copilot OTel join", () => {
	it("parses a recorded chat span fixture into measured tokens", () => {
		const fixture = readFileSync(
			path.resolve(import.meta.dirname, "../fixtures/copilot-otel-chat.jsonl"),
			"utf8"
		);
		const lines = fixture
			.split("\n")
			.filter((line) => line.trim().length > 0)
			.map((line) => JSON.parse(line) as unknown);
		const first = parseCopilotOtelLine(lines[0]);
		expect(first[0]).toMatchObject({
			cachedTokens: 3,
			conversationId: "sess-1",
			inputTokens: 12,
			model: "gpt-4.1",
			operationId: "otel:span-measured-1",
			outputTokens: 4,
			reasoningTokens: 3,
		});
		const otlp = parseCopilotOtelLine(lines[1]);
		expect(otlp[0]).toMatchObject({
			conversationId: "sess-1",
			inputTokens: 8,
			outputTokens: 6,
			reasoningTokens: 1,
		});
		expect(parseCopilotOtelLine(lines[2])).toEqual([]);
		const withContent = parseCopilotOtelLine(lines[3]);
		expect(JSON.stringify(withContent)).not.toContain("secret prompt text");
		expect(withContent[0]?.inputTokens).toBe(1);
	});

	it("does not overwrite another exporter and keeps captureContent false when writing", () => {
		const skip = planCopilotOtel(
			{
				[OTEL_EXPORTER]: "otlp",
				"github.copilot.chat.otel.enabled": true,
			},
			"/tmp/.mati/otel/copilot.jsonl"
		);
		expect(skip.action).toBe("skip");
		expect(skip.reason).toContain("another exporter");
		const dir = mkdtempSync(path.join(tmpdir(), "mati-otel-"));
		const settingsPath = path.join(dir, "settings.json");
		writeFileSync(settingsPath, "{}\n");
		const wrote = installCopilotOtel({
			matiHome: path.join(dir, ".mati"),
			settingsPath,
		});
		expect(wrote.action).toBe("write");
		const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<
			string,
			unknown
		>;
		expect(settings[OTEL_CAPTURE_CONTENT]).toBe(false);
		expect(settings[OTEL_EXPORTER]).toBe("file");
	});
});
