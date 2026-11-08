"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { runBackground } from "../lib/background";
import type { Challenge } from "../lib/types";
import Round from "./Round";

export default function RoundScreen({
	challenge,
	sessionId,
	initialFiles,
	startedAt,
}: {
	challenge: Challenge;
	sessionId: string;
	initialFiles: Record<string, string>;
	startedAt: number;
}) {
	const router = useRouter();
	const [files, setFiles] = useState(initialFiles);
	const [saveError, setSaveError] = useState("");

	const persist = useCallback(
		async (nextFiles: Record<string, string>) => {
			const response = await fetch(`/api/sessions/${sessionId}/save`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ files: nextFiles }),
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				setSaveError(body.error ?? "Save failed.");
				return;
			}
			setSaveError("");
		},
		[sessionId],
	);

	return (
		<Round
			challenge={challenge}
			files={files}
			onExit={() => router.push("/")}
			onFiles={(next) => {
				setFiles(next);
				runBackground(persist(next));
			}}
			onFinish={() => router.push(`/session/${sessionId}/report`)}
			saveError={saveError}
			sessionId={sessionId}
			startedAt={startedAt}
		/>
	);
}
