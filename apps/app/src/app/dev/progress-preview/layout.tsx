import type { Metadata } from "next";

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
	return children;
}
