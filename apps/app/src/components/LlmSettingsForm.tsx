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
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { type FormEvent, useEffect, useState } from "react";
import { runBackground } from "../lib/background";

interface Masked {
	baseUrl: string | null;
	capabilities?: { tools?: string } | null;
	configured: boolean;
	keyFingerprint: string | null;
	model: string | null;
	provider: string | null;
	source: "user" | "operator_default" | "none";
}

export function LlmSettingsForm() {
	const [provider, setProvider] = useState("openai-compatible");
	const [model, setModel] = useState("");
	const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
	const [apiKey, setApiKey] = useState("");
	const [masked, setMasked] = useState<Masked | null>(null);
	const [encryptionReady, setEncryptionReady] = useState(true);
	const [allowedHosts, setAllowedHosts] = useState<string[]>([]);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		runBackground(
			fetch("/api/llm-settings")
				.then((response) => response.json())
				.then(
					(body: {
						allowedHosts?: string[];
						encryptionReady?: boolean;
						settings?: Masked;
					}) => {
						setMasked(body.settings ?? null);
						setEncryptionReady(Boolean(body.encryptionReady));
						setAllowedHosts(body.allowedHosts ?? []);
						if (body.settings?.provider) {
							setProvider(body.settings.provider);
						}
						if (body.settings?.model) {
							setModel(body.settings.model);
						}
						if (body.settings?.baseUrl) {
							setBaseUrl(body.settings.baseUrl);
						}
					}
				)
		);
	}, []);

	async function refresh() {
		const response = await fetch("/api/llm-settings");
		const body = await response.json();
		setMasked(body.settings);
		setEncryptionReady(Boolean(body.encryptionReady));
		setAllowedHosts(body.allowedHosts ?? []);
		if (body.settings?.provider) {
			setProvider(body.settings.provider);
		}
		if (body.settings?.model) {
			setModel(body.settings.model);
		}
		if (body.settings?.baseUrl) {
			setBaseUrl(body.settings.baseUrl);
		}
	}

	async function onSave(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/llm-settings", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ provider, model, baseUrl, apiKey }),
			});
			const body = await response.json();
			setApiKey("");
			if (!response.ok) {
				setError(body.error ?? "Save failed.");
				return;
			}
			setMessage(
				"Saved. The key is stored encrypted and will not be shown again."
			);
			await refresh();
		} finally {
			setBusy(false);
		}
	}

	async function onTest() {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/llm-settings", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ provider, model, baseUrl, apiKey }),
			});
			const body = await response.json();
			setApiKey("");
			if (!response.ok) {
				setError(body.error ?? "Check failed.");
				return;
			}
			setMessage(
				body.error
					? body.error
					: "Connection check succeeded. No exercise content was sent."
			);
		} finally {
			setBusy(false);
		}
	}

	async function onRemove() {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/llm-settings", { method: "DELETE" });
			const body = await response.json();
			if (!response.ok) {
				setError(body.error ?? "Remove failed.");
				return;
			}
			setMessage("Saved key removed. Unrelated session data was kept.");
			await refresh();
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="mx-auto grid max-w-2xl gap-4 px-4 py-8">
			<Card>
				<CardHeader>
					<CardTitle>Bring your own LLM key</CardTitle>
					<CardDescription>
						Trainer chat and learning review both use this configuration. Keys
						are submitted over HTTPS, encrypted at rest, and never returned to
						the browser.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					{encryptionReady ? null : (
						<Alert variant="destructive">
							<AlertTitle>Encryption is not configured</AlertTitle>
							<AlertDescription>
								Set BODHA_CREDENTIALS_ENCRYPTION_KEY on the server. BODHA will
								not store plaintext keys.
							</AlertDescription>
						</Alert>
					)}
					<p className="text-sm">
						Active source: <strong>{masked?.source ?? "none"}</strong>
						{masked?.keyFingerprint
							? ` · fingerprint ${masked.keyFingerprint}`
							: ""}
						{masked?.capabilities?.tools
							? ` · tools ${masked.capabilities.tools}`
							: ""}
					</p>
					<p className="text-muted-foreground text-sm">
						Allowed hosts:{" "}
						{allowedHosts.length ? allowedHosts.join(", ") : "none configured"}
					</p>
					<form
						className="grid gap-4"
						onSubmit={(event) => runBackground(onSave(event))}
					>
						<div className="grid gap-2">
							<Label htmlFor="provider">Provider id</Label>
							<Input
								id="provider"
								onChange={(event) => setProvider(event.target.value)}
								required
								value={provider}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="model">Model</Label>
							<Input
								id="model"
								onChange={(event) => setModel(event.target.value)}
								required
								value={model}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="baseUrl">OpenAI-compatible base URL</Label>
							<Input
								id="baseUrl"
								onChange={(event) => setBaseUrl(event.target.value)}
								required
								value={baseUrl}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="apiKey">API key</Label>
							<Input
								autoComplete="new-password"
								id="apiKey"
								onChange={(event) => setApiKey(event.target.value)}
								required
								type="password"
								value={apiKey}
							/>
						</div>
						{error ? (
							<p className="text-destructive text-sm" role="alert">
								{error}
							</p>
						) : null}
						{message ? <output className="text-sm">{message}</output> : null}
						<div className="flex flex-wrap gap-2">
							<Button disabled={busy || !encryptionReady} type="submit">
								Save
							</Button>
							<Button
								disabled={busy}
								onClick={() => runBackground(onTest())}
								type="button"
								variant="secondary"
							>
								Check connection
							</Button>
							<Button
								disabled={busy}
								onClick={() => runBackground(onRemove())}
								type="button"
								variant="outline"
							>
								Remove saved key
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
