"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/design-system/components/ui/table";
import { ArrowDown, ArrowUpDown } from "lucide-react";
import {
	originLabel,
	provenanceLabel,
	reportKindLabel,
	reportKindVariant,
	type SortKey,
	tokenCell,
} from "../lib/progress/display";
import type { ProgressTask } from "../lib/progress/types";

const HEADERS: Array<{ id: SortKey; label: string }> = [
	{ id: "date", label: "Date" },
	{ id: "source", label: "Source" },
	{ id: "prompts", label: "Prompts" },
	{ id: "tokens", label: "Tokens" },
	{ id: "outcome", label: "Outcome" },
];

export function ProgressTaskTable({
	onSort,
	sort,
	tasks,
}: {
	onSort: (key: SortKey) => void;
	sort: SortKey;
	tasks: ProgressTask[];
}) {
	return (
		<section aria-labelledby="progress-task-table" className="grid gap-4">
			<h2
				className="font-semibold text-lg tracking-tight"
				id="progress-task-table"
			>
				All tasks
			</h2>
			<div className="max-h-[32rem] overflow-auto rounded-xl border bg-card shadow-sm [&_[data-slot=table-container]]:overflow-visible">
				<Table>
					<TableHeader className="sticky top-0 z-10 bg-card">
						<TableRow>
							{HEADERS.map((header) => (
								<TableHead
									aria-sort={sort === header.id ? "descending" : "none"}
									key={header.id}
								>
									<Button
										aria-pressed={sort === header.id}
										className="min-h-11 gap-1 px-2"
										onClick={() => onSort(header.id)}
										size="sm"
										variant="ghost"
									>
										{header.label}
										{sort === header.id ? (
											<ArrowDown aria-hidden className="size-3.5" />
										) : (
											<ArrowUpDown
												aria-hidden
												className="size-3.5 opacity-50"
											/>
										)}
									</Button>
								</TableHead>
							))}
							<TableHead>Report</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{tasks.map((task) => (
							<TableRow key={`row-${task.sessionId}`}>
								<TableCell className="whitespace-nowrap font-medium tabular-nums">
									{task.occurredAt.slice(0, 10)}
								</TableCell>
								<TableCell>
									<Badge variant="secondary">{originLabel(task.origin)}</Badge>
								</TableCell>
								<TableCell className="tabular-nums">
									{task.prompts.length}
								</TableCell>
								<TableCell>
									<div className="grid gap-1">
										<span>{tokenCell(task.usage)}</span>
										<Badge className="w-fit" variant="outline">
											{provenanceLabel(task.usage.label)}
										</Badge>
									</div>
								</TableCell>
								<TableCell className="max-w-[18rem] truncate">
									{task.outcome?.observed ?? task.status}
								</TableCell>
								<TableCell>
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant={reportKindVariant(task.reportKind)}>
											{reportKindLabel(task.reportKind)}
										</Badge>
										<Button asChild size="sm" variant="link">
											<a href={task.reportHref}>Open</a>
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}
