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
import { Switch } from "@repo/design-system/components/ui/switch";
import { useEffect, useState } from "react";
import { runBackground } from "../lib/background";

export function LeaderboardSettingsForm() {
	const [optedIn, setOptedIn] = useState(false);
	const [displayName, setDisplayName] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		runBackground(
			fetch("/api/habits/leaderboard-settings").then(async (response) => {
				const body = (await response.json()) as {
					displayName?: string;
					error?: string;
					optedIn?: boolean;
				};
				if (!response.ok) {
					setError(body.error ?? "Could not load leaderboard settings.");
					return;
				}
				setDisplayName(body.displayName ?? "");
				setOptedIn(Boolean(body.optedIn));
			})
		);
	}, []);

	async function save(nextOptedIn: boolean) {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/habits/leaderboard-settings", {
				body: JSON.stringify({
					displayName,
					optedIn: nextOptedIn,
				}),
				headers: { "content-type": "application/json" },
				method: "PUT",
			});
			const body = (await response.json()) as {
				displayName?: string;
				error?: string;
				optedIn?: boolean;
			};
			if (!response.ok) {
				setError(body.error ?? "Could not save leaderboard settings.");
				return;
			}
			setDisplayName(body.displayName ?? displayName);
			setOptedIn(Boolean(body.optedIn));
			setMessage(
				body.optedIn
					? "You are on this week's board under that display name."
					: "You were removed from the leaderboard."
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Weekly leaderboard</CardTitle>
				<CardDescription>
					Off by default. Opt in with a public display name (3–24 characters:
					letters, numbers, spaces, dots, hyphens, underscores). Names are not
					required to be unique. Opting out removes you immediately. The board
					ranks weekly habit points only and resets Monday 00:00 UTC.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-2">
					<Label htmlFor="leaderboard-display-name">Display name</Label>
					<Input
						autoComplete="nickname"
						id="leaderboard-display-name"
						maxLength={24}
						onChange={(event) => setDisplayName(event.target.value)}
						value={displayName}
					/>
				</div>
				<div className="flex items-center justify-between gap-3">
					<Label htmlFor="leaderboard-opt-in">Show me on the board</Label>
					<Switch
						checked={optedIn}
						disabled={busy}
						id="leaderboard-opt-in"
						onCheckedChange={(checked) => {
							runBackground(save(checked));
						}}
					/>
				</div>
				<Button
					disabled={busy}
					onClick={() => runBackground(save(optedIn))}
					type="button"
					variant="outline"
				>
					Save display name
				</Button>
				{message ? <p>{message}</p> : null}
				{error ? <p className="text-destructive">{error}</p> : null}
			</CardContent>
		</Card>
	);
}
