import { ProgressPreviewFrame } from "../../../../components/ProgressPreviewFrame";
import { ProgressTaskDetail } from "../../../../components/ProgressTaskDetail";
import {
	seededDetailTask,
	seededFactsOnlyTask,
} from "../../../../lib/progress/fixture";

export const dynamic = "force-dynamic";

export default async function ProgressPreviewTaskPage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string; view?: string }>;
}) {
	const params = await searchParams;
	const theme = params.theme === "dark" ? "dark" : "light";
	const task =
		params.view === "nokey" ? seededFactsOnlyTask() : seededDetailTask();
	return (
		<ProgressPreviewFrame theme={theme}>
			<ProgressTaskDetail task={task} />
		</ProgressPreviewFrame>
	);
}
