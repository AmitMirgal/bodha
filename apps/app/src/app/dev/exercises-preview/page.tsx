import {
	ExerciseHome,
	type SessionRow,
} from "../../../components/ExerciseHome";
import { ProgressPreviewFrame } from "../../../components/ProgressPreviewFrame";
import { listChallenges } from "../../../lib/challenges";

export const dynamic = "force-dynamic";

function parseTheme(value: string | undefined): "dark" | "light" {
	return value === "dark" ? "dark" : "light";
}

export default async function ExercisesPreviewPage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string }>;
}) {
	const params = await searchParams;
	const challenges = listChallenges();
	const fixtureSessions: SessionRow[] = challenges.map((challenge, index) => ({
		exercise_id: challenge.id,
		finished_at: null,
		id: `preview-session-${index + 1}`,
		started_at: "2026-11-10T00:00:00.000Z",
		status: "running",
	}));
	return (
		<ProgressPreviewFrame theme={parseTheme(params.theme)}>
			<ExerciseHome challenges={challenges} fixtureSessions={fixtureSessions} />
		</ProgressPreviewFrame>
	);
}
