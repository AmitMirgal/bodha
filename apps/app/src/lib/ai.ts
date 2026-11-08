import type { Provider } from './storage';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const PROVIDERS: Record<Provider, { label: string; placeholder: string; keyUrl: string; defaultModel: string }> = {
  gemini: { label: 'Gemini', placeholder: 'AIza…', keyUrl: 'https://aistudio.google.com/apikey', defaultModel: 'gemini-3.8-flash' },
  anthropic: { label: 'Claude', placeholder: 'sk-ant-…', keyUrl: 'https://console.anthropic.com/settings/keys', defaultModel: 'claude-sonnet-5-5' },
  // No default: the user picks from OpenRouter's free models, so nothing bills by accident.
  openrouter: { label: 'OpenRouter', placeholder: 'sk-or-…', keyUrl: 'https://openrouter.ai/keys', defaultModel: '' },
};

export interface FreeModel {
  id: string;
  name: string;
  context: number;
}

// OpenRouter lists its catalogue publicly. Free models cost nothing for prompt and completion.
export async function fetchFreeModels(): Promise<FreeModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Couldn't load OpenRouter's model list (${res.status}).`);
  const { data } = (await res.json()) as {
    data: {
      id: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
      architecture?: { output_modalities?: string[] };
    }[];
  };
  return data
    .filter((m) => Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)
    // Chat needs text back (no audio or image generators), and safety classifiers can't hold a conversation.
    .filter((m) => (m.architecture?.output_modalities ?? ['text']).every((o) => o === 'text') && !/safety|guard/i.test(m.id))
    .map((m) => ({
      id: m.id,
      name: m.id === ROUTER ? 'Auto: best available free model' : (m.name ?? m.id).replace(/\s*\(free\)\s*$/i, ''),
      context: m.context_length ?? 0,
    }))
    .sort((a, b) => rank(a.id) - rank(b.id) || b.context - a.context || a.name.localeCompare(b.name));
}

// Familiar labs first, so the auto-picked default is a sensible one.
const KNOWN = ['google/', 'openai/', 'deepseek/', 'qwen/', 'meta-llama/', 'mistralai/', 'nvidia/', 'z-ai/', 'moonshotai/'];
const ROUTER = 'openrouter/free';
const rank = (id: string) => {
  if (id === ROUTER) return -1;
  const i = KNOWN.findIndex((p) => id.startsWith(p));
  return i === -1 ? KNOWN.length : i;
};

// Gives up when nothing has arrived for this long, so the panel can't hang forever.
const IDLE_MS = 60000;

function systemPrompt(files: Record<string, string>) {
  const code = Object.entries(files)
    .map(([path, src]) => `--- ${path} ---\n${src}`)
    .join('\n\n');
  return [
    'You are the AI assistant in a practice code comprehension interview. The candidate leads; you assist.',
    [
      'Answer only what was asked.',
      'Do not summarise the whole codebase, review it, or list bugs unless the candidate asks for that.',
      'When they ask about a bug or a task, help them reason it through. Do not hand over a finished fix unless they ask for one.',
    ].join(' '),
    [
      'Format every reply as short, scannable Markdown:',
      '- Open with a one-line answer.',
      '- Follow with a few short bullets, or a small table when comparing things.',
      '- Put identifiers and file names in `inline code`, and code in fenced blocks with a language tag.',
      '- Use ## headings only when the reply has several distinct parts.',
      '- Stay under 150 words unless they ask for more.',
    ].join('\n'),
    'You can be wrong, and the candidate is expected to check your claims against the code. If you are unsure, say so in one short line.',
    "The candidate's current files:",
    code,
  ].join('\n\n');
}

interface Request {
  model: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  // Pulls the new text out of one streamed event. Returns '' for events with none.
  text: (data: string) => string;
}

const parse = (data: string): Record<string, any> => {
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

function build(provider: Provider, apiKey: string, model: string, files: Record<string, string>, messages: ChatMessage[]): Request {
  const system = systemPrompt(files);
  if (provider === 'gemini') {
    // Google's current Interactions API. Its docs don't spell out stateless multi-turn input, so the
    // instructions and the conversation so far go in as one plain-text input.
    const transcript = messages.map((m) => `${m.role === 'user' ? 'Candidate' : 'Assistant'}: ${m.content}`).join('\n\n');
    return {
      model,
      url: 'https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: {
        model: model.replace(/^models\//, ''),
        input: `${system}\n\n---\n\nConversation so far (reply to the last Candidate message only):\n\n${transcript}`,
        stream: true,
        store: false,
      },
      text: (data) => {
        const ev = parse(data);
        if (ev.event_type === 'error') throw new Error(ev.error?.message ?? 'Gemini returned an error.');
        // Thought and bookkeeping events are skipped. Only visible text deltas count.
        return ev.event_type === 'step.delta' && ev.delta?.type === 'text' ? ev.delta.text : '';
      },
    };
  }
  if (provider === 'anthropic') {
    return {
      model,
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: { model, max_tokens: 2000, stream: true, system, messages },
      text: (data) => {
        const ev = parse(data);
        if (ev.type === 'error') throw new Error(ev.error?.message ?? 'Claude returned an error.');
        return ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' ? ev.delta.text : '';
      },
    };
  }
  return {
    model,
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, 'x-title': 'Code Comprehension' },
    body: { model, stream: true, messages: [{ role: 'system', content: system }, ...messages] },
    text: (data) => {
      if (data === '[DONE]') return '';
      const ev = parse(data);
      if (ev.error) throw new Error(ev.error.message ?? 'OpenRouter returned an error.');
      return ev.choices?.[0]?.delta?.content ?? '';
    },
  };
}

// Server-sent events: blocks separated by a blank line, payload on "data:" lines.
async function* events(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new Error('The response had no body to read.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const split = (flush: boolean) => {
    const out: string[] = [];
    const blocks = buf.split(/\r?\n\r?\n/);
    buf = flush ? '' : (blocks.pop() ?? '');
    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n');
      if (data) out.push(data);
    }
    return out;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    yield* split(false);
  }
  yield* split(true);
}

async function failure(res: Response): Promise<Error> {
  let detail = '';
  try {
    detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
  } catch {
    // body wasn't JSON
  }
  const rejected = res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(detail));
  return new Error(rejected ? 'That API key was rejected.' : detail || `Request failed (${res.status}).`);
}

// Called straight from the browser with the candidate's own key. The key never
// leaves their machine except to go to the provider they picked. `onToken` gets
// each new piece of the reply as it streams in.
export async function askAssistant(
  provider: Provider,
  apiKey: string,
  model: string,
  files: Record<string, string>,
  messages: ChatMessage[],
  onToken: (text: string) => void,
): Promise<void> {
  const label = PROVIDERS[provider].label;
  const req = build(provider, apiKey, model || PROVIDERS[provider].defaultModel, files, messages);
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ctl.abort(), IDLE_MS);
  };
  arm();
  let connected = false;
  let gotText = false;
  try {
    const res = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: ctl.signal,
    });
    connected = true;
    if (!res.ok) throw await failure(res);
    for await (const data of events(res)) {
      arm();
      const piece = req.text(data);
      if (piece) {
        gotText = true;
        onToken(piece);
      }
    }
  } catch (e) {
    if (ctl.signal.aborted) {
      const secs = IDLE_MS / 1000;
      throw new Error(
        !connected
          ? `${label} didn't answer within ${secs}s. The model (${req.model}) may be unavailable or overloaded, so try another.`
          : gotText
            ? `${label} stopped partway through its reply (silent for ${secs}s). Try again.`
            : `${label} connected but sent no text for ${secs}s. Try again or pick another model.`,
      );
    }
    // fetch only throws a bare TypeError when it never got a response at all.
    if (e instanceof TypeError) throw new Error(`Couldn't reach ${label}. Check your connection and key.`);
    throw e;
  } finally {
    clearTimeout(timer!);
  }
}
