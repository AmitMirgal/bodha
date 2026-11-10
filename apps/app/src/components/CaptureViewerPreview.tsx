import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import type { CaptureViewerTask } from "../lib/capture/html";
import { preferredUsage, usageCopy } from "../lib/capture/usage-copy";

export function CaptureViewerPreview({
	loginHref,
	tasks,
}: {
	loginHref: string;
	tasks: CaptureViewerTask[];
}) {
	const preview = tasks.slice(0, 3);
	return (
		<main className="mx-auto grid max-w-5xl gap-8 px-4 py-10">
			<header className="grid gap-4">
				<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					Signed-out preview
				</p>
				<h1 className="font-semibold text-3xl tracking-tight">
					Device preview
				</h1>
				<p className="max-w-3xl text-muted-foreground">
					This view is tied to this device, not a Mati account. Cursor hooks do
					not report vendor token counts. Any number below is a labelled
					text-length estimate (text_estimate), not vendor-measured, and
					undercounts. Sign in to keep these tasks and generate a learning
					report.
				</p>
				<Button asChild className="w-fit" size="lg">
					<a href={loginHref}>Sign in to keep this and get your report</a>
				</Button>
			</header>
			{preview.length === 0 ? (
				<p>No captured Agent prompts yet.</p>
			) : (
				<div className="grid gap-4 lg:grid-cols-2">
					{preview.map((task) => {
						const usage = preferredUsage(task.usage);
						const promptCount = task.prompts.length;
						return (
							<Card className="shadow-sm" key={task.id}>
								<CardHeader className="gap-3">
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="secondary">{task.editor}</Badge>
										<Badge variant="outline">{task.status}</Badge>
										<Badge variant="outline">Test data</Badge>
									</div>
									<CardTitle className="text-base">
										{task.editor} · {task.editorTaskId}
									</CardTitle>
									<CardDescription>
										{promptCount} {promptCount === 1 ? "prompt" : "prompts"}{" "}
										captured on this device
									</CardDescription>
								</CardHeader>
								<CardContent className="grid gap-3 text-sm">
									<p>{usageCopy(usage, task.editor)}</p>
									{task.prompts[0] ? (
										<pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-mono text-sm">
											{task.prompts[0]}
										</pre>
									) : (
										<p className="text-muted-foreground">
											No prompts stored for this task.
										</p>
									)}
									{task.filePaths.length > 0 ? (
										<p className="font-mono text-muted-foreground text-sm">
											{task.filePaths.join(" · ")}
										</p>
									) : null}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</main>
	);
}
