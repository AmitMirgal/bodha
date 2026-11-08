import { notFound, redirect } from "next/navigation";
import RoundScreen from "../../../components/RoundScreen";
import { getChallenge } from "../../../lib/challenges";
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
	const challenge = getChallenge(session.exercise_id);
	if (!challenge) {
		notFound();
	}
	return (
		<RoundScreen
			challenge={challenge}
			initialFiles={session.files as Record<string, string>}
			sessionId={session.id}
			startedAt={new Date(session.started_at ?? session.created_at).getTime()}
		/>
	);
}
