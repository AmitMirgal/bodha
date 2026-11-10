import { MarketingHome } from "../components/Home";
import { listChallenges } from "../lib/challenges";
import { progressFixtureEnabled } from "../lib/progress/preview-gate";
import { requireUser } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ preview?: string }>;
}) {
	let email: string | null = null;
	try {
		const { supabase, userId } = await requireUser();
		if (userId) {
			const { data } = await supabase.auth.getUser();
			email = data.user?.email ?? null;
		}
	} catch {
		email = null;
	}
	const params = await searchParams;
	if (!email && progressFixtureEnabled() && params.preview === "signed-in") {
		email = "learner@example.test";
	}
	return <MarketingHome challenges={listChallenges()} email={email} />;
}
