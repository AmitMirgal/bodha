import { notFound } from 'next/navigation';
import RoundScreen from '../../../components/RoundScreen';
import { getChallenge } from '../../../lib/challenges';

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = getChallenge(id);
  if (!challenge) notFound();
  return <RoundScreen challenge={challenge} />;
}
