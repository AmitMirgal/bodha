"use client";

import { Label } from "@repo/design-system/components/ui/label";
import {
	RadioGroup,
	RadioGroupItem,
} from "@repo/design-system/components/ui/radio-group";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const THEMES = ["light", "dark", "system"] as const;

type ThemeChoice = (typeof THEMES)[number];

function isThemeChoice(value: string): value is ThemeChoice {
	return (THEMES as readonly string[]).includes(value);
}

function themeLabel(theme: ThemeChoice): string {
	switch (theme) {
		case "light":
			return "Light";
		case "dark":
			return "Dark";
		case "system":
			return "System";
		default: {
			const exhaustive: never = theme;
			throw new Error(`Unhandled theme: ${String(exhaustive)}`);
		}
	}
}

export function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const selected = mounted && theme && isThemeChoice(theme) ? theme : "system";

	return (
		<fieldset className="grid gap-2">
			<legend className="font-medium text-sm">Appearance</legend>
			<p className="text-muted-foreground text-sm">
				Default is System. The choice is stored in this browser.
			</p>
			<RadioGroup
				className="grid gap-2"
				disabled={!mounted}
				onValueChange={(value) => {
					if (isThemeChoice(value)) {
						setTheme(value);
					}
				}}
				value={selected}
			>
				{THEMES.map((value) => (
					<div className="flex items-center gap-2" key={value}>
						<RadioGroupItem id={`theme-${value}`} value={value} />
						<Label htmlFor={`theme-${value}`}>{themeLabel(value)}</Label>
					</div>
				))}
			</RadioGroup>
		</fieldset>
	);
}
