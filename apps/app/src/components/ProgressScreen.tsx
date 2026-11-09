import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ProgressTask, ProgressView } from "../lib/progress/types";
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

function TaskCard({ task }: { task: ProgressTask }) {
	return (
		<li className="grid gap-3 border-t pt-3 first:border-t-0 first:pt-0">
			<p>
				<a className="underline" href={task.reportHref}>
					{task.exerciseId}
				</a>{" "}
				· {task.status}
			</p>
			<p className="text-sm">{usageCopy(task.usage)}</p>
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
				<p className="text-muted-foreground text-sm">
					No learning report yet. Finish the session to generate one.
				</p>
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
					{task.tests?.found ? (
						<p>
							Stored test observations: {task.tests.passed} passed,{" "}
							{task.tests.failed} failed of {task.tests.total}.
						</p>
					) : (
						<p className="text-muted-foreground">
							No browser harness run recorded.
						</p>
					)}
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

export function ProgressScreen({ view }: { view: ProgressView }) {
	const measuredMax = Math.max(
		0,
		...view.trend.map(
			(point) =>
				(point.measuredInputTokens ?? 0) + (point.measuredOutputTokens ?? 0)
		)
	);
	return (
		<main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
			<h1 className="font-semibold text-2xl">Progress</h1>
			<p className="text-muted-foreground text-sm">
				Days are bucketed in {view.timezone}. Token totals include only
				vendor-reported trainer usage. Missing counts are labeled, not guessed.
				This page is not a skill score.
			</p>
			{view.days.length === 0 ? (
				<p>
					No trainer tasks yet. Finish an exercise to see prompts, tokens, and
					coaching here.
				</p>
			) : (
				<>
					<Card>
						<CardHeader>
							<CardTitle>Measured trainer tokens over time</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3">
							<p className="text-muted-foreground text-sm">
								Bars use vendor-reported input plus output. Days with no
								measured counts show as a gap, not a zero.
							</p>
							<ul className="grid gap-2">
								{view.trend.map((point) => (
									<li className="grid gap-1" key={point.date}>
										<div className="flex justify-between gap-4 text-sm">
											<span>{point.date}</span>
											<span>
												{point.taskCount}{" "}
												{point.taskCount === 1 ? "task" : "tasks"}
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
					{view.days.map((day) => (
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
			)}
		</main>
	);
}
