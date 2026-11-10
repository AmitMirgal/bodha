import { notFound } from "next/navigation";
import { progressFixtureEnabled } from "../../lib/progress/preview-gate";

export const dynamic = "force-dynamic";

export default function DevLayout({ children }: { children: React.ReactNode }) {
	if (!progressFixtureEnabled()) {
		notFound();
	}
	return children;
}
