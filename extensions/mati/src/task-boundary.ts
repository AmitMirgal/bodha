export interface TaskBoundaryState {
	branch: string | null;
	epoch: number;
	lastEditorTaskId: string | null;
	lastEventAt: number | null;
	workspaceHash: string;
}

export interface BoundaryEvent {
	at: number;
	branch: string | null;
	sourceId: string;
	workspaceHash: string;
}

export interface BoundaryResult {
	closePrevious: string | null;
	editorTaskId: string;
	state: TaskBoundaryState;
}

export const DEFAULT_BOUNDARY: TaskBoundaryState = {
	branch: null,
	epoch: 0,
	lastEventAt: null,
	lastEditorTaskId: null,
	workspaceHash: "",
};

export function editorTaskIdFor(sourceId: string, epoch: number): string {
	const trimmed = sourceId.trim() || "task";
	if (epoch <= 0) {
		return trimmed.slice(0, 200);
	}
	const suffix = `#m${epoch}`;
	return `${trimmed.slice(0, Math.max(1, 200 - suffix.length))}${suffix}`;
}

function bump(
	state: TaskBoundaryState,
	event: BoundaryEvent,
	close: boolean
): BoundaryResult {
	const epoch = state.epoch + 1;
	const closePrevious =
		close && state.lastEditorTaskId ? state.lastEditorTaskId : null;
	const editorTaskId = editorTaskIdFor(event.sourceId, epoch);
	return {
		closePrevious,
		editorTaskId,
		state: {
			branch: event.branch,
			epoch,
			lastEventAt: event.at,
			lastEditorTaskId: editorTaskId,
			workspaceHash: event.workspaceHash,
		},
	};
}

export function applyTaskBoundary(
	state: TaskBoundaryState,
	event: BoundaryEvent,
	options: {
		forceEnd?: boolean;
		forceNew?: boolean;
		idleMs: number;
	}
): BoundaryResult {
	if (options.forceEnd) {
		const closed = bump(state, event, true);
		return {
			closePrevious: state.lastEditorTaskId,
			editorTaskId: closed.editorTaskId,
			state: {
				...closed.state,
				lastEditorTaskId: null,
			},
		};
	}
	if (options.forceNew) {
		return bump(state, event, true);
	}
	const idleSplit =
		state.lastEventAt !== null && event.at - state.lastEventAt > options.idleMs;
	const branchSplit =
		state.branch !== null &&
		event.branch !== null &&
		event.branch !== state.branch;
	const workspaceSplit =
		state.workspaceHash.length > 0 &&
		event.workspaceHash !== state.workspaceHash;
	if (idleSplit || branchSplit || workspaceSplit) {
		return bump(state, event, true);
	}
	const epoch = state.epoch;
	const editorTaskId = editorTaskIdFor(event.sourceId, epoch);
	return {
		closePrevious: null,
		editorTaskId,
		state: {
			branch: event.branch ?? state.branch,
			epoch,
			lastEventAt: event.at,
			lastEditorTaskId: editorTaskId,
			workspaceHash: event.workspaceHash,
		},
	};
}

export function eventTimeMs(events: unknown[]): number {
	const first = events[0];
	if (first && typeof first === "object" && "occurredAt" in first) {
		const raw = (first as { occurredAt?: unknown }).occurredAt;
		if (typeof raw === "string") {
			const parsed = Date.parse(raw);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
	}
	return Date.now();
}

export function splitCaptureBatch(
	state: TaskBoundaryState,
	batch: {
		editor: string;
		editorTaskId: string;
		events: unknown[];
		workspaceHash: string;
	},
	options: {
		branch: string | null;
		forceEnd?: boolean;
		forceNew?: boolean;
		idleMs: number;
		workspaceHash: string;
	}
): {
	batches: Array<{
		editor: string;
		editorTaskId: string;
		events: unknown[];
		workspaceHash: string;
	}>;
	state: TaskBoundaryState;
} {
	const editor = batch.editor === "vscode" ? "vscode" : "cursor";
	const occurredAtIso = new Date(eventTimeMs(batch.events)).toISOString();
	const result = applyTaskBoundary(
		state,
		{
			at: eventTimeMs(batch.events),
			branch: options.branch,
			sourceId: batch.editorTaskId,
			workspaceHash: options.workspaceHash,
		},
		{
			forceEnd: options.forceEnd,
			forceNew: options.forceNew,
			idleMs: options.idleMs,
		}
	);
	const batches: Array<{
		editor: string;
		editorTaskId: string;
		events: unknown[];
		workspaceHash: string;
	}> = [];
	if (result.closePrevious) {
		batches.push(
			sessionEndBatch(
				editor,
				result.closePrevious,
				options.workspaceHash,
				occurredAtIso
			)
		);
	}
	if (!(options.forceEnd || options.forceNew)) {
		batches.push({
			...batch,
			editorTaskId: result.editorTaskId,
		});
	}
	return { batches, state: result.state };
}

export function sessionEndBatch(
	editor: "cursor" | "vscode",
	editorTaskId: string,
	workspaceHash: string,
	occurredAt: string
) {
	return {
		editor,
		editorTaskId,
		events: [
			{
				idempotencyKey: `${editor}:${editorTaskId}:session_end:${occurredAt}`,
				kind: "session_end" as const,
				occurredAt,
				reason: "mati_boundary",
			},
		],
		workspaceHash,
	};
}
