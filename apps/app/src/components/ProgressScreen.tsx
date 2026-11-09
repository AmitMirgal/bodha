import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import type {
	ProgressSection,
	ProgressTask,
	ProgressView,
} from "../lib/progress/types";
import { usageCopy } from "../lib/progress/view";

function tokenBarWidth(
	point: {
		measuredInputTokens: number | null;
		measuredOutputTokens: number | null;
	},
	max: number
): string {
	if (max <= 0) {
		return "0%";
	}
	const value =
		(point.measuredInputTokens ?? 0) + (point.measuredOutputTokens ?? 0);
	return `${Math.round((value / max) * 100)}%`;
}

function harnessCopy(task: ProgressTask) {
	if (task.source === "editor") {
		return (
			<p className="text-muted-foreground">
				No browser harness run recorded for editor capture.
			</p>
		);
	}
	if (!task.tests?.found) {
		return (
			<p className="text-muted-foreground">No browser harness run recorded.</p>
		);
	}
	return (
		<p>
			Stored test observations: {task.tests.passed} passed, {task.tests.failed}{" "}
			failed of {task.tests.total}.
		</p>
	);
}

function TaskCard({ task }: { task: ProgressTask }) {
	const noneCopy =
		task.source === "editor"
			? "No learning report yet. Close the editor task to assemble one from captured prompts."
			: "No learning report yet. Finish the session to generate one.";
	return (
		<li className="grid gap-3 border-t pt-3 first:border-t-0 first:pt-0">
			<p>
				<a className="underline" href={task.reportHref}>
					{task.exerciseId}
				</a>{" "}
				· {task.status}
			</p>
			<p className="text-sm">{usageCopy(task.usage, task.source)}</p>
			<div>
				<h3 className="font-medium text-sm">Prompts</h3>
				{task.prompts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No prompts were stored for this task.
					</p>
				) : (
					<ul className="grid gap-2">
						{task.prompts.map((prompt) => (
							<li
								className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 font-mono text-sm"
								key={`${task.sessionId}:${prompt}`}
							>
								{prompt}
							</li>
						))}
					</ul>
				)}
			</div>
			{task.reportStatus === "none" ? (
				<p className="text-muted-foreground text-sm">{noneCopy}</p>
			) : null}
			{task.reportStatus === "error" ? (
				<p className="text-sm">
					The learning report did not complete. Session evidence was kept.
				</p>
			) : null}
			{task.reportStatus === "pending" ? (
				<p className="text-muted-foreground text-sm">
					A learning report is still running.
				</p>
			) : null}
			{task.outcome ? (
				<div className="grid gap-1 text-sm">
					<p>
						<strong>Outcome:</strong> {task.outcome.observed}
					</p>
					<p>
						<strong>Verification:</strong> {task.outcome.verification} (
						{task.outcome.verificationProvenance})
					</p>
					{harnessCopy(task)}
				</div>
			) : null}
			{task.suggestions.length > 0 ? (
				<div className="grid gap-2">
					<h3 className="font-medium text-sm">Prompt improvements</h3>
					{task.suggestions.map((suggestion) => (
						<div className="grid gap-1 text-sm" key={suggestion.title}>
							<p className="font-medium">{suggestion.title}</p>
							<p>
								<strong>Improved example:</strong> {suggestion.improvedExample}
							</p>
							<p>
								<strong>Why it helps:</strong> {suggestion.whyItHelps}
							</p>
							<p className="text-muted-foreground">
								{suggestion.illustrative
									? "Illustrative recommendation"
									: "Recommendation grounded in stored evidence"}
							</p>
						</div>
					))}
				</div>
			) : null}
		</li>
	);
}

function TrendCard({
	section,
	title,
}: {
	section: ProgressSection;
	title: string;
}) {
	const measuredMax = Math.max(
		0,
		...section.trend.map(
			(point) =>
				(point.measuredInputTokens ?? 0) + (point.measuredOutputTokens ?? 0)
		)
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<p className="text-muted-foreground text-sm">
					Bars use vendor-reported input plus output. Estimated and missing
					counts are labelled and stay out of the bar. Days with no measured
					counts show as a gap, not a zero.
				</p>
				<ul className="grid gap-2">
					{section.trend.map((point) => (
						<li className="grid gap-1" key={point.date}>
							<div className="flex justify-between gap-4 text-sm">
								<span>{point.date}</span>
								<span>
									{point.taskCount} {point.taskCount === 1 ? "task" : "tasks"}
									{point.measuredInputTokens == null
										? " · tokens not reported"
										: ` · ${point.measuredInputTokens} in / ${point.measuredOutputTokens} out`}
								</span>
							</div>
							<div className="h-2 rounded-full bg-muted">
								{point.measuredInputTokens == null ? null : (
									<div
										className="h-2 rounded-full bg-primary"
										style={{
											width: tokenBarWidth(point, measuredMax),
										}}
									/>
								)}
							</div>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

function DayCards({ section }: { section: ProgressSection }) {
	return (
		<>
			{section.days.map((day) => (
				<Card key={day.date}>
					<CardHeader>
						<CardTitle>{day.date}</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="grid gap-4">
							{day.tasks.map((task) => (
								<TaskCard key={task.sessionId} task={task} />
							))}
						</ul>
					</CardContent>
				</Card>
			))}
		</>
	);
}

export function ProgressScreen({ view }: { view: ProgressView }) {
	const trainer: ProgressSection = { days: view.days, trend: view.trend };
	return (
		<main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
			<h1 className="font-semibold text-2xl">Progress</h1>
			<p className="text-muted-foreground text-sm">
				Days are bucketed in {view.timezone}. Trainer and editor tasks are
				listed separately. Token totals include only vendor-reported usage.
				Missing and estimated counts are labeled, not mixed into the measured
				bars. This page is not a skill score.
			</p>
			<section aria-labelledby="progress-trainer" className="grid gap-4">
				<h2 className="font-semibold text-xl" id="progress-trainer">
					Trainer
				</h2>
				{trainer.days.length === 0 ? (
					<p>
						No trainer tasks yet. Finish an exercise to see prompts, tokens, and
						coaching here.
					</p>
				) : (
					<>
						<TrendCard
							section={trainer}
							title="Measured trainer tokens over time"
						/>
						<DayCards section={trainer} />
					</>
				)}
			</section>
			<section aria-labelledby="progress-editor" className="grid gap-4">
				<h2 className="font-semibold text-xl" id="progress-editor">
					Editor
				</h2>
				{view.editor.days.length === 0 ? (
					<p>
						No claimed editor tasks yet. Claim a device from Settings to see
						editor prompts and token labels here.
					</p>
				) : (
					<>
						<TrendCard
							section={view.editor}
							title="Measured editor tokens over time"
						/>
						<DayCards section={view.editor} />
					</>
				)}
			</section>
		</main>
	);
}
