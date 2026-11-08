'use client';

import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PROVIDERS, askAssistant, fetchFreeModels, type ChatMessage, type FreeModel } from '../lib/ai';
import { loadApiKey, loadModel, loadProvider, saveApiKey, saveModel, saveProvider, type Provider } from '../lib/storage';

interface Props {
  files: Record<string, string>;
  onPrompt: () => void;
}

const ALL = Object.keys(PROVIDERS) as Provider[];
const byProvider = <T,>(f: (p: Provider) => T) => Object.fromEntries(ALL.map((p) => [p, f(p)])) as Record<Provider, T>;

// Replies are Markdown. react-markdown builds real elements, so nothing the model sends is injected as HTML.
function Reply({ text }: { text: string }) {
  return (
    <div className="md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}
      >
        {text}
      </Markdown>
    </div>
  );
}

export default function AiPanel({ files, onPrompt }: Props) {
  const [provider, setProvider] = useState<Provider>(loadProvider);
  const [keys, setKeys] = useState(() => byProvider(loadApiKey));
  const [models, setModels] = useState(() => byProvider(loadModel));
  const [editing, setEditing] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [draftModel, setDraftModel] = useState('');
  // Each provider keeps its own conversation, so switching never shows another AI's answers.
  const [chats, setChats] = useState(() => byProvider<ChatMessage[]>(() => []));
  const [busyBy, setBusyBy] = useState(() => byProvider(() => false));
  const [errors, setErrors] = useState(() => byProvider(() => ''));
  const messages = chats[provider];
  const busy = busyBy[provider];
  const error = errors[provider];
  const [input, setInput] = useState('');
  const [freeModels, setFreeModels] = useState<FreeModel[] | null>(null);
  const [freeError, setFreeError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  const key = keys[provider];
  const info = PROVIDERS[provider];
  const model = models[provider] || info.defaultModel;
  const needsPicker = provider === 'openrouter' && !!key;

  // Once there's an OpenRouter key, load the free models and pick one if nothing is chosen yet.
  useEffect(() => {
    if (!needsPicker || freeModels) return;
    let live = true;
    fetchFreeModels()
      .then((list) => {
        if (!live) return;
        setFreeModels(list);
        setModels((all) => {
          if (all.openrouter || !list.length) return all;
          saveModel('openrouter', list[0].id);
          return { ...all, openrouter: list[0].id };
        });
      })
      .catch((e: unknown) => live && setFreeError(e instanceof Error ? e.message : 'Could not load models.'));
    return () => {
      live = false;
    };
  }, [needsPicker, freeModels]);

  function chooseModel(id: string) {
    saveModel(provider, id);
    setModels((all) => ({ ...all, [provider]: id }));
  }

  function pick(p: Provider) {
    setProvider(p);
    saveProvider(p);
    setEditing(false);
    setDraftKey('');
    setDraftModel('');
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    // Pin everything to the provider chosen now, since the user may switch tabs mid-reply.
    const p = provider;
    const before = chats[p];
    const setChat = (m: ChatMessage[]) => setChats((all) => ({ ...all, [p]: m }));
    const setError = (m: string) => setErrors((all) => ({ ...all, [p]: m }));
    const setBusy = (b: boolean) => setBusyBy((all) => ({ ...all, [p]: b }));
    if (p === 'openrouter' && !models.openrouter) {
      setError(freeError || 'Pick a model first. The list is still loading.');
      return;
    }
    const history: ChatMessage[] = [...before, { role: 'user', content: text }];
    setChat([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setError('');
    setBusy(true);
    onPrompt();
    let reply = '';
    try {
      await askAssistant(p, keys[p], models[p], files, history, (piece) => {
        reply += piece;
        setChat([...history, { role: 'assistant', content: reply }]);
      });
      if (!reply) throw new Error(`${PROVIDERS[p].label} sent back an empty reply. Try rephrasing.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      // Keep whatever streamed in. If nothing did, put the question back so it isn't lost.
      if (!reply) {
        setChat(before);
        setInput(text);
      }
    } finally {
      setBusy(false);
    }
  }

  const switcher = (
    <div className="seg" role="tablist" aria-label="AI provider">
      {ALL.map((p) => (
        <button key={p} role="tab" aria-selected={p === provider} className={p === provider ? 'on' : ''} onClick={() => pick(p)}>
          {PROVIDERS[p].label}
          {keys[p] && <i title="key saved" />}
        </button>
      ))}
    </div>
  );

  if (!key || editing) {
    return (
      <div className="ai ai-setup">
        <h3>AI sidekick</h3>
        {switcher}
        <p>
          The real round gives you an AI assistant, and part of what's judged is how you use it. Bring your own{' '}
          {info.label} API key to practise that.
        </p>
        <p className="muted">
          Get one at{' '}
          <a href={info.keyUrl} target="_blank" rel="noreferrer">
            {new URL(info.keyUrl).host}
          </a>
          . It stays in this browser and is only sent to {info.label}&rsquo;s API.
        </p>
        <label className="field">
          API key
          <input
            type="password"
            placeholder={key ? 'saved, leave blank to keep it' : info.placeholder}
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {provider === 'openrouter' ? (
          <p className="muted">After you save, you'll get a list of OpenRouter's free models to choose from.</p>
        ) : (
          <label className="field">
            Model
            <input
              placeholder={info.defaultModel}
              value={draftModel || models[provider]}
              onChange={(e) => setDraftModel(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
        <div className="row">
          <button
            className="btn lime"
            disabled={!draftKey.trim() && !key}
            onClick={() => {
              const k = draftKey.trim() || key;
              const m = (draftModel || models[provider]).trim();
              saveApiKey(provider, k);
              saveModel(provider, m);
              setKeys((all) => ({ ...all, [provider]: k }));
              setModels((all) => ({ ...all, [provider]: m }));
              setDraftKey('');
              setDraftModel('');
              setEditing(false);
            }}
          >
            Save
          </button>
          {editing && (
            <button className="btn ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
        <p className="muted">No key? The round works fine without one. Hard mode.</p>
      </div>
    );
  }

  const last = messages[messages.length - 1];
  const waiting = busy && last?.role === 'assistant' && !last.content;

  return (
    <div className="ai">
      <div className="ai-head">
        <h3>AI sidekick</h3>
        <button className="link" onClick={() => setEditing(true)} title={`Using ${model}`}>
          key &amp; model
        </button>
      </div>
      <div className="ai-switch">
        {switcher}
        {needsPicker && (
          <label className="field model-pick">
            Free models{freeModels ? ` (${freeModels.length})` : ''}
            {freeModels ? (
              <select value={models.openrouter} onChange={(e) => chooseModel(e.target.value)}>
                {!freeModels.some((m) => m.id === models.openrouter) && models.openrouter && (
                  <option value={models.openrouter}>{models.openrouter}</option>
                )}
                {freeModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.context ? ` · ${Math.round(m.context / 1000)}k` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="muted model-note">{freeError || 'loading…'}</span>
            )}
          </label>
        )}
      </div>
      <div className="ai-log">
        {messages.length === 0 && (
          <p className="muted">
            It can see all your files. It can also be confidently wrong, so check what it tells you against the code
            before you trust it.
          </p>
        )}
        {messages.map(
          (m, i) =>
            (m.role === 'user' || m.content) && (
              <div key={i} className={`bubble ${m.role}`}>
                {m.role === 'user' ? <p>{m.content}</p> : <Reply text={m.content} />}
              </div>
            ),
        )}
        {waiting && <div className="bubble assistant thinking">thinking…</div>}
        {error && <div className="ai-error">{error}</div>}
        <div ref={endRef} />
      </div>
      <form
        className="ai-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          rows={2}
          placeholder="Ask about the code…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn lime" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
