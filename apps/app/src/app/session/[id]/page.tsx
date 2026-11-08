import { notFound, redirect } from "next/navigation";
import RoundScreen from "../../../components/RoundScreen";
import { getChallenge } from "../../../lib/challenges";
import { challengeFromSnapshot } from "../../../lib/snapshot";
import { requireUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SessionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const { supabase, userId } = await requireUser();
	if (!userId) {
		redirect(`/login?next=/session/${id}`);
	}
	const { data: session } = await supabase
		.from("sessions")
		.select("*")
		.eq("id", id)
		.eq("user_id", userId)
		.maybeSingle();
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
	const { data: snapshot } = await supabase
		.from("exercise_snapshots")
		.select("exercise_id, spec_markdown, tests_source, starter, meta")
		.eq("session_id", id)
		.eq("user_id", userId)
		.maybeSingle();
	const challenge = snapshot
		? challengeFromSnapshot(current, snapshot)
		: current;
	const files =
		session.files && Object.keys(session.files as object).length > 0
			? (session.files as Record<string, string>)
			: challenge.starter;
	return (
		<RoundScreen
			challenge={challenge}
			initialFiles={files}
			initialUpdatedAt={session.updated_at as string}
			sessionId={session.id}
			startedAt={new Date(session.started_at ?? session.created_at).getTime()}
		/>
	);
}
