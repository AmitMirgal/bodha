"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { runBackground } from "../lib/background";
import type { Challenge } from "../lib/types";
import { markNavigating } from "./NavigationProgress";
import Round from "./Round";

export default function RoundScreen({
	challenge,
	sessionId,
	initialFiles,
	initialUpdatedAt,
	startedAt,
}: {
	challenge: Challenge;
	sessionId: string;
	initialFiles: Record<string, string>;
	initialUpdatedAt?: string;
	startedAt: number;
}) {
	const router = useRouter();
	const [files, setFiles] = useState(initialFiles);
	const [saveError, setSaveError] = useState("");
	const [conflict, setConflict] = useState(false);
	const expectedUpdatedAt = useRef(initialUpdatedAt);
	const saveChain = useRef(Promise.resolve());
	const filesRef = useRef(files);
	filesRef.current = files;

	const persist = useCallback(
		async (nextFiles: Record<string, string>) => {
			const response = await fetch(`/api/sessions/${sessionId}/save`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					files: nextFiles,
					expectedUpdatedAt: expectedUpdatedAt.current,
				}),
			});
			const body = await response.json().catch(() => ({}));
			if (response.status === 409 && body.code === "revision_conflict") {
				setConflict(true);
				setSaveError(body.error ?? "This session was updated elsewhere.");
				return;
			}
			if (!response.ok) {
				setSaveError(body.error ?? "Save failed. Retry to persist your edits.");
				return;
			}
			if (typeof body.saved?.updated_at === "string") {
				expectedUpdatedAt.current = body.saved.updated_at;
			}
			setConflict(false);
			setSaveError("");
		},
		[sessionId]
	);

	const enqueuePersist = useCallback(
		(nextFiles: Record<string, string>) => {
			saveChain.current = saveChain.current
				.catch(() => undefined)
				.then(() => persist(nextFiles));
			return saveChain.current;
		},
		[persist]
	);

	return (
		<>
			{conflict ? (
				<div className="fatal">
					Saved revision conflict. Reload to take the stored copy, or retry to
					write these files again.
					<button
						className="btn ghost"
						onClick={() => router.refresh()}
						type="button"
					>
						Reload
					</button>
					<button
						className="btn lime"
						onClick={() => {
							expectedUpdatedAt.current = undefined;
							setConflict(false);
							runBackground(enqueuePersist(filesRef.current));
						}}
						type="button"
					>
						Retry save
					</button>
				</div>
			) : null}
			<Round
				challenge={challenge}
				enqueue={enqueuePersist}
				expectedUpdatedAt={expectedUpdatedAt}
				files={files}
				onExit={() => {
					markNavigating();
					router.push("/exercises");
				}}
				onFiles={(next) => {
					setFiles(next);
					runBackground(enqueuePersist(next));
				}}
				onFinish={() => {
					markNavigating();
					router.push(`/session/${sessionId}/report`);
				}}
				onSavedAt={(updatedAt) => {
					expectedUpdatedAt.current = updatedAt;
				}}
				saveError={saveError}
				sessionId={sessionId}
				startedAt={startedAt}
			/>
		</>
	);
}
