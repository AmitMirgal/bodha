import type { HabitTask } from "./types";

export function isClosedCapturedTask(task: HabitTask): boolean {
	return (
		task.claimedByUser && task.status === "closed" && task.finishedAt != null
	);
}

export function isQualifyingStreakTask(task: HabitTask): boolean {
	return isClosedCapturedTask(task) && task.reportOpenedAt != null;
}

export function promptTexts(task: HabitTask): string[] {
	return task.prompts
		.map((prompt) => prompt.text.trim())
		.filter((text) => text.length > 0);
}
