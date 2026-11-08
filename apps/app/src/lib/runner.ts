export interface TestResult {
	error?: string;
	ms: number;
	name: string;
	pass: boolean;
	task: string;
}

export interface RunOutcome {
	fatal?: string;
	results: TestResult[];
}

type WorkerMessage =
	| { type: "plan"; tests: { task: string; name: string }[] }
	| { type: "result"; result: TestResult }
	| { type: "done" }
	| { type: "fatal"; message: string };

const TIMEOUT_MS = 10_000;

// harness.js lives in /public. Each run gets a fresh Worker, so an infinite loop in the candidate's code
// can simply be terminated instead of freezing the page. Results stream back one test at a time, so when
// the clock runs out the tests that finished still count and only the stuck one is marked as timed out.
export function runTests(
	files: Record<string, string>,
	tests: string,
): Promise<RunOutcome> {
	return new Promise((resolve) => {
		const worker = new Worker("/harness.js");
		let planned: { task: string; name: string }[] = [];
		const results: TestResult[] = [];

		const finish = (outcome: RunOutcome) => {
			clearTimeout(timer);
			worker.terminate();
			resolve(outcome);
		};

		const timer = setTimeout(() => {
			if (!planned.length) {
				return finish({
					results: [],
					fatal: `The tests didn't start within ${TIMEOUT_MS / 1000} seconds.`,
				});
			}
			const error = `Took longer than ${TIMEOUT_MS / 1000}s, so the run was stopped. An infinite loop, or something very slow?`;
			const missing = planned
				.slice(results.length)
				.map((t) => ({ ...t, pass: false, error, ms: TIMEOUT_MS }));
			finish({ results: [...results, ...missing] });
		}, TIMEOUT_MS);

		worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
			const m = e.data;
			switch (m.type) {
				case "plan":
					planned = m.tests;
					return;
				case "result":
					results.push(m.result);
					return;
				case "done":
					finish({ results });
					return;
				case "fatal":
					finish({ results: [], fatal: m.message });
					return;
				default: {
					const exhaustive: never = m;
					finish({
						results: [],
						fatal: `Unknown harness message: ${JSON.stringify(exhaustive)}`,
					});
				}
			}
		};
		worker.onerror = (e) =>
			finish({ results: [], fatal: e.message || "The test worker crashed." });
		worker.postMessage({ files, tests });
	});
}

export type TaskStatus = "untested" | "failing" | "solved";

export function taskStatus(
	taskId: string,
	results: TestResult[] | undefined,
): { status: TaskStatus; passed: number; total: number } {
	const mine = (results ?? []).filter((r) => r.task === taskId);
	const passed = mine.filter((r) => r.pass).length;
	if (mine.length === 0) {
		return { status: "untested", passed, total: 0 };
	}
	return {
		status: passed === mine.length ? "solved" : "failing",
		passed,
		total: mine.length,
	};
}
