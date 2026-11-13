import { Skeleton } from "@repo/design-system/components/ui/skeleton";

export default function LeaderboardLoading() {
	return (
		<main
			aria-busy="true"
			aria-label="Loading leaderboard"
			className="mx-auto grid max-w-6xl gap-8 px-4 py-10"
		>
			<Skeleton className="h-10 w-64" />
			<Skeleton className="h-24 w-full" />
			<Skeleton className="h-64 w-full" />
		</main>
	);
}
