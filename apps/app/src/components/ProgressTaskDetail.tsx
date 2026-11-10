import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Activity, Clock, Files, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import {
	durationLabel,
	formatTaskDate,
	isFixtureTestData,
	originLabel,
	provenanceLabel,
	reportKindLabel,
	reportKindVariant,
	tokenAmount,
	tokenCell,
	tokenSourceLabel,
} from "../lib/progress/display";
import type { ProgressTask } from "../lib/progress/types";
import { GenerateCaptureReportButton } from "./GenerateCaptureReportButton";
import { TokenMeter } from "./ProgressTaskCard";
import { ProgressTaskChart } from "./ProgressTaskChart";
import { ProgressTaskCoaching } from "./ProgressTaskCoaching";

function StatTile({
	detail,
	icon,
	label,
	value,
}: {
	detail: string;
	icon: ReactNode;
	label: string;
	value: string;
}) {
	return (
		<Card className="shadow-sm">
			<CardHeader className="gap-3">
				<div className="flex items-center gap-2 text-muted-foreground">
					{icon}
					<CardDescription>{label}</CardDescription>
				</div>
				<CardTitle className="font-semibold text-3xl tabular-nums tracking-tight">
					{value}
				</CardTitle>
				<p className="text-muted-foreground text-sm">{detail}</p>
			</CardHeader>
		</Card>
	);
}

export function ProgressTaskDetail({ task }: { task: ProgressTask }) {
	const generateLabel =
		task.reportStatus === "complete" ? "Regenerate report" : "Generate report";
	const duration = durationLabel(task.startedAt, task.finishedAt);
	return (
		<main className="mx-auto grid max-w-6xl gap-8 px-4 py-10">
			<p className="text-muted-foreground text-sm">
				<a className="underline-offset-4 hover:underline" href="/progress">
					Progress
				</a>{" "}
				· {originLabel(task.origin)}
			</p>
			<header className="grid gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="font-semibold text-3xl tracking-tight">
						{task.exerciseId}
					</h1>
					<Badge variant="secondary">{originLabel(task.origin)}</Badge>
					<Badge variant="outline">{formatTaskDate(task.occurredAt)}</Badge>
					<Badge className="capitalize" variant="outline">
						{task.status}
					</Badge>
					<Badge variant={reportKindVariant(task.reportKind)}>
						{reportKindLabel(task.reportKind)}
					</Badge>
					{isFixtureTestData(task) ? (
						<Badge variant="outline">Test data</Badge>
					) : null}
				</div>
				<p>
					<span className="text-muted-foreground">Observed · </span>
					{task.outcome?.observed ?? "No outcome stored yet."}
				</p>
				{task.outcome ? (
					<p className="text-muted-foreground text-sm">
						{task.outcome.verification} ({task.outcome.verificationProvenance})
					</p>
				) : null}
				<div className="flex flex-wrap items-center gap-3">
					{task.source === "editor" ? (
						<GenerateCaptureReportButton
							label={generateLabel}
							taskId={task.sessionId}
						/>
					) : null}
					{task.needsKey ? (
						<Button asChild variant="outline">
							<a href="/settings">Add a key in Settings</a>
						</Button>
					) : null}
				</div>
				{task.needsKey ? (
					<Alert>
						<AlertTitle>Facts only until a key is saved</AlertTitle>
						<AlertDescription>
							Token figures stay labelled estimates or vendor-measured counts.
							Coaching is omitted until you add a BYOK key in Settings.
						</AlertDescription>
					</Alert>
				) : null}
				{task.reportError ? (
					<p className="text-destructive text-sm" role="alert">
						{task.reportError}
					</p>
				) : null}
			</header>
			<section
				aria-label="Task summary"
				className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
			>
				<StatTile
					detail="Stored user prompts in this task."
					icon={<MessageSquare aria-hidden className="size-4" />}
					label="Prompts"
					value={String(task.prompts.length)}
				/>
				<StatTile
					detail={`Input · ${provenanceLabel(task.usage.label)}`}
					icon={<Activity aria-hidden className="size-4" />}
					label="Input tokens"
					value={tokenAmount(task.usage.inputTokens)}
				/>
				<StatTile
					detail={`Output · ${provenanceLabel(task.usage.label)}`}
					icon={<Activity aria-hidden className="size-4" />}
					label="Output tokens"
					value={tokenAmount(task.usage.outputTokens)}
				/>
				<StatTile
					detail="Paths captured from file_edit events."
					icon={<Files aria-hidden className="size-4" />}
					label="Files edited"
					value={String(task.filePaths.length)}
				/>
				<StatTile
					detail={
						duration
							? "Elapsed from startedAt to finishedAt."
							: "Duration was not stored for this task."
					}
					icon={<Clock aria-hidden className="size-4" />}
					label="Duration"
					value={duration ?? "Not stored"}
				/>
			</section>
			<ProgressTaskChart task={task} />
			<ProgressTaskCoaching task={task} />
			<section aria-labelledby="prompt-timeline" className="grid gap-4">
				<h2
					className="font-semibold text-xl tracking-tight"
					id="prompt-timeline"
				>
					Prompt timeline
				</h2>
				{task.promptTurns.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No prompts were stored for this task.
					</p>
				) : (
					<ol className="grid gap-4">
						{task.promptTurns.map((turn, index) => (
							<li
								className="flex gap-4"
								key={`${turn.occurredAt ?? "turn"}-${String(index)}`}
							>
								<div className="flex flex-col items-center">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background font-medium text-sm">
										{index + 1}
									</span>
									{index < task.promptTurns.length - 1 ? (
										<span className="mt-2 w-px flex-1 bg-border" />
									) : null}
								</div>
								<div className="grid min-w-0 flex-1 gap-3 rounded-xl border bg-card p-4 shadow-sm">
									<p className="text-muted-foreground text-sm">
										{turn.occurredAt ?? "time not stored"}
									</p>
									<pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-mono text-sm">
										{turn.text || "(empty prompt)"}
									</pre>
									<p className="text-muted-foreground text-sm">
										{turn.usage.label === "missing"
											? "Per-prompt vendor tokens were not stored. Task totals are labelled above."
											: `${tokenCell(turn.usage)} · ${provenanceLabel(turn.usage.label)}`}
									</p>
								</div>
							</li>
						))}
					</ol>
				)}
			</section>
			<section aria-labelledby="responses-summary" className="grid gap-4">
				<h2
					className="font-semibold text-xl tracking-tight"
					id="responses-summary"
				>
					Responses
				</h2>
				{task.responses.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No assistant responses were stored for this task.
					</p>
				) : (
					<ul className="grid gap-3">
						{task.responses.map((response) => (
							<li
								className="grid gap-2 rounded-xl border bg-card p-4"
								key={`${response.occurredAt}:${response.text.slice(0, 24)}`}
							>
								<p className="text-muted-foreground text-sm">
									{response.occurredAt}
								</p>
								<pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm">
									{response.text}
								</pre>
							</li>
						))}
					</ul>
				)}
			</section>
			<section aria-labelledby="edited-files" className="grid gap-4">
				<h2 className="font-semibold text-xl tracking-tight" id="edited-files">
					Edited files
				</h2>
				{task.filePaths.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No edited file paths were stored for this task.
					</p>
				) : (
					<ul className="grid gap-2 font-mono text-sm">
						{task.filePaths.map((path) => (
							<li className="rounded-lg border bg-card px-3 py-2" key={path}>
								{path}
							</li>
						))}
					</ul>
				)}
			</section>
			<section aria-labelledby="token-usage" className="grid gap-4">
				<h2 className="font-semibold text-xl tracking-tight" id="token-usage">
					Token usage
				</h2>
				<p className="text-muted-foreground text-sm">
					{tokenSourceLabel(task)}. Suggestions never invent token counts.
				</p>
				<TokenMeter task={task} />
			</section>
		</main>
	);
}
