import { CaptureClaimForm } from "../../../../components/CaptureClaimForm";
import { ProgressPreviewFrame } from "../../../../components/ProgressPreviewFrame";

export const dynamic = "force-dynamic";

export default async function ProgressPreviewClaimPage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string }>;
}) {
	const params = await searchParams;
	const theme = params.theme === "dark" ? "dark" : "light";
	return (
		<ProgressPreviewFrame theme={theme}>
			<CaptureClaimForm token="preview-claim-token" />
		</ProgressPreviewFrame>
	);
}
