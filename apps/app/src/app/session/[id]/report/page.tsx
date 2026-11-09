import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/design-system/components/ui/alert";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { notFound, redirect } from "next/navigation";
import { NavLink } from "../../../../components/NavLink";
import { withUserDb } from "../../../../lib/db/client";
import { getSession, listReports } from "../../../../lib/db/queries";
import type { LearningReport } from "../../../../lib/reports/schema";
import { requireUser } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: report states (missing, incomplete, complete) share one page
export default async function ReportPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const { userId } = await requireUser();
	if (!userId) {
		redirect(`/login?next=/session/${id}/report`);
	}
	const session = await withUserDb(userId, (db) => getSession(db, id));
	if (!session) {
		notFound();
	}
	const reports = await withUserDb(userId, (db) => listReports(db, id));
	const latest = reports[0];
	const body = (latest?.body ?? null) as LearningReport | null;

	return (
		<main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
			<p className="text-muted-foreground text-sm">
				<NavLink className="underline" href="/">
					Exercises
				</NavLink>{" "}
				· {session.exercise_id} · session {session.status}
			</p>
			<h1 className="font-semibold text-2xl">Learning report</h1>
			{latest ? null : (
				<Alert>
					<AlertTitle>No report yet</AlertTitle>
					<AlertDescription>
						Finish a running session to generate a review.
					</AlertDescription>
				</Alert>
			)}
			{latest && latest.status !== "complete" ? (
				<Alert variant="destructive">
					<AlertTitle>{latest.status}</AlertTitle>
					<AlertDescription>
						{latest.error ??
							"Report is not complete. Session evidence was kept."}
					</AlertDescription>
				</Alert>
			) : null}
			{body ? (
				<>
					<Card>
						<CardHeader>
							<CardTitle>Summary</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							<p className="text-muted-foreground text-sm">
								Coaching summary is not a measured result. Outcome, usage, and
								test counts come from stored observations.
							</p>
							<p>{body.summary}</p>
							<p>
								<strong>Observed outcome:</strong> {body.outcome.observed}
							</p>
							<p>
								<strong>Verification:</strong> {body.outcome.verification} (
								{body.outcome.verificationProvenance})
							</p>
							{body.observations ? (
								<p>
									<strong>Stored test observations:</strong>{" "}
									{body.observations.tests.found
										? `${body.observations.tests.passed} passed, ${body.observations.tests.failed} failed of ${body.observations.tests.total}`
										: "no browser harness run recorded"}
								</p>
							) : null}
						</CardContent>
					</Card>
					{body.suggestions.map((suggestion) => (
						<Card key={suggestion.title}>
							<CardHeader>
								<CardTitle>{suggestion.title}</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-2">
								<p>{suggestion.detail}</p>
								<p>
									<strong>Improved example:</strong>{" "}
									{suggestion.improvedExample}
								</p>
								<p>
									<strong>Why it helps:</strong> {suggestion.whyItHelps}
								</p>
								<p className="text-muted-foreground text-sm">
									{suggestion.illustrative
										? "Illustrative recommendation"
										: "Recommendation (not a measured result)"}{" "}
									· cites{" "}
									{suggestion.citations
										.map((citation) => citation.evidenceId)
										.join(", ")}
								</p>
							</CardContent>
						</Card>
					))}
					<Card>
						<CardHeader>
							<CardTitle>Usage</CardTitle>
						</CardHeader>
						<CardContent>
							<p>
								Trainer: input {body.usage.trainer.inputTokens ?? "unknown"},
								output {body.usage.trainer.outputTokens ?? "unknown"}, cached{" "}
								{body.usage.trainer.cachedTokens ?? "unknown"} (
								{body.usage.trainer.coverage})
							</p>
							<p>
								Review: input {body.usage.review.inputTokens ?? "unknown"},
								output {body.usage.review.outputTokens ?? "unknown"}, cached{" "}
								{body.usage.review.cachedTokens ?? "unknown"} (
								{body.usage.review.coverage})
							</p>
							{body.usage.incomplete ? (
								<p className="text-muted-foreground text-sm">
									Coverage is incomplete.
								</p>
							) : null}
						</CardContent>
					</Card>
				</>
			) : null}
		</main>
	);
}
