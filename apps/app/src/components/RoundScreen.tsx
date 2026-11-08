'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { loadSession, saveSession, type Session } from '../lib/storage';
import type { Challenge } from '../lib/types';
import Round from './Round';

const freshSession = (c: Challenge): Session => ({
  challengeId: c.id,
  startedAt: Date.now(),
  files: { ...c.starter },
  prompts: 0,
  runs: 0,
});

// Owns the saved session for a round: resumes it, or starts a new one.
export default function RoundScreen({ challenge }: { challenge: Challenge }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const saved = loadSession(challenge.id);
    if (saved?.finishedAt) {
      router.replace(`/results/${challenge.id}`);
      return;
    }
    const s = saved ?? freshSession(challenge);
    if (!saved) saveSession(s);
    setSession(s);
  }, [challenge, router]);

  const onFinish = useCallback(
    (done: Session) => {
      saveSession(done);
      router.push(`/results/${challenge.id}`);
    },
    [challenge.id, router],
  );

  if (!session) return <div className="boot" aria-busy="true" />;

  return (
    <Round
      key={session.startedAt}
      challenge={challenge}
      session={session}
      onChange={setSession}
      onFinish={onFinish}
      onExit={() => router.push('/')}
    />
  );
}
