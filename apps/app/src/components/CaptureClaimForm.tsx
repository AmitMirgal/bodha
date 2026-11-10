"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { useState } from "react";
import { runBackground } from "../lib/background";

export function CaptureClaimForm({ token }: { token: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	async function claim() {
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/capture/v1/account/claim", {
				body: JSON.stringify({ token }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			const body = (await response.json().catch(() => ({}))) as {
				error?: string;
				redirectTo?: string;
			};
			if (!response.ok) {
				setError(body.error ?? "Could not link this device.");
				return;
			}
			window.location.assign(body.redirectTo ?? "/progress");
		} catch {
			setError("Could not link this device.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
			<header className="grid gap-3">
				<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					Account claim
				</p>
				<h1 className="font-semibold text-3xl tracking-tight">
					Link this device to your account
				</h1>
				<p className="text-muted-foreground">
					Past and future captured tasks from this editor will appear in
					Progress. Capture in the extension stays anonymous. This uses a
					short-lived one-time code, not the long-lived device secret.
				</p>
			</header>
			<Card className="shadow-sm">
				<CardHeader>
					<CardTitle>Confirm this editor</CardTitle>
					<CardDescription>
						The device secret is never placed in this URL. Linking does not
						change capture on the device until you choose to keep it.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3">
					<Button
						aria-busy={busy}
						disabled={busy}
						onClick={() => runBackground(claim())}
						size="lg"
						type="button"
					>
						{busy ? "Linking…" : "Link this device"}
					</Button>
					{error ? (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					) : null}
				</CardContent>
			</Card>
		</main>
	);
}
