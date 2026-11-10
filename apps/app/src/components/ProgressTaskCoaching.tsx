import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Sparkles } from "lucide-react";
import type { ProgressSuggestion, ProgressTask } from "../lib/progress/types";

function SuggestionCompare({
	original,
	suggestion,
}: {
	original: string;
	suggestion: ProgressSuggestion;
}) {
	return (
		<Card className="border-[color-mix(in_oklch,var(--chart-4)_28%,transparent)] shadow-sm">
			<CardHeader>
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle className="text-lg">{suggestion.title}</CardTitle>
					<Badge variant="outline">AI suggestion</Badge>
				</div>
				<CardDescription>
					{suggestion.illustrative
						? "Illustrative recommendation, not a measured skill score."
						: "Recommendation grounded in stored evidence, not a causal claim."}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				{suggestion.detail ? <p>{suggestion.detail}</p> : null}
				<div className="grid gap-4 md:grid-cols-2">
					<div className="grid gap-2 rounded-xl bg-muted/60 p-4">
						<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
							Original prompt
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
				</div>
				<p>
					<span className="text-muted-foreground">Why it may help · </span>
					{suggestion.whyItHelps}
				</p>
			</CardContent>
		</Card>
	);
}

export function ProgressTaskCoaching({ task }: { task: ProgressTask }) {
	const original = task.prompts[0] ?? task.promptTurns[0]?.text ?? "";
	if (task.needsKey && task.suggestions.length === 0) {
		return (
			<section
				aria-labelledby="coaching"
				className="grid gap-4 rounded-2xl border border-dashed bg-muted/30 p-6"
			>
				<div className="flex flex-wrap items-center gap-2">
					<Sparkles aria-hidden className="size-5 text-[var(--chart-4)]" />
					<h2 className="font-semibold text-2xl tracking-tight" id="coaching">
						Coaching
					</h2>
					<Badge variant="secondary">Facts only</Badge>
				</div>
				<p>
					Facts below are stored observations and labelled estimates. Coaching
					needs your saved BYOK key. Suggestions are never invented when no key
					is stored.
				</p>
				<Button asChild className="w-fit" size="lg">
					<a href="/settings">Add a key in Settings</a>
				</Button>
			</section>
		);
	}
	return (
		<section
			aria-labelledby="coaching"
			className="grid gap-6 rounded-2xl border border-[color-mix(in_oklch,var(--chart-4)_32%,transparent)] bg-[color-mix(in_oklch,var(--chart-4)_8%,transparent)] p-6"
		>
			<div className="grid gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<Sparkles aria-hidden className="size-5 text-[var(--chart-4)]" />
					<h2 className="font-semibold text-2xl tracking-tight" id="coaching">
						Coaching
					</h2>
					<Badge>AI suggestions</Badge>
				</div>
				<p className="text-muted-foreground text-sm">
					Suggestions are recommendations grounded in the stored prompts, not
					measured skill scores or causal claims.
				</p>
			</div>
			<div className="grid gap-2 rounded-xl bg-background/80 p-4">
				<p className="font-medium text-sm uppercase tracking-wide">
					What worked
				</p>
				{task.coachingSummary ? (
					<p className="text-base">{task.coachingSummary}</p>
				) : (
					<p className="text-muted-foreground text-sm">
						No coaching stored yet.
					</p>
				)}
			</div>
			<div className="grid gap-3">
				<h3 className="font-medium text-lg">Improvements</h3>
				{task.suggestions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No prompt improvement stored for this task.
					</p>
				) : (
					task.suggestions.map((suggestion, index) => (
						<SuggestionCompare
							key={suggestion.title}
							original={task.prompts[index] ?? original}
							suggestion={suggestion}
						/>
					))
				)}
			</div>
		</section>
	);
}
