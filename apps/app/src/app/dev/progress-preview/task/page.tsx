import { ProgressPreviewFrame } from "../../../../components/ProgressPreviewFrame";
import { ProgressTaskDetail } from "../../../../components/ProgressTaskDetail";
import { seededDetailTask } from "../../../../lib/progress/fixture";

export const dynamic = "force-dynamic";

export default async function ProgressPreviewTaskPage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string }>;
}) {
	const params = await searchParams;
	const theme = params.theme === "dark" ? "dark" : "light";
	return (
		<ProgressPreviewFrame theme={theme}>
			<ProgressTaskDetail task={seededDetailTask()} />
		</ProgressPreviewFrame>
	);
}
