"use client";

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { runBackground } from "../lib/background";
import type { ChallengeMeta } from "../lib/types";

interface SessionRow {
	exercise_id: string;
	finished_at: string | null;
	id: string;
	started_at: string | null;
	status: string;
}

const DISCLOSURE = [
	"Prompts and assistant replies from this session",
	"The frozen exercise snapshot and the code you save",
	"Browser test-run summaries (not a certificate)",
	"Provider-reported token usage when the endpoint returns it",
];

export function ExerciseHome({ challenges }: { challenges: ChallengeMeta[] }) {
	const router = useRouter();
	const [sessions, setSessions] = useState<SessionRow[]>([]);
	const [pending, setPending] = useState<ChallengeMeta | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		runBackground(
			fetch("/api/sessions")
				.then((response) => response.json())
				.then((body) => setSessions(body.sessions ?? []))
				.catch(() => setSessions([]))
		);
	}, []);

	const latestFor = (exerciseId: string) =>
		sessions.find((session) => session.exercise_id === exerciseId);

	async function start(challenge: ChallengeMeta) {
		setError("");
		const created = await fetch("/api/sessions", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ exerciseId: challenge.id }),
		});
		const body = await created.json();
		if (!created.ok) {
			setError(body.error ?? "Could not create session.");
			return;
		}
		const started = await fetch(`/api/sessions/${body.session.id}/start`, {
			method: "POST",
		});
		const startedBody = await started.json();
		if (!started.ok) {
			setError(startedBody.error ?? "Could not start session.");
			return;
		}
		router.push(`/session/${body.session.id}`);
	}

	return (
		<main className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
			<section className="grid gap-2">
				<p className="text-muted-foreground text-sm uppercase tracking-wide">
					Individual learning
				</p>
				<h1 className="font-semibold text-3xl">
					Learn from how you use AI on coding tasks
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Two manually maintained exercises. Edit in the browser, run the
					harness, chat with a tool-using trainer, then revisit an
					evidence-grounded report. This is not a Google interview replica.
				</p>
			</section>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Could not start</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{pending ? (
				<Alert>
					<AlertTitle>Before this session is captured</AlertTitle>
					<AlertDescription>
						<p className="mb-2">
							BODHA stores the following for you only, until you delete the
							account or we apply the documented retention window:
						</p>
						<ul className="mb-3 list-disc pl-5">
							{DISCLOSURE.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
						<p className="mb-3">
							Selected context is sent to the LLM endpoint you configured. There
							is no covert monitoring. Capture starts only after you confirm.
						</p>
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={() => runBackground(start(pending))}
								type="button"
							>
								I understand — start session
							</Button>
							<Button
								onClick={() => setPending(null)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						</div>
					</AlertDescription>
				</Alert>
			) : null}

			<div className="grid gap-4 md:grid-cols-2">
				{challenges.map((challenge) => {
					const session = latestFor(challenge.id);
					return (
						<Card key={challenge.id}>
							<CardHeader>
								<CardTitle>{challenge.title}</CardTitle>
								<CardDescription>
									{challenge.difficulty} · {challenge.minutes} min
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-3">
								<p>{challenge.blurb}</p>
								<ul className="list-disc pl-5 text-muted-foreground text-sm">
									{challenge.tasks.map((task) => (
										<li key={task.id}>{task.title}</li>
									))}
								</ul>
								<div className="flex flex-wrap gap-2">
									{session?.status === "running" ? (
										<Button
											onClick={() => router.push(`/session/${session.id}`)}
											type="button"
										>
											Resume
										</Button>
									) : (
										<Button onClick={() => setPending(challenge)} type="button">
											Start
										</Button>
									)}
									{session?.status === "complete" ? (
										<Button
											onClick={() =>
												router.push(`/session/${session.id}/report`)
											}
											type="button"
											variant="secondary"
										>
											View report
										</Button>
									) : null}
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</main>
	);
}
