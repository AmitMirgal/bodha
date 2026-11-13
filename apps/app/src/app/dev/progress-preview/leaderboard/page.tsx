import { LeaderboardScreen } from "../../../../components/LeaderboardScreen";
import { ProgressPreviewFrame } from "../../../../components/ProgressPreviewFrame";
import { seededLeaderboardView } from "../../../../lib/habits/fixture";

export const dynamic = "force-dynamic";

export default async function LeaderboardPreviewPage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string }>;
}) {
	const params = await searchParams;
	const theme = params.theme === "dark" ? "dark" : "light";
	return (
		<ProgressPreviewFrame theme={theme}>
			<LeaderboardScreen view={seededLeaderboardView()} />
		</ProgressPreviewFrame>
	);
}
