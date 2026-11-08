'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fmtClock } from '../lib/format';
import { taskStatus } from '../lib/runner';
import { clearSession, loadSession, type Session } from '../lib/storage';
import type { ChallengeMeta } from '../lib/types';

const REFLECT = [
  'Did you read the README before touching any code?',
  'Did you check what the AI told you, or paste it in and hope?',
  'When a test failed, did you work out why before changing things?',
  'Could you explain every line you changed to an interviewer?',
];

export default function Results({ challenge }: { challenge: ChallengeMeta }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [reference, setReference] = useState<Record<string, string> | null>(null);
  const [refFile, setRefFile] = useState('');
  const [refError, setRefError] = useState('');
  const [loadingRef, setLoadingRef] = useState(false);
  const [showRef, setShowRef] = useState(false);

  useEffect(() => {
    const s = loadSession(challenge.id);
    // Nothing finished here (a fresh browser, or a direct link): send them somewhere useful.
    if (!s?.finishedAt) router.replace(s ? `/round/${challenge.id}` : '/');
    else setSession(s);
  }, [challenge.id, router]);

  // The reference solution is only fetched when asked for, so it isn't sitting in the page up front.
  async function toggleRef() {
    if (showRef) return setShowRef(false);
    setShowRef(true);
    if (reference || loadingRef) return;
    setLoadingRef(true);
    setRefError('');
    try {
      const res = await fetch(`/api/reference/${challenge.id}`);
      if (!res.ok) throw new Error();
      const files = (await res.json()) as Record<string, string>;
      setReference(files);
      setRefFile(Object.keys(files).find((p) => p !== 'README.md') ?? '');
    } catch {
      setRefError("Couldn't load the reference solution.");
    } finally {
      setLoadingRef(false);
    }
  }

  if (!session) return null;

  const results = session.results ?? [];
  const passed = results.filter((r) => r.pass).length;
  const solved = challenge.tasks.filter((t) => taskStatus(t.id, results).status === 'solved').length;
  const spent = Math.min((session.finishedAt ?? Date.now()) - session.startedAt, challenge.minutes * 60000);
  const refPaths = Object.keys(reference ?? {}).filter((p) => p !== 'README.md');

  return (
    <div className="results">
      <nav className="home-nav">
        <Link className="logo" href="/">
          <span>//</span> code comprehension
        </Link>
      </nav>

      <header>
        <p className="eyebrow">{challenge.title} · finished</p>
        <h1>
          {solved === challenge.tasks.length ? 'Clean sweep.' : `${solved} of ${challenge.tasks.length} tasks solved.`}
        </h1>
      </header>

      <section className="stats">
        <div>
          <strong>{fmtClock(spent)}</strong>
          <span>time used</span>
        </div>
        <div>
          <strong>
            {passed}/{results.length}
          </strong>
          <span>tests passing</span>
        </div>
        <div>
          <strong>{session.runs}</strong>
          <span>test runs</span>
        </div>
        <div>
          <strong>{session.prompts}</strong>
          <span>AI prompts</span>
        </div>
      </section>

      <section className="breakdown">
        {challenge.tasks.map((t) => {
          const s = taskStatus(t.id, results);
          return (
            <div key={t.id} className={`row-task ${s.status}`}>
              <span className="dot" />
              <strong>{t.title}</strong>
              <span className="muted">
                {s.passed}/{s.total} tests
              </span>
            </div>
          );
        })}
      </section>

      <section className="reflect">
        <h2>Ask yourself</h2>
        <p className="muted">Passing tests is the easy half. In the real round someone is watching how you got there.</p>
        <ul>
          {REFLECT.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>

      <section className="reference">
        <button className="btn ghost" onClick={() => void toggleRef()}>
          {showRef ? 'Hide the reference solution' : 'Show the reference solution'}
        </button>
        {showRef && loadingRef && <p className="muted">loading…</p>}
        {showRef && refError && <p className="ai-error">{refError}</p>}
        {showRef && reference && (
          <div className="ref-box">
            <div className="ref-tabs">
              {refPaths.map((p) => (
                <button key={p} className={p === refFile ? 'on' : ''} onClick={() => setRefFile(p)}>
                  {p}
                </button>
              ))}
            </div>
            <pre>{reference[refFile]}</pre>
          </div>
        )}
      </section>

      <div className="end-actions">
        <button
          className="btn lime"
          onClick={() => {
            clearSession(challenge.id);
            router.push(`/round/${challenge.id}`);
          }}
        >
          Try it again
        </button>
        <Link className="btn ghost" href="/">
          All rounds
        </Link>
      </div>
    </div>
  );
}
