"use client";

import {
	describeCapabilityGaps,
	listMatiProviders,
	type MatiProviderId,
	PROVIDER_REGISTRY,
	parseMatiProvider,
} from "@repo/ai/providers";
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
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { runBackground } from "../lib/background";

interface Masked {
	capabilities?: {
		streaming?: string;
		structuredOutput?: string;
		tools?: string;
		usageReporting?: string;
	} | null;
	configured: boolean;
	keyFingerprint: string | null;
	model: string | null;
	provider: string | null;
	source: "user" | "operator_default" | "none";
}

const CATALOG = listMatiProviders();

export function LlmSettingsForm() {
	const [provider, setProvider] = useState<MatiProviderId>("openai");
	const [model, setModel] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [masked, setMasked] = useState<Masked | null>(null);
	const [encryptionReady, setEncryptionReady] = useState(true);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const selected = useMemo(
		() =>
			CATALOG.find((item) => item.id === provider) ?? PROVIDER_REGISTRY.openai,
		[provider]
	);
	const gaps = describeCapabilityGaps(selected.capabilities);

	useEffect(() => {
		runBackground(
			fetch("/api/llm-settings")
				.then((response) => response.json())
				.then((body: { encryptionReady?: boolean; settings?: Masked }) => {
					setMasked(body.settings ?? null);
					setEncryptionReady(Boolean(body.encryptionReady));
					const saved = parseMatiProvider(body.settings?.provider);
					if (saved) {
						setProvider(saved);
					}
					if (body.settings?.model) {
						setModel(body.settings.model);
					}
				})
		);
	}, []);

	async function refresh() {
		const response = await fetch("/api/llm-settings");
		const body = await response.json();
		setMasked(body.settings);
		setEncryptionReady(Boolean(body.encryptionReady));
		const saved = parseMatiProvider(body.settings?.provider);
		if (saved) {
			setProvider(saved);
		}
		if (body.settings?.model) {
			setModel(body.settings.model);
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
				body: JSON.stringify({ provider, model, apiKey }),
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
				body: JSON.stringify({ provider, model, apiKey }),
			});
			const body = await response.json();
			setApiKey("");
			if (!response.ok) {
				setError(body.error ?? "Check failed.");
				return;
			}
			const extra =
				Array.isArray(body.gaps) && body.gaps.length > 0
					? ` ${body.gaps.join(" ")}`
					: "";
			setMessage(
				body.error
					? body.error
					: `Documented capabilities loaded.${extra} No exercise content was sent.`
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
		<section id="llm">
			<Card>
				<CardHeader>
					<CardTitle>Bring your own LLM key</CardTitle>
					<CardDescription>
						Pick one of the five supported providers, enter the model id, and
						paste your API key. Keys are submitted over HTTPS, encrypted at
						rest, and never returned to the browser. Mati always uses that
						provider&apos;s official endpoint.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					{encryptionReady ? null : (
						<Alert variant="destructive">
							<AlertTitle>Encryption is not configured</AlertTitle>
							<AlertDescription>
								Set MATI_CREDENTIALS_ENCRYPTION_KEY on the server (`openssl rand
								-hex 32`). Mati will not store plaintext keys.
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
					<form
						className="grid gap-4"
						onSubmit={(event) => runBackground(onSave(event))}
					>
						<div className="grid gap-2">
							<Label htmlFor="provider">Provider</Label>
							<select
								className="h-9 rounded-md border border-input bg-background px-3 text-sm"
								id="provider"
								onChange={(event) => {
									const next = parseMatiProvider(event.target.value);
									if (next) {
										setProvider(next);
									}
								}}
								required
								value={provider}
							>
								{CATALOG.map((item) => (
									<option key={item.id} value={item.id}>
										{item.label}
									</option>
								))}
							</select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="model">Model</Label>
							<Input
								id="model"
								onChange={(event) => setModel(event.target.value)}
								placeholder="Provider model id"
								required
								value={model}
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
						{gaps.length > 0 ? (
							<Alert>
								<AlertTitle>Documented capability gaps</AlertTitle>
								<AlertDescription>
									<ul className="list-disc pl-4">
										{gaps.map((gap) => (
											<li key={gap}>{gap}</li>
										))}
									</ul>
								</AlertDescription>
							</Alert>
						) : null}
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
								Check capabilities
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
		</section>
	);
}
