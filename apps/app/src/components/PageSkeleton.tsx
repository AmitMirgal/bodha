import { Skeleton } from "@repo/design-system/components/ui/skeleton";

export function PageSkeleton() {
	return (
		<main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-4 w-full max-w-md" />
			<Skeleton className="h-40 w-full" />
			<Skeleton className="h-40 w-full" />
		</main>
	);
}
