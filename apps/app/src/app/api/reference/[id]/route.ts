import { NextResponse } from 'next/server';
import { getReference } from '../../../../lib/challenges';

// Served on request from the results page, so it isn't bundled into the round itself.
// It isn't secret: anyone who knows the URL can read it, which is fine for a practice tool.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const files = getReference(id);
  if (!files) return NextResponse.json({ error: 'Unknown challenge' }, { status: 404 });
  return NextResponse.json(files);
}
