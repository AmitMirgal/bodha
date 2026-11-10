import { CaptureViewerPreview } from "../../../../components/CaptureViewerPreview";
import { ProgressPreviewFrame } from "../../../../components/ProgressPreviewFrame";
import { seededCaptureViewerTasks } from "../../../../lib/progress/fixture";

export const dynamic = "force-dynamic";

export default async function ProgressPreviewDevicePage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string }>;
}) {
	const params = await searchParams;
	const theme = params.theme === "dark" ? "dark" : "light";
	return (
		<ProgressPreviewFrame email={null} theme={theme}>
			<CaptureViewerPreview
				loginHref="/login?next=/dev/progress-preview/claim"
				tasks={seededCaptureViewerTasks()}
			/>
		</ProgressPreviewFrame>
	);
}
