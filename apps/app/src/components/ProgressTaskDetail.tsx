import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
	originLabel,
	provenanceLabel,
	tokenCell,
} from "../lib/progress/display";
import type { ProgressTask } from "../lib/progress/types";
import { GenerateCaptureReportButton } from "./GenerateCaptureReportButton";
import { TokenMeter } from "./ProgressTaskCard";

function tokenSourceLabel(task: ProgressTask): string {
	switch (task.usage.label) {
		case "estimated":
			return "text_estimate (labelled estimate from text length, not vendor-measured)";
		case "measured":
			return `vendor-measured (${task.usage.source ?? "provider"})`;
		case "missing":
			return "not reported (omitted, not shown as 0)";
		default: {
			const exhaustive: never = task.usage.label;
			throw new Error(`Unhandled token label: ${exhaustive}`);
		}
	}
}

export function ProgressTaskDetail({ task }: { task: ProgressTask }) {
	const original = task.prompts[0] ?? task.promptTurns[0]?.text ?? "";
	const generateLabel =
		task.reportStatus === "complete" ? "Regenerate report" : "Generate report";
	return (
		<main className="mx-auto grid max-w-4xl gap-10 px-4 py-10">
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
					<Badge variant="outline">{provenanceLabel(task.usage.label)}</Badge>
					<Badge variant="outline">
						{task.prompts.length}{" "}
						{task.prompts.length === 1 ? "prompt" : "prompts"}
					</Badge>
				</div>
				<TokenMeter task={task} />
				<p className="text-muted-foreground text-sm">
					Token source · {tokenSourceLabel(task)}
				</p>
				<p>
					<span className="text-muted-foreground">Observed · </span>
					{task.outcome?.observed ?? "No outcome stored yet."}
				</p>
				{task.outcome ? (
					<p className="text-muted-foreground text-sm">
						{task.outcome.verification} ({task.outcome.verificationProvenance})
					</p>
				) : null}
				{task.source === "editor" ? (
					<GenerateCaptureReportButton
						label={generateLabel}
						taskId={task.sessionId}
					/>
				) : null}
				{task.needsKey ? (
					<p className="text-muted-foreground text-sm">
						Facts below are stored observations and labelled estimates. Coaching
						needs your saved BYOK key.{" "}
						<a className="underline-offset-4 hover:underline" href="/settings">
							Add a key in Settings
						</a>
						.
					</p>
				) : null}
				{task.reportError ? (
					<p className="text-destructive text-sm" role="alert">
						{task.reportError}
					</p>
				) : null}
			</header>
			<Separator />
			<section aria-labelledby="prompt-timeline" className="grid gap-4">
				<h2 className="font-medium text-lg" id="prompt-timeline">
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
											: tokenCell(turn.usage)}
									</p>
								</div>
							</li>
						))}
					</ol>
				)}
			</section>
			<section aria-labelledby="responses-summary" className="grid gap-4">
				<h2 className="font-medium text-lg" id="responses-summary">
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
				<h2 className="font-medium text-lg" id="edited-files">
					Edited files
				</h2>
				{task.filePaths.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No edited file paths were stored for this task.
					</p>
				) : (
					<ul className="grid gap-2 font-mono text-sm">
						{task.filePaths.map((path) => (
							<li key={path}>{path}</li>
						))}
					</ul>
				)}
			</section>
			<section aria-labelledby="token-usage" className="grid gap-4">
				<h2 className="font-medium text-lg" id="token-usage">
					Token usage
				</h2>
				<p className="text-muted-foreground text-sm">
					{tokenSourceLabel(task)}. Suggestions never invent token counts.
				</p>
				<TokenMeter task={task} />
			</section>
			<section aria-labelledby="coaching" className="grid gap-4">
				<h2 className="font-medium text-lg" id="coaching">
					Coaching
				</h2>
				<p className="text-muted-foreground text-sm">
					Suggestions are recommendations grounded in the stored prompts, not
					measured skill scores or causal claims.
				</p>
				{task.coachingSummary ? (
					<p>{task.coachingSummary}</p>
				) : (
					<p className="text-muted-foreground text-sm">
						No coaching stored yet.
					</p>
				)}
			</section>
			<section aria-labelledby="prompt-improvements" className="grid gap-4">
				<h2 className="font-medium text-lg" id="prompt-improvements">
					Prompt improvements
				</h2>
				{task.suggestions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No prompt improvement stored for this task.
					</p>
				) : (
					task.suggestions.map((suggestion) => (
						<Card className="shadow-sm" key={suggestion.title}>
							<CardHeader>
								<CardTitle>{suggestion.title}</CardTitle>
								<CardDescription>
									{suggestion.illustrative
										? "Illustrative recommendation"
										: "Recommendation grounded in stored evidence"}
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-4 md:grid-cols-2">
								<div className="grid gap-2 rounded-xl bg-muted/50 p-4">
									<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
										Original
									</p>
									<pre className="whitespace-pre-wrap font-mono text-sm">
										{original || "No original prompt stored."}
									</pre>
								</div>
								<div className="grid gap-2 rounded-xl border border-[color-mix(in_oklch,var(--chart-2)_40%,transparent)] bg-card p-4">
									<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
										Improved example
									</p>
									<pre className="whitespace-pre-wrap font-mono text-sm">
										{suggestion.improvedExample}
									</pre>
								</div>
								<p className="md:col-span-2">
									<span className="text-muted-foreground">
										Why it may help ·{" "}
									</span>
									{suggestion.whyItHelps}
								</p>
							</CardContent>
						</Card>
					))
				)}
			</section>
			{task.source === "editor" && task.needsKey ? (
				<p>
					<Button asChild variant="outline">
						<a href="/settings">Add a key in Settings</a>
					</Button>
				</p>
			) : null}
		</main>
	);
}
