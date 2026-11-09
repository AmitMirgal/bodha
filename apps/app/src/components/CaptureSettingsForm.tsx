"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { useEffect, useState } from "react";
import { runBackground } from "../lib/background";

interface ClaimedDevice {
	createdAt: string;
	id: string;
}

export function CaptureSettingsForm() {
	const [code, setCode] = useState<string | null>(null);
	const [expiresAt, setExpiresAt] = useState<string | null>(null);
	const [devices, setDevices] = useState<ClaimedDevice[]>([]);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function refreshDevices() {
		const response = await fetch("/api/capture/v1/account/devices");
		const body = (await response.json()) as { devices?: ClaimedDevice[] };
		setDevices(body.devices ?? []);
	}

	useEffect(() => {
		runBackground(
			fetch("/api/capture/v1/account/devices")
				.then((response) => response.json())
				.then((body: { devices?: ClaimedDevice[] }) => {
					setDevices(body.devices ?? []);
				})
		);
	}, []);

	async function generateCode() {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/capture/v1/pair/start", {
				method: "POST",
			});
			const body = (await response.json()) as {
				code?: string;
				error?: string;
				expiresAt?: string;
			};
			if (!(response.ok && body.code)) {
				setError(body.error ?? "Could not create a pairing code.");
				return;
			}
			setCode(body.code);
			setExpiresAt(body.expiresAt ?? null);
			setMessage(
				"Enter this code in the editor with Mati: Claim this device. It expires in 10 minutes."
			);
		} finally {
			setBusy(false);
		}
	}

	async function deleteDevice(deviceId: string) {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch(
				`/api/capture/v1/account/devices/${deviceId}`,
				{ method: "DELETE" }
			);
			if (!response.ok) {
				const body = (await response.json()) as { error?: string };
				setError(body.error ?? "Could not delete editor capture.");
				return;
			}
			setMessage(
				"Deleted editor capture for that device. Trainer sessions were not touched."
			);
			await refreshDevices();
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Editor capture</CardTitle>
				<CardDescription>
					Link a no-sign-in editor device to this account, or delete claimed
					editor data. Trainer sessions stay on this account either way.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-2">
					<Button disabled={busy} onClick={() => runBackground(generateCode())}>
						Generate pairing code
					</Button>
					{code ? (
						<p>
							<code>{code}</code>
							{expiresAt ? (
								<span className="text-muted-foreground">
									{" "}
									expires {new Date(expiresAt).toISOString()}
								</span>
							) : null}
						</p>
					) : null}
				</div>
				{devices.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No claimed editor devices yet.
					</p>
				) : (
					<ul className="grid gap-2">
						{devices.map((device) => (
							<li
								className="flex items-center justify-between gap-2"
								key={device.id}
							>
								<span className="font-mono text-sm">{device.id}</span>
								<Button
									disabled={busy}
									onClick={() => runBackground(deleteDevice(device.id))}
									variant="outline"
								>
									Delete editor capture
								</Button>
							</li>
						))}
					</ul>
				)}
				{message ? <p>{message}</p> : null}
				{error ? <p className="text-destructive">{error}</p> : null}
			</CardContent>
		</Card>
	);
}
