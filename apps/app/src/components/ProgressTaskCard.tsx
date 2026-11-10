import { Badge } from "@repo/design-system/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Sparkles } from "lucide-react";
import { usageCopy } from "../lib/progress/aggregate";
import {
	originLabel,
	provenanceLabel,
	type TokenMeterSegment,
	tokenAmount,
	tokenMeterSegments,
} from "../lib/progress/display";
import type { ProgressTask } from "../lib/progress/types";

function segmentLabel(key: TokenMeterSegment["key"]): string {
	switch (key) {
		case "cached":
			return "Cached";
		case "input":
			return "Input";
		case "output":
			return "Output";
		default: {
			const exhaustive: never = key;
			throw new Error(`Unhandled meter segment: ${String(exhaustive)}`);
		}
	}
}

export function TokenMeter({ task }: { task: ProgressTask }) {
	const segments = tokenMeterSegments(task.usage);
	if (!segments) {
		return (
			<p className="text-muted-foreground text-sm">
				Token counts were not reported. Totals are omitted, not shown as 0.
			</p>
		);
	}
	return (
		<div className="grid gap-2">
			<p className="sr-only">{provenanceLabel(task.usage.label)} token mix</p>
			<div className="flex h-3 overflow-hidden rounded-full bg-muted">
				{segments.map((segment) => (
					<span
						className="h-full"
						key={segment.key}
						style={{
							background: segment.color,
							width: `${String(segment.pct)}%`,
						}}
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-sm">
				{segments.map((segment) => (
					<span className="inline-flex items-center gap-1.5" key={segment.key}>
						<span
							className="size-2 rounded-full"
							style={{ background: segment.color }}
						/>
						{segmentLabel(segment.key)} {tokenAmount(segment.value)}
					</span>
				))}
			</div>
			<p className="text-muted-foreground text-sm">
				{usageCopy(task.usage, task.source)}
			</p>
		</div>
	);
}

export function ProgressTaskCard({ task }: { task: ProgressTask }) {
	const noneCopy =
		task.source === "editor"
			? "No learning report yet. Close the editor task to assemble one from captured prompts."
			: "No learning report yet. Finish the session to generate one.";
	const top = task.suggestions[0] ?? null;
	return (
		<Card className="shadow-sm transition-shadow hover:shadow-md">
			<CardHeader className="gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle className="text-base">
						<a
							className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
							href={task.reportHref}
						>
							{task.exerciseId}
						</a>
					</CardTitle>
					<Badge variant="secondary">{originLabel(task.origin)}</Badge>
					<Badge variant="outline">{provenanceLabel(task.usage.label)}</Badge>
					<Badge variant="outline">
						{task.prompts.length}{" "}
						{task.prompts.length === 1 ? "prompt" : "prompts"}
					</Badge>
				</div>
				<CardDescription className="capitalize">{task.status}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4 text-sm">
				{task.prompts[0] ? (
					<pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-mono text-sm">
						{task.prompts[0]}
					</pre>
				) : (
					<p className="text-muted-foreground">
						No prompts were stored for this task.
					</p>
				)}
				<TokenMeter task={task} />
				<p>
					<span className="text-muted-foreground">Outcome · </span>
					{task.outcome?.observed ?? "No outcome stored yet."}
				</p>
				{top ? (
					<div className="grid gap-1 rounded-xl border bg-muted/40 p-3">
						<p className="flex items-center gap-2 font-medium text-sm">
							<Sparkles aria-hidden className="size-4 text-[var(--chart-4)]" />
							Try next
						</p>
						<p>
							{top.title}. {top.improvedExample}
						</p>
					</div>
				) : (
					<p className="text-muted-foreground">
						{task.outcome
							? "No prompt improvement stored for this task."
							: noneCopy}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
