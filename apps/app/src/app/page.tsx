import { redirect } from "next/navigation";
import { AppNav } from "../components/AppNav";
import { ExerciseHome } from "../components/ExerciseHome";
import { listChallenges } from "../lib/challenges";
import { requireUser } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		redirect("/login");
	}
	const { data } = await supabase.auth.getUser();
	return (
		<>
			<AppNav email={data.user?.email} />
			<ExerciseHome challenges={listChallenges()} />
		</>
	);
}
