export type TaskKind = 'bugs' | 'feature' | 'perf';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  brief: string;
}

// What the home and results pages need.
export interface ChallengeMeta {
  id: string;
  order: number;
  title: string;
  blurb: string;
  difficulty: string;
  minutes: number;
  tasks: Task[];
}

// What a round needs to run. The reference solution is deliberately not in here.
export interface Challenge extends ChallengeMeta {
  tests: string;
  starter: Record<string, string>;
}

// The README is context for the candidate, not something to edit.
export const isReadOnly = (path: string) => path === 'README.md';
