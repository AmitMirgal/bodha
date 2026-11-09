"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { type FormEvent, useEffect, useState } from "react";
import { runBackground } from "../lib/background";

export function CursorAdminSettingsForm() {
	const [apiKey, setApiKey] = useState("");
	const [fingerprint, setFingerprint] = useState<string | null>(null);
	const [encryptionReady, setEncryptionReady] = useState(true);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		runBackground(
			fetch("/api/cursor-admin-settings")
				.then((response) => response.json())
				.then(
					(body: {
						encryptionReady?: boolean;
						keyFingerprint?: string | null;
					}) => {
						setEncryptionReady(Boolean(body.encryptionReady));
						setFingerprint(body.keyFingerprint ?? null);
					}
				)
		);
	}, []);

	async function save(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/cursor-admin-settings", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ apiKey }),
			});
			const body = (await response.json()) as {
				error?: string;
				keyFingerprint?: string;
			};
			if (!response.ok) {
				setError(body.error ?? "Could not store the Cursor Admin API key.");
				return;
			}
			setFingerprint(body.keyFingerprint ?? null);
			setApiKey("");
			setMessage(
				"Stored. Editor tasks can join conversationId to Cursor Admin usage. The key never leaves this account ciphertext."
			);
		} finally {
			setBusy(false);
		}
	}

	async function remove() {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/cursor-admin-settings", {
				method: "DELETE",
			});
			if (!response.ok) {
				setError("Could not remove the Cursor Admin API key.");
				return;
			}
			setFingerprint(null);
			setMessage("Removed. Cursor usage stays estimated or missing.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cursor Admin API</CardTitle>
				<CardDescription>
					Optional team key. Encrypted like your BYOK provider keys. Without it,
					Cursor token counts stay estimated or missing. This is not stored in
					the editor extension.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					className="grid gap-4"
					onSubmit={(event) => runBackground(save(event))}
				>
					{encryptionReady ? null : (
						<p className="text-destructive text-sm">
							MATI_CREDENTIALS_ENCRYPTION_KEY is not set. Refusing to store this
							key.
						</p>
					)}
					{fingerprint ? (
						<p className="text-sm">
							Saved fingerprint <code>{fingerprint}</code>
						</p>
					) : (
						<p className="text-muted-foreground text-sm">
							No Cursor Admin key stored.
						</p>
					)}
					<div className="grid gap-2">
						<Label htmlFor="cursor-admin-key">Team Admin API key</Label>
						<Input
							autoComplete="off"
							id="cursor-admin-key"
							onChange={(event) => setApiKey(event.target.value)}
							type="password"
							value={apiKey}
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button disabled={busy || !encryptionReady} type="submit">
							Save key
						</Button>
						<Button
							disabled={busy || !fingerprint}
							onClick={() => runBackground(remove())}
							type="button"
							variant="outline"
						>
							Remove key
						</Button>
					</div>
					{message ? <p>{message}</p> : null}
					{error ? <p className="text-destructive">{error}</p> : null}
				</form>
			</CardContent>
		</Card>
	);
}
