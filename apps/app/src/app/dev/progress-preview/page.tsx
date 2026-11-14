import { HabitsPanel } from "../../../components/HabitsPanel";
import { ProgressPreviewFrame } from "../../../components/ProgressPreviewFrame";
import { ProgressScreen } from "../../../components/ProgressScreen";
import { ProgressSkeleton } from "../../../components/ProgressSkeleton";
import { emptyHabitsView, seededHabitsView } from "../../../lib/habits/fixture";
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
				<ProgressScreen habits={emptyHabitsView()} view={emptyProgressView()} />
			</ProgressPreviewFrame>
		);
	}
	if (view === "habits") {
		return (
			<ProgressPreviewFrame theme={theme}>
				<main className="mx-auto grid min-w-0 max-w-6xl gap-10 px-4 py-10">
					<header className="grid gap-3">
						<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
							How you used AI
						</p>
						<h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
							Progress
						</h1>
					</header>
					<HabitsPanel habits={seededHabitsView()} />
				</main>
			</ProgressPreviewFrame>
		);
	}
	return (
		<ProgressPreviewFrame theme={theme}>
			<ProgressScreen habits={seededHabitsView()} view={seededProgressView()} />
		</ProgressPreviewFrame>
	);
}
