"use client";

import { type ReactNode, useLayoutEffect } from "react";

export function ProgressPreviewFrame({
	children,
	theme,
}: {
	children: ReactNode;
	theme: "dark" | "light";
}) {
	useLayoutEffect(() => {
		const root = document.documentElement;
		const apply = () => {
			root.classList.toggle("dark", theme === "dark");
			root.style.colorScheme = theme;
			root.dataset.theme = theme;
		};
		apply();
		const inner = window.setTimeout(apply, 0);
		const late = window.setTimeout(apply, 50);
		return () => {
			window.clearTimeout(inner);
			window.clearTimeout(late);
		};
	}, [theme]);
	return (
		<div
			className={
				theme === "dark"
					? "dark min-h-screen bg-background text-foreground"
					: "min-h-screen bg-background text-foreground"
			}
			data-theme={theme}
		>
			<p className="border-b bg-muted/60 px-4 py-2 text-center text-muted-foreground text-xs">
				Fixture preview. Seeded local data only. Not a live account.
			</p>
			{children}
		</div>
	);
}
