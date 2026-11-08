'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { taskStatus } from '../lib/runner';
import { clearSession, loadSession, type Session } from '../lib/storage';
import type { ChallengeMeta } from '../lib/types';

const STEPS = [
  ['Read', 'You get a codebase you have never seen, with a README that says how it should behave.'],
  ['Break', 'Some of it is wrong. Find the bugs, then add a feature that fits the existing design.'],
  ['Speed up', 'One piece is too slow. Fix it without changing what it returns.'],
  ['Use the AI, don’t trust it', 'An assistant can see your files. It is also sometimes wrong, and checking it is part of the job.'],
];

export default function Home({ challenges }: { challenges: ChallengeMeta[] }) {
  const router = useRouter();
  // Sessions live in localStorage, so they only exist once we're in the browser.
  const [sessions, setSessions] = useState<Record<string, Session | null> | null>(null);

  useEffect(() => {
    setSessions(Object.fromEntries(challenges.map((c) => [c.id, loadSession(c.id)])));
  }, [challenges]);

  const open = (c: ChallengeMeta) => router.push(`/round/${c.id}`);
  const restart = (c: ChallengeMeta) => {
    clearSession(c.id);
    open(c);
  };

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="logo static">
          <span>//</span> code comprehension
        </div>
        <a href="#how">how it works</a>
        <a href="#rounds">pick a round</a>
      </nav>

      <section className="hero">
        <p className="eyebrow">practice for the code comprehension round</p>
        <h1>
          Reading code is a <mark>skill</mark>.<br />
          Train it like one.
        </h1>
        <p className="lede">
          Sixty minutes. A codebase you didn&rsquo;t write. Bugs to find, a feature to add, a slow function to fix, and
          an AI that may or may not be right. Same shape as the round, on your own time.
        </p>
        <a className="btn lime big" href="#rounds">
          Start a round
        </a>
      </section>

      <section id="how" className="how">
        {STEPS.map(([title, body], i) => (
          <div key={title} className="step" style={{ ['--tilt' as string]: `${(i % 2 ? 1 : -1) * (0.6 + i * 0.25)}deg` }}>
            <span className="step-n">{i + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </section>

      <section id="rounds" className="rounds">
        <h2>Pick a round</h2>
        <div className="cards">
          {challenges.map((c) => {
            const s = sessions?.[c.id];
            const solved = s?.results ? c.tasks.filter((t) => taskStatus(t.id, s.results).status === 'solved').length : 0;
            return (
              <article key={c.id} className="card">
                <div className="card-top">
                  <span className="pill">{c.difficulty}</span>
                  <span className="pill outline">{c.minutes} min</span>
                </div>
                <h3>{c.title}</h3>
                <p>{c.blurb}</p>
                <ul>
                  {c.tasks.map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </ul>
                <div className="card-actions">
                  {sessions && !s && (
                    <button className="btn lime" onClick={() => open(c)}>
                      Start
                    </button>
                  )}
                  {s && !s.finishedAt && (
                    <>
                      <button className="btn lime" onClick={() => open(c)}>
                        Resume
                      </button>
                      <button className="btn ghost" onClick={() => restart(c)}>
                        Restart
                      </button>
                    </>
                  )}
                  {s?.finishedAt && (
                    <>
                      <button className="btn pink" onClick={() => router.push(`/results/${c.id}`)}>
                        {solved}/{c.tasks.length} solved · see results
                      </button>
                      <button className="btn ghost" onClick={() => restart(c)}>
                        Try again
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer>
        <p>
          Unofficial. Not made by or connected to Google. The format is based on what candidates and prep sites have
          publicly described, and Google can change it whenever. Check with your recruiter for what your loop uses.
        </p>
      </footer>
    </div>
  );
}
