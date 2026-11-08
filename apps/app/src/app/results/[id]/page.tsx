import { notFound } from 'next/navigation';
import Results from '../../../components/Results';
import { getMeta } from '../../../lib/challenges';

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = getMeta(id);
  if (!challenge) notFound();
  return <Results challenge={challenge} />;
}
