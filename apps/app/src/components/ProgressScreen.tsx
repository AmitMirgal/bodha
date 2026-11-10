"use client";

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Inbox, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
	chartFromTasks,
	groupTasksByDay,
	summaryFromTasks,
} from "../lib/progress/aggregate";
import {
	compareTasks,
	emptyMessage,
	filterTasks,
	formatDayHeading,
	parseSourceFilter,
	type SortKey,
	type SourceFilter,
} from "../lib/progress/display";
import type { ProgressView } from "../lib/progress/types";
import { ProgressCharts } from "./ProgressCharts";
import { ProgressKpis } from "./ProgressKpis";
import { ProgressTaskCard } from "./ProgressTaskCard";
import { ProgressTaskTable } from "./ProgressTaskTable";

export function ProgressScreen({ view }: { view: ProgressView }) {
	const [filter, setFilter] = useState<SourceFilter>("all");
	const [sort, setSort] = useState<SortKey>("date");
	const filtered = useMemo(
		() => filterTasks(view.tasks, filter),
		[filter, view.tasks]
	);
	const tasks = useMemo(
		() => [...filtered].sort((left, right) => compareTasks(left, right, sort)),
		[filtered, sort]
	);
	const summary = useMemo(
		() => (filter === "all" ? view.summary : summaryFromTasks(filtered)),
		[filter, filtered, view.summary]
	);
	const chart = useMemo(
		() =>
			filter === "all" ? view.chart : chartFromTasks(filtered, view.timezone),
		[filter, filtered, view.chart, view.timezone]
	);
	const days = useMemo(
		() => groupTasksByDay(tasks, view.timezone),
		[tasks, view.timezone]
	);
	const originCounts = useMemo(
		() => ({
			all: view.tasks.length,
			copilot: view.tasks.filter((task) => task.origin === "copilot").length,
			cursor: view.tasks.filter((task) => task.origin === "cursor").length,
			trainer: view.tasks.filter((task) => task.origin === "trainer").length,
		}),
		[view.tasks]
	);
	const topSuggestion = tasks.find((task) => task.suggestions[0]);
	const suggestion = topSuggestion?.suggestions[0];
	return (
		<main className="mx-auto grid max-w-6xl gap-10 px-4 py-10">
			<header className="grid gap-3">
				<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					How you used AI
				</p>
				<h1 className="font-semibold text-4xl tracking-tight">Progress</h1>
				<p className="max-w-3xl text-muted-foreground">
					How you used AI, and what to try next. Days use {view.timezone}.
					Measured totals never mix in estimates. Missing counts are labeled,
					not shown as zero. This page is not a skill score.
				</p>
			</header>
			<Tabs
				className="gap-8"
				onValueChange={(value: string) => setFilter(parseSourceFilter(value))}
				value={filter}
			>
				<TabsList
					aria-label="Task source"
					className="flex h-auto min-h-10 w-full flex-wrap justify-start sm:w-fit"
				>
					<TabsTrigger value="all">All ({originCounts.all})</TabsTrigger>
					<TabsTrigger value="trainer">
						Trainer ({originCounts.trainer})
					</TabsTrigger>
					<TabsTrigger value="cursor">
						Cursor ({originCounts.cursor})
					</TabsTrigger>
					<TabsTrigger value="copilot">
						Copilot ({originCounts.copilot})
					</TabsTrigger>
				</TabsList>
				<TabsContent className="grid gap-10" value={filter}>
					<ProgressKpis chart={chart} summary={summary} />
					{summary.missingTaskCount > 0 ? (
						<Alert>
							<AlertTitle>Some token counts were not reported</AlertTitle>
							<AlertDescription>
								{summary.missingTaskCount}{" "}
								{summary.missingTaskCount === 1 ? "task" : "tasks"} had no
								vendor token count. Those totals are omitted, not shown as 0.
							</AlertDescription>
						</Alert>
					) : null}
					<ProgressCharts points={chart} tasks={tasks} />
					{suggestion && topSuggestion ? (
						<Alert className="border-[color-mix(in_oklch,var(--chart-4)_35%,transparent)]">
							<Sparkles className="text-[var(--chart-4)]" />
							<AlertTitle>Try next · {suggestion.title}</AlertTitle>
							<AlertDescription className="grid gap-3">
								<p>
									{suggestion.improvedExample} {suggestion.whyItHelps}
								</p>
								<Button asChild className="w-fit" size="sm" variant="outline">
									<a href={topSuggestion.reportHref}>
										Open {topSuggestion.exerciseId}
									</a>
								</Button>
							</AlertDescription>
						</Alert>
					) : null}
					{tasks.length === 0 ? (
						<Empty className="border border-dashed">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Inbox />
								</EmptyMedia>
								<EmptyTitle>No tasks yet</EmptyTitle>
								<EmptyDescription>{emptyMessage(filter)}</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<>
							<section aria-labelledby="progress-by-day" className="grid gap-8">
								<h2
									className="font-semibold text-lg tracking-tight"
									id="progress-by-day"
								>
									By day
								</h2>
								{days.map((day) => (
									<section
										aria-labelledby={`day-${day.date}`}
										className="grid gap-4"
										key={day.date}
									>
										<div className="flex flex-wrap items-baseline justify-between gap-2">
											<h3
												className="font-semibold text-xl tracking-tight"
												id={`day-${day.date}`}
											>
												{formatDayHeading(day.date)}
											</h3>
											<p className="text-muted-foreground text-sm">
												{day.tasks.length}{" "}
												{day.tasks.length === 1 ? "task" : "tasks"}
											</p>
										</div>
										<div className="grid gap-4 lg:grid-cols-2">
											{day.tasks.map((task) => (
												<ProgressTaskCard key={task.sessionId} task={task} />
											))}
										</div>
									</section>
								))}
							</section>
							<ProgressTaskTable onSort={setSort} sort={sort} tasks={tasks} />
						</>
					)}
				</TabsContent>
			</Tabs>
		</main>
	);
}
