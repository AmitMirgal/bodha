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
import { type FormEvent, useEffect, useId, useState } from "react";
import { runBackground } from "../lib/background";
import { parseDisplayName } from "../lib/habits/display-name";
import { NavLink } from "./NavLink";

async function readJson(response: Response): Promise<{
	displayName?: string;
	error?: string;
	optedIn?: boolean;
}> {
	const text = await response.text();
	if (!text) {
		return {};
	}
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object") {
			return {};
		}
		return parsed as {
			displayName?: string;
			error?: string;
			optedIn?: boolean;
		};
	} catch {
		return { error: "Could not save leaderboard settings." };
	}
}

export function LeaderboardSettingsForm() {
	const errorId = useId();
	const [optedIn, setOptedIn] = useState(false);
	const [displayName, setDisplayName] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [nameInvalid, setNameInvalid] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		runBackground(
			fetch("/api/habits/leaderboard-settings")
				.then(async (response) => {
					const body = await readJson(response);
					if (!response.ok) {
						setError(body.error ?? "Could not load leaderboard settings.");
						return;
					}
					setDisplayName(body.displayName ?? "");
					setOptedIn(Boolean(body.optedIn));
				})
				.catch(() => {
					setError("Could not load leaderboard settings.");
				})
		);
	}, []);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		setNameInvalid(false);
		try {
			if (optedIn) {
				const parsed = parseDisplayName(displayName);
				if ("error" in parsed) {
					setNameInvalid(true);
					setError(parsed.error);
					return;
				}
			}
			const response = await fetch("/api/habits/leaderboard-settings", {
				body: JSON.stringify({
					displayName,
					optedIn,
				}),
				headers: { "content-type": "application/json" },
				method: "PUT",
			});
			const body = await readJson(response);
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
		} catch {
			setError("Could not save leaderboard settings.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Weekly leaderboard</CardTitle>
				<CardDescription>
					Off by default. Choose a public display name, turn the board on, then
					save. Names are 3–24 characters: letters, numbers, spaces, dots,
					hyphens, underscores. Names are not required to be unique. Opting out
					and saving removes you immediately. The board ranks weekly habit
					points only and resets Monday 00:00 UTC.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					className="grid gap-4"
					onSubmit={(event) => runBackground(onSubmit(event))}
				>
					<div className="grid gap-2">
						<Label htmlFor="leaderboard-display-name">Display name</Label>
						<Input
							aria-invalid={nameInvalid}
							autoComplete="nickname"
							id="leaderboard-display-name"
							maxLength={24}
							onChange={(event) => {
								setDisplayName(event.target.value);
								setNameInvalid(false);
							}}
							value={displayName}
						/>
					</div>
					<div className="flex min-h-11 items-center justify-between gap-3">
						<Label htmlFor="leaderboard-opt-in">Show me on the board</Label>
						<Switch
							checked={optedIn}
							disabled={busy}
							id="leaderboard-opt-in"
							onCheckedChange={setOptedIn}
						/>
					</div>
					<Button disabled={busy} type="submit">
						Save leaderboard settings
					</Button>
					{message ? (
						<p>
							{message}{" "}
							{optedIn ? (
								<NavLink
									className="underline underline-offset-4"
									href="/leaderboard"
								>
									View the leaderboard
								</NavLink>
							) : null}
						</p>
					) : null}
					{error ? (
						<p className="text-destructive text-sm" id={errorId} role="alert">
							{error}
						</p>
					) : null}
				</form>
			</CardContent>
		</Card>
	);
}
