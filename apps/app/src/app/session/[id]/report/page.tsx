import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { notFound, redirect } from "next/navigation";
import { ProgressTaskDetail } from "../../../../components/ProgressTaskDetail";
import { withUserDb } from "../../../../lib/db/client";
import {
	getSession,
	listMessages,
	listReports,
} from "../../../../lib/db/queries";
import type {
	ProgressTask,
	ProgressUsage,
} from "../../../../lib/progress/types";
import type { LearningReport } from "../../../../lib/reports/schema";
import { requireUser } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function trainerUsage(body: LearningReport | null): ProgressUsage {
	const packed = body?.usage.trainer;
	const hasNumber =
		packed != null &&
		(packed.inputTokens != null ||
			packed.outputTokens != null ||
			packed.cachedTokens != null);
	if (!packed || packed.coverage === "unknown" || !hasNumber) {
		return {
			cachedTokens: null,
			coverage: "unknown",
			inputTokens: null,
			label: "missing",
			outputTokens: null,
		};
	}
	return {
		cachedTokens: packed.cachedTokens,
		coverage: packed.coverage,
		inputTokens: packed.inputTokens,
		label: "measured",
		outputTokens: packed.outputTokens,
	};
}

function reportStatus(
	status: string | undefined
): ProgressTask["reportStatus"] {
	if (!status) {
		return "none";
	}
	if (status === "complete") {
		return "complete";
	}
	if (status === "error" || status === "failed") {
		return "error";
	}
	return "pending";
}

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
	const messages = await withUserDb(userId, (db) => listMessages(db, id));
	const prompts = messages.filter((message) => message.role === "user");
	const latest = reports[0];
	const body = (latest?.body ?? null) as LearningReport | null;
	const usage = trainerUsage(body);
	const missingTurnUsage: ProgressUsage = {
		cachedTokens: null,
		coverage: "unknown",
		inputTokens: null,
		label: "missing",
		outputTokens: null,
	};
	const task: ProgressTask = {
		exerciseId: session.exercise_id,
		occurredAt: session.finished_at ?? session.started_at ?? session.created_at,
		origin: "trainer",
		outcome: body
			? {
					observed: body.outcome.observed,
					verification: body.outcome.verification,
					verificationProvenance: body.outcome.verificationProvenance,
				}
			: null,
		prompts: prompts.map((prompt) => prompt.content),
		promptTurns: prompts.map((prompt) => ({
			occurredAt: prompt.created_at,
			text: prompt.content,
			usage: missingTurnUsage,
		})),
		reportHref: `/session/${id}/report`,
		reportStatus: reportStatus(latest?.status),
		sessionId: session.id,
		source: "trainer",
		status: session.status,
		suggestions: body
			? body.suggestions.map((suggestion) => ({
					illustrative: suggestion.illustrative,
					improvedExample: suggestion.improvedExample,
					title: suggestion.title,
					whyItHelps: suggestion.whyItHelps,
				}))
			: [],
		tests: body
			? {
					failed: body.observations.tests.failed,
					found: body.observations.tests.found,
					passed: body.observations.tests.passed,
					total: body.observations.tests.total,
				}
			: null,
		usage,
	};
	return (
		<>
			{latest ? null : (
				<div className="mx-auto max-w-4xl px-4 pt-8">
					<Alert>
						<AlertTitle>No report yet</AlertTitle>
						<AlertDescription>
							Finish a running session to generate a review.
						</AlertDescription>
					</Alert>
				</div>
			)}
			{latest && latest.status !== "complete" ? (
				<div className="mx-auto max-w-4xl px-4 pt-8">
					<Alert variant="destructive">
						<AlertTitle>{latest.status}</AlertTitle>
						<AlertDescription>
							{latest.error ??
								"Report is not complete. Session evidence was kept."}
						</AlertDescription>
					</Alert>
				</div>
			) : null}
			<ProgressTaskDetail task={task} />
		</>
	);
}
