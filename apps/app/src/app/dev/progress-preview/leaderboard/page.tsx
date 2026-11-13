import { LeaderboardScreen } from "../../../../components/LeaderboardScreen";
import { ProgressPreviewFrame } from "../../../../components/ProgressPreviewFrame";
import {
	emptyLeaderboardView,
	seededLeaderboardView,
} from "../../../../lib/habits/fixture";

export const dynamic = "force-dynamic";

export default async function LeaderboardPreviewPage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string; view?: string }>;
}) {
	const params = await searchParams;
	const theme = params.theme === "dark" ? "dark" : "light";
	const view =
		params.view === "empty" ? emptyLeaderboardView() : seededLeaderboardView();
	return (
		<ProgressPreviewFrame theme={theme}>
			<LeaderboardScreen view={view} />
		</ProgressPreviewFrame>
	);
}
