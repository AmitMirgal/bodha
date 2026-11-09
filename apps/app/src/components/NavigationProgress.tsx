"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const NAVIGATE_EVENT = "mati:navigate";

export function markNavigating() {
	if (typeof window === "undefined") {
		return;
	}
	window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

function isInternalNavigation(
	anchor: HTMLAnchorElement,
	pathname: string
): boolean {
	if (anchor.target && anchor.target !== "_self") {
		return false;
	}
	const href = anchor.getAttribute("href");
	if (!href || href.startsWith("#")) {
		return false;
	}
	let url: URL;
	try {
		url = new URL(anchor.href, window.location.href);
	} catch {
		return false;
	}
	if (url.origin !== window.location.origin) {
		return false;
	}
	return url.pathname !== pathname || url.search !== window.location.search;
}

export function NavigationProgress() {
	const pathname = usePathname();
	const [pending, setPending] = useState(false);

	useEffect(() => {
		if (pathname) {
			setPending(false);
		}
	}, [pathname]);

	useEffect(() => {
		const onMark = () => setPending(true);
		window.addEventListener(NAVIGATE_EVENT, onMark);
		return () => window.removeEventListener(NAVIGATE_EVENT, onMark);
	}, []);

	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return;
			}
			const target = event.target;
			if (!(target instanceof Element)) {
				return;
			}
			const anchor = target.closest("a");
			if (!(anchor instanceof HTMLAnchorElement)) {
				return;
			}
			if (isInternalNavigation(anchor, pathname)) {
				setPending(true);
			}
		};
		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, [pathname]);

	if (!pending) {
		return null;
	}
	return (
		<div
			aria-label="Navigating"
			className="fixed top-0 left-0 z-50 h-0.5 w-full bg-primary"
			role="progressbar"
		/>
	);
}
