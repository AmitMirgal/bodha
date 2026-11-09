import { redirect } from "next/navigation";
import { ExerciseHome } from "../../../components/ExerciseHome";
import { listChallenges } from "../../../lib/challenges";
import { requireUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
	const { userId } = await requireUser();
	if (!userId) {
		redirect("/login?next=/exercises");
	}
	return <ExerciseHome challenges={listChallenges()} />;
}
