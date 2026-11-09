import { Suspense } from "react";
import { AppNav } from "../../../../components/AppNav";
import { UserNav } from "../../../../components/UserNav";

export const dynamic = "force-dynamic";

export default function ReportLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<Suspense fallback={<AppNav pending />}>
				<UserNav />
			</Suspense>
			{children}
		</>
	);
}
