import { createHash } from "node:crypto";
import type { Challenge } from "./types";

export interface ExerciseSnapshotPayload {
	contentHash: string;
	exerciseId: string;
	meta: {
		title: string;
		blurb: string;
		difficulty: string;
		minutes: number;
		tasks: Challenge["tasks"];
	};
	specMarkdown: string;
	starter: Record<string, string>;
	testsSource: string;
}

export function buildExerciseSnapshot(
	challenge: Challenge
): ExerciseSnapshotPayload {
	const specMarkdown = challenge.starter["README.md"] ?? "";
	const canonical = JSON.stringify({
		id: challenge.id,
		title: challenge.title,
		blurb: challenge.blurb,
		difficulty: challenge.difficulty,
		minutes: challenge.minutes,
		tasks: challenge.tasks,
		tests: challenge.tests,
		starter: challenge.starter,
	});
	const contentHash = `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
	return {
		exerciseId: challenge.id,
		contentHash,
		specMarkdown,
		testsSource: challenge.tests,
		starter: challenge.starter,
		meta: {
			title: challenge.title,
			blurb: challenge.blurb,
			difficulty: challenge.difficulty,
			minutes: challenge.minutes,
			tasks: challenge.tasks,
		},
	};
}

export function challengeFromSnapshot(
	current: Challenge,
	snapshot: {
		exercise_id: string;
		meta: unknown;
		spec_markdown: string;
		starter: unknown;
		tests_source: string;
	}
): Challenge {
	const meta =
		snapshot.meta && typeof snapshot.meta === "object"
			? (snapshot.meta as Partial<Challenge>)
			: {};
	const starter =
		snapshot.starter &&
		typeof snapshot.starter === "object" &&
		!Array.isArray(snapshot.starter)
			? (snapshot.starter as Record<string, string>)
			: current.starter;
	return {
		...current,
		id: snapshot.exercise_id || current.id,
		title: typeof meta.title === "string" ? meta.title : current.title,
		blurb: typeof meta.blurb === "string" ? meta.blurb : current.blurb,
		difficulty:
			typeof meta.difficulty === "string"
				? meta.difficulty
				: current.difficulty,
		minutes: typeof meta.minutes === "number" ? meta.minutes : current.minutes,
		tasks: Array.isArray(meta.tasks) ? meta.tasks : current.tasks,
		tests: snapshot.tests_source,
		starter: {
			...starter,
			"README.md": snapshot.spec_markdown,
		},
	};
}

export function hashFiles(files: Record<string, string>): string {
	const canonical = JSON.stringify(
		Object.keys(files)
			.sort()
			.map((path) => [path, files[path]])
	);
	return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
