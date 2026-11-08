import type { TestResult } from './runner';

export interface Session {
  challengeId: string;
  startedAt: number;
  files: Record<string, string>;
  prompts: number;
  runs: number;
  results?: TestResult[];
  finishedAt?: number;
}

const sessionKey = (id: string) => `cc.session.${id}`;
export type Provider = 'gemini' | 'anthropic' | 'openrouter';

const keyName = (p: Provider) => `cc.apiKey.${p}`;
const PROVIDER_NAME = 'cc.provider';

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the round still works, it just won't survive a refresh.
  }
}

export const loadSession = (id: string) => read<Session>(sessionKey(id));
export const saveSession = (s: Session) => write(sessionKey(s.challengeId), s);
export const clearSession = (id: string) => {
  try {
    localStorage.removeItem(sessionKey(id));
  } catch {
    // ignore
  }
};

export const loadApiKey = (p: Provider) => read<string>(keyName(p)) ?? '';
export const saveApiKey = (p: Provider, k: string) => write(keyName(p), k);

// The real round uses Gemini, so that's the default.
export const loadProvider = () => read<Provider>(PROVIDER_NAME) ?? 'gemini';
export const saveProvider = (p: Provider) => write(PROVIDER_NAME, p);

// Empty means "use that provider's default model".
export const loadModel = (p: Provider) => read<string>(`cc.model.${p}`) ?? '';
export const saveModel = (p: Provider, m: string) => write(`cc.model.${p}`, m);
