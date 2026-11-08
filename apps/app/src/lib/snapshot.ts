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
	challenge: Challenge,
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

export function hashFiles(files: Record<string, string>): string {
	const canonical = JSON.stringify(
		Object.keys(files)
			.sort()
			.map((path) => [path, files[path]]),
	);
	return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
