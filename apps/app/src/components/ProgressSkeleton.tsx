import { Skeleton } from "@repo/design-system/components/ui/skeleton";

export function ProgressSkeleton() {
	return (
		<main
			aria-busy="true"
			aria-label="Loading progress"
			className="mx-auto grid max-w-6xl gap-8 px-4 py-8"
		>
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-10 w-48" />
			<Skeleton className="h-4 w-full max-w-xl" />
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Skeleton className="h-36 rounded-xl" />
				<Skeleton className="h-36 rounded-xl" />
				<Skeleton className="h-36 rounded-xl" />
				<Skeleton className="h-36 rounded-xl" />
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<Skeleton className="h-72 rounded-xl" />
				<Skeleton className="h-72 rounded-xl" />
			</div>
			<Skeleton className="h-56 rounded-xl" />
		</main>
	);
}
