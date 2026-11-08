import { notFound, redirect } from "next/navigation";
import RoundScreen from "../../../components/RoundScreen";
import { getChallenge } from "../../../lib/challenges";
import { withUserDb } from "../../../lib/db/client";
import { getSession, getSnapshotRound } from "../../../lib/db/queries";
import { challengeFromSnapshot } from "../../../lib/snapshot";
import { requireUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SessionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const { userId } = await requireUser();
	if (!userId) {
		redirect(`/login?next=/session/${id}`);
	}
	const session = await withUserDb(userId, (db) => getSession(db, id));
	if (!session) {
		notFound();
	}
	if (session.status === "complete") {
		redirect(`/session/${id}/report`);
	}
	const current = getChallenge(session.exercise_id);
	if (!current) {
		notFound();
	}
	const snapshot = await withUserDb(userId, (db) => getSnapshotRound(db, id));
	const challenge = snapshot
		? challengeFromSnapshot(current, snapshot)
		: current;
	const files =
		session.files && Object.keys(session.files).length > 0
			? session.files
			: challenge.starter;
	return (
		<RoundScreen
			challenge={challenge}
			initialFiles={files}
			initialUpdatedAt={session.updated_at}
			sessionId={session.id}
			startedAt={new Date(session.started_at ?? session.created_at).getTime()}
		/>
	);
}
