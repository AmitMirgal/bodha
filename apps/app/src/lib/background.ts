export function runBackground(task: Promise<unknown>) {
	task.catch(() => {
		// Event handlers surface errors through component state.
	});
}
