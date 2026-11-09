import { ProgressPreviewFrame } from "../../../components/ProgressPreviewFrame";
import { ProgressScreen } from "../../../components/ProgressScreen";
import { ProgressSkeleton } from "../../../components/ProgressSkeleton";
import {
	emptyProgressView,
	seededProgressView,
} from "../../../lib/progress/fixture";

export const dynamic = "force-dynamic";

function parseTheme(value: string | undefined): "dark" | "light" {
	return value === "dark" ? "dark" : "light";
}

export default async function ProgressPreviewPage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string; view?: string }>;
}) {
	const params = await searchParams;
	const theme = parseTheme(params.theme);
	const view = params.view ?? "seeded";
	if (view === "loading") {
		return (
			<ProgressPreviewFrame theme={theme}>
				<ProgressSkeleton />
			</ProgressPreviewFrame>
		);
	}
	if (view === "empty") {
		return (
			<ProgressPreviewFrame theme={theme}>
				<ProgressScreen view={emptyProgressView()} />
			</ProgressPreviewFrame>
		);
	}
	return (
		<ProgressPreviewFrame theme={theme}>
			<ProgressScreen view={seededProgressView()} />
		</ProgressPreviewFrame>
	);
}
