import { ProgressPreviewFrame } from "../../../components/ProgressPreviewFrame";
import { SettingsScreen } from "../../../components/SettingsScreen";

export const dynamic = "force-dynamic";

function parseTheme(value: string | undefined): "dark" | "light" {
	return value === "dark" ? "dark" : "light";
}

export default async function SettingsPreviewPage({
	searchParams,
}: {
	searchParams: Promise<{ theme?: string }>;
}) {
	const params = await searchParams;
	return (
		<ProgressPreviewFrame theme={parseTheme(params.theme)}>
			<SettingsScreen email="learner@example.test" />
		</ProgressPreviewFrame>
	);
}
