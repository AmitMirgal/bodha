import { describe, expect, it } from "vitest";
import {
	applyTaskBoundary,
	DEFAULT_BOUNDARY,
	editorTaskIdFor,
	sessionEndBatch,
	splitCaptureBatch,
} from "./task-boundary";

const IDLE_MS = 30 * 60 * 1000;

describe("task boundaries", () => {
	it("keeps the vendor conversation id until a split", () => {
		const first = applyTaskBoundary(
			DEFAULT_BOUNDARY,
			{
				at: 1000,
				branch: "main",
				sourceId: "conv-1",
				workspaceHash: "ws-a",
			},
			{ idleMs: IDLE_MS }
		);
		expect(first.editorTaskId).toBe("conv-1");
		expect(first.closePrevious).toBeNull();
		expect(editorTaskIdFor("conv-1", 0)).toBe("conv-1");
	});

	it("splits a new task after an idle gap", () => {
		const first = applyTaskBoundary(
			DEFAULT_BOUNDARY,
			{
				at: 0,
				branch: "main",
				sourceId: "conv-1",
				workspaceHash: "ws-a",
			},
			{ idleMs: IDLE_MS }
		);
		const later = applyTaskBoundary(
			first.state,
			{
				at: IDLE_MS + 1,
				branch: "main",
				sourceId: "conv-1",
				workspaceHash: "ws-a",
			},
			{ idleMs: IDLE_MS }
		);
		expect(later.editorTaskId).toBe("conv-1#m1");
		expect(later.closePrevious).toBe("conv-1");
	});

	it("splits on branch or workspace switch", () => {
		const first = applyTaskBoundary(
			DEFAULT_BOUNDARY,
			{
				at: 1000,
				branch: "main",
				sourceId: "conv-1",
				workspaceHash: "ws-a",
			},
			{ idleMs: IDLE_MS }
		);
		const branched = applyTaskBoundary(
			first.state,
			{
				at: 2000,
				branch: "feat",
				sourceId: "conv-1",
				workspaceHash: "ws-a",
			},
			{ idleMs: IDLE_MS }
		);
		expect(branched.editorTaskId).toBe("conv-1#m1");
		const moved = applyTaskBoundary(
			branched.state,
			{
				at: 3000,
				branch: "feat",
				sourceId: "conv-1",
				workspaceHash: "ws-b",
			},
			{ idleMs: IDLE_MS }
		);
		expect(moved.editorTaskId).toBe("conv-1#m2");
	});

	it("applies manual new and end task overrides", () => {
		const first = applyTaskBoundary(
			DEFAULT_BOUNDARY,
			{
				at: 1000,
				branch: "main",
				sourceId: "conv-1",
				workspaceHash: "ws-a",
			},
			{ idleMs: IDLE_MS }
		);
		const neu = applyTaskBoundary(
			first.state,
			{
				at: 2000,
				branch: "main",
				sourceId: "conv-1",
				workspaceHash: "ws-a",
			},
			{ forceNew: true, idleMs: IDLE_MS }
		);
		expect(neu.editorTaskId).toBe("conv-1#m1");
		expect(neu.closePrevious).toBe("conv-1");
		const ended = applyTaskBoundary(
			neu.state,
			{
				at: 3000,
				branch: "main",
				sourceId: "conv-1",
				workspaceHash: "ws-a",
			},
			{ forceEnd: true, idleMs: IDLE_MS }
		);
		expect(ended.closePrevious).toBe("conv-1#m1");
		expect(ended.state.lastEditorTaskId).toBeNull();
		const batch = sessionEndBatch(
			"cursor",
			"conv-1#m1",
			"ws-a",
			"2026-11-10T12:00:00.000Z"
		);
		expect(batch.events[0]?.kind).toBe("session_end");
		expect(batch.editorTaskId).toBe("conv-1#m1");
	});
});

describe("splitCaptureBatch", () => {
	it("rewrites editorTaskId after idle and prepends session_end", () => {
		const first = splitCaptureBatch(
			DEFAULT_BOUNDARY,
			{
				editor: "cursor",
				editorTaskId: "conv-1",
				events: [{ kind: "prompt", occurredAt: "2026-11-10T12:00:00.000Z" }],
				workspaceHash: "ws-a",
			},
			{ branch: "main", idleMs: IDLE_MS, workspaceHash: "ws-a" }
		);
		expect(first.batches).toHaveLength(1);
		const later = splitCaptureBatch(
			first.state,
			{
				editor: "cursor",
				editorTaskId: "conv-1",
				events: [{ kind: "prompt", occurredAt: "2026-11-10T12:40:00.000Z" }],
				workspaceHash: "ws-a",
			},
			{ branch: "main", idleMs: IDLE_MS, workspaceHash: "ws-a" }
		);
		expect(later.batches[0]?.events[0]).toMatchObject({ kind: "session_end" });
		expect(later.batches[1]?.editorTaskId).toBe("conv-1#m1");
	});
});
