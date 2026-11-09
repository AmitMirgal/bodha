import { redirect } from "next/navigation";
import { ExerciseHome } from "../../components/ExerciseHome";
import { listChallenges } from "../../lib/challenges";
import { requireUser } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
	const { userId } = await requireUser();
	if (!userId) {
		redirect("/login");
	}
	return <ExerciseHome challenges={listChallenges()} />;
}
