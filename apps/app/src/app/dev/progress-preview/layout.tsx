import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { progressFixtureEnabled } from "../../../lib/progress/preview-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	robots: { index: false, follow: false },
	title: "Progress fixture",
};

export default function ProgressPreviewLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	if (!progressFixtureEnabled()) {
		notFound();
	}
	return children;
}
