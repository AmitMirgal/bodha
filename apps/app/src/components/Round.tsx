'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { type BeforeMount } from '@monaco-editor/react';
import AiPanel from './AiPanel';
import { fmtClock } from '../lib/format';
import { runTests, taskStatus, type TestResult } from '../lib/runner';
import { saveSession, type Session } from '../lib/storage';
import { isReadOnly, type Challenge } from '../lib/types';

interface Props {
  challenge: Challenge;
  session: Session;
  onChange: (s: Session) => void;
  onFinish: (s: Session) => void;
  onExit: () => void;
}

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('code-comprehension', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b6b78', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff4d8d' },
      { token: 'string', foreground: 'c6ff3d' },
      { token: 'number', foreground: 'ffb84d' },
    ],
    colors: {
      'editor.background': '#121216',
      'editor.lineHighlightBackground': '#1a1a20',
      'editorLineNumber.foreground': '#4a4a55',
      'editorLineNumber.activeForeground': '#c6ff3d',
      'editor.selectionBackground': '#c6ff3d33',
    },
  });
};

export default function Round({ challenge, session, onChange, onFinish, onExit }: Props) {
  const paths = Object.keys(session.files);
  const [active, setActive] = useState(paths.find((p) => p === 'README.md') ?? paths[0]);
  const [running, setRunning] = useState(false);
  const [fatal, setFatal] = useState('');
  const [aiOpen, setAiOpen] = useState(true);
  const [aiWidth, setAiWidth] = useState(() => {
    try {
      return Number(localStorage.getItem('cc.aiWidth')) || 380;
    } catch {
      return 380;
    }
  });
  const dragging = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [now, setNow] = useState(Date.now());
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const finished = useRef(false);

  const deadline = session.startedAt + challenge.minutes * 60000;
  const left = deadline - now;

  const update = useCallback(
    (patch: Partial<Session>) => {
      const next = { ...sessionRef.current, ...patch };
      sessionRef.current = next;
      saveSession(next);
      onChange(next);
    },
    [onChange],
  );

  const run = useCallback(async (): Promise<TestResult[]> => {
    setRunning(true);
    setFatal('');
    const out = await runTests(sessionRef.current.files, challenge.tests);
    setRunning(false);
    setFatal(out.fatal ?? '');
    update({ results: out.results, runs: sessionRef.current.runs + 1 });
    return out.results;
  }, [challenge.tests, update]);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    const results = await run();
    onFinish({ ...sessionRef.current, results, finishedAt: Date.now() });
  }, [run, onFinish]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (left <= 0) void finish();
  }, [left, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const results = session.results;
  const urgent = left < 5 * 60000;

  // Keep the editor at least ~300px wide, and the panel at least 280px.
  const clampWidth = (w: number) => Math.round(Math.min(Math.max(w, 280), Math.max(280, window.innerWidth - 290 - 300)));
  const onDrag = (e: React.PointerEvent) => {
    if (dragging.current) setAiWidth(clampWidth(window.innerWidth - e.clientX));
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.classList.remove('resizing');
    try {
      localStorage.setItem('cc.aiWidth', String(aiWidth));
    } catch {
      // not saved, still resized
    }
  };

  return (
    <div className={`round ${aiOpen ? '' : 'no-ai'}`} style={{ ['--ai-w' as string]: `${aiWidth}px` }}>
      <header className="bar">
        <button className="logo" onClick={onExit} title="Back to challenges (your progress is saved)">
          <span>//</span> code comprehension
        </button>
        <div className="bar-title">{challenge.title}</div>
        <div className={`clock ${urgent ? 'urgent' : ''}`}>{fmtClock(left)}</div>
        <button className="btn ghost" onClick={() => setAiOpen((v) => !v)}>
          {aiOpen ? 'Hide AI' : 'Show AI'}
        </button>
        <button className="btn lime" onClick={() => void run()} disabled={running}>
          {running ? 'Running…' : 'Run tests'} <kbd>Ctrl ↵</kbd>
        </button>
        <button
          className={`btn ${confirming ? 'pink' : 'ghost'}`}
          onClick={() => (confirming ? void finish() : setConfirming(true))}
          onBlur={() => setConfirming(false)}
        >
          {confirming ? 'Sure? Submit' : 'Submit'}
        </button>
      </header>

      <aside className="side">
        <section>
          <h4>Tasks</h4>
          <ol className="tasks">
            {challenge.tasks.map((t, i) => {
              const s = taskStatus(t.id, results);
              return (
                <li key={t.id} className={s.status}>
                  <div className="task-top">
                    <span className="task-n">{i + 1}</span>
                    <strong>{t.title}</strong>
                    <span className="task-state">
                      {s.status === 'solved' ? 'done' : s.status === 'failing' ? `${s.passed}/${s.total}` : ''}
                    </span>
                  </div>
                  <p>{t.brief}</p>
                </li>
              );
            })}
          </ol>
        </section>
        <section>
          <h4>Files</h4>
          <ul className="files">
            {paths.map((p) => (
              <li key={p}>
                <button className={p === active ? 'on' : ''} onClick={() => setActive(p)}>
                  {p}
                  {isReadOnly(p) && <em>read-only</em>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <main className="work">
        <div className="editor">
          <Editor
            path={active}
            language={active.endsWith('.md') ? 'markdown' : 'javascript'}
            value={session.files[active]}
            theme="code-comprehension"
            beforeMount={defineTheme}
            onChange={(v) => update({ files: { ...sessionRef.current.files, [active]: v ?? '' } })}
            options={{
              readOnly: isReadOnly(active),
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 14,
              automaticLayout: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 14 },
              wordWrap: active.endsWith('.md') ? 'on' : 'off',
              renderLineHighlight: 'line',
            }}
          />
        </div>
        <Console results={results} fatal={fatal} challenge={challenge} running={running} />
      </main>

      {aiOpen && (
        <>
          <div
            className="resizer"
            style={{ right: aiWidth - 4 }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize AI panel"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              document.body.classList.add('resizing');
            }}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => setAiWidth(380)}
          />
          <AiPanel files={session.files} onPrompt={() => update({ prompts: sessionRef.current.prompts + 1 })} />
        </>
      )}
    </div>
  );
}

function Console({
  results,
  fatal,
  challenge,
  running,
}: {
  results?: TestResult[];
  fatal: string;
  challenge: Challenge;
  running: boolean;
}) {
  return (
    <div className="console">
      <div className="console-head">
        <h4>Tests</h4>
        {results && results.length > 0 && (
          <span className="muted">
            {results.filter((r) => r.pass).length}/{results.length} passing
          </span>
        )}
        {running && <span className="muted">running…</span>}
      </div>
      <div className="console-body">
        {fatal && <div className="fatal">{fatal}</div>}
        {!results && !fatal && <p className="muted">Nothing run yet. Hit Run tests (Ctrl + Enter) whenever you want to check your work.</p>}
        {results &&
          challenge.tasks.map((t) => {
            const mine = results.filter((r) => r.task === t.id);
            if (!mine.length) return null;
            return (
              <div key={t.id} className="group">
                <h5>{t.title}</h5>
                {mine.map((r, i) => (
                  <div key={i} className={`t ${r.pass ? 'ok' : 'bad'}`}>
                    <span className="dot" />
                    <div>
                      <div>{r.name}</div>
                      {r.error && <code>{r.error}</code>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}
