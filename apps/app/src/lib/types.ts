export type TaskKind = "bugs" | "feature" | "perf";

export interface Task {
	brief: string;
	id: string;
	kind: TaskKind;
	title: string;
}

// What the home and results pages need.
export interface ChallengeMeta {
	blurb: string;
	difficulty: string;
	id: string;
	minutes: number;
	order: number;
	tasks: Task[];
	title: string;
}

// What a round needs to run. The reference solution is deliberately not in here.
export interface Challenge extends ChallengeMeta {
	starter: Record<string, string>;
	tests: string;
}

// The README is context for the candidate, not something to edit.
export const isReadOnly = (path: string) => path === "README.md";
