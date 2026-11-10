"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useState } from "react";
import { runBackground } from "../lib/background";

export function GenerateCaptureReportButton({
	label,
	taskId,
}: {
	label: string;
	taskId: string;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	async function generate() {
		setBusy(true);
		setError("");
		try {
			const response = await fetch(
				`/api/capture/v1/account/tasks/${taskId}/report`,
				{
					body: JSON.stringify({ force: true }),
					headers: { "content-type": "application/json" },
					method: "POST",
				}
			);
			const body = (await response.json().catch(() => ({}))) as {
				error?: string;
			};
			if (!response.ok) {
				setError(body.error ?? "Could not generate this report.");
				return;
			}
			window.location.reload();
		} catch {
			setError("Could not generate this report.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="grid gap-2">
			<Button
				aria-busy={busy}
				className="w-fit"
				disabled={busy}
				onClick={() => runBackground(generate())}
				type="button"
			>
				{busy ? "Generating…" : label}
			</Button>
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
