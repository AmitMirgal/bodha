export interface TestResult {
  task: string;
  name: string;
  pass: boolean;
  error?: string;
  ms: number;
}

export interface RunOutcome {
  results: TestResult[];
  fatal?: string;
}

type WorkerMessage =
  | { type: 'plan'; tests: { task: string; name: string }[] }
  | { type: 'result'; result: TestResult }
  | { type: 'done' }
  | { type: 'fatal'; message: string };

const TIMEOUT_MS = 10000;

// harness.js lives in /public. Each run gets a fresh Worker, so an infinite loop in the candidate's code
// can simply be terminated instead of freezing the page. Results stream back one test at a time, so when
// the clock runs out the tests that finished still count and only the stuck one is marked as timed out.
export function runTests(files: Record<string, string>, tests: string): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const worker = new Worker('/harness.js');
    let planned: { task: string; name: string }[] = [];
    const results: TestResult[] = [];

    const finish = (outcome: RunOutcome) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(outcome);
    };

    const timer = setTimeout(() => {
      if (!planned.length) {
        return finish({ results: [], fatal: `The tests didn't start within ${TIMEOUT_MS / 1000} seconds.` });
      }
      const error = `Took longer than ${TIMEOUT_MS / 1000}s, so the run was stopped. An infinite loop, or something very slow?`;
      const missing = planned
        .slice(results.length)
        .map((t) => ({ ...t, pass: false, error, ms: TIMEOUT_MS }));
      finish({ results: [...results, ...missing] });
    }, TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.type === 'plan') planned = m.tests;
      else if (m.type === 'result') results.push(m.result);
      else if (m.type === 'done') finish({ results });
      else if (m.type === 'fatal') finish({ results: [], fatal: m.message });
    };
    worker.onerror = (e) => finish({ results: [], fatal: e.message || 'The test worker crashed.' });
    worker.postMessage({ files, tests });
  });
}

export type TaskStatus = 'untested' | 'failing' | 'solved';

export function taskStatus(taskId: string, results: TestResult[] | undefined): { status: TaskStatus; passed: number; total: number } {
  const mine = (results ?? []).filter((r) => r.task === taskId);
  const passed = mine.filter((r) => r.pass).length;
  if (mine.length === 0) return { status: 'untested', passed, total: 0 };
  return { status: passed === mine.length ? 'solved' : 'failing', passed, total: mine.length };
}
