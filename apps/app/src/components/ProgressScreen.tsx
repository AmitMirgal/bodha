"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/design-system/components/ui/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { useMemo, useState } from "react";
import {
	chartFromTasks,
	summaryFromTasks,
	usageCopy,
} from "../lib/progress/aggregate";
import type {
	ProgressOrigin,
	ProgressSummary,
	ProgressTask,
	ProgressUsage,
	ProgressView,
} from "../lib/progress/types";
import { ProgressCharts } from "./ProgressCharts";

type SourceFilter = "all" | ProgressOrigin;
type SortKey = "date" | "source" | "prompts" | "tokens" | "outcome";

function parseSourceFilter(value: string): SourceFilter {
	switch (value) {
		case "all":
		case "copilot":
		case "cursor":
		case "trainer":
			return value;
		default:
			return "all";
	}
}

function parseSortKey(value: string): SortKey {
	switch (value) {
		case "date":
		case "outcome":
		case "prompts":
		case "source":
		case "tokens":
			return value;
		default:
			return "date";
	}
}

function originLabel(origin: ProgressOrigin): string {
	switch (origin) {
		case "trainer":
			return "Trainer";
		case "cursor":
			return "Cursor";
		case "copilot":
			return "Copilot";
		default: {
			const exhaustive: never = origin;
			throw new Error(`Unhandled origin: ${String(exhaustive)}`);
		}
	}
}

function provenanceLabel(label: ProgressUsage["label"]): string {
	switch (label) {
		case "measured":
			return "Measured";
		case "estimated":
			return "Estimated";
		case "missing":
			return "Not reported";
		default: {
			const exhaustive: never = label;
			throw new Error(`Unhandled token label: ${String(exhaustive)}`);
		}
	}
}

function tokenBadge(summary: ProgressSummary): string {
	if (summary.measured) {
		return "Measured";
	}
	if (summary.estimated) {
		return "Estimated";
	}
	return "Not reported";
}

function tokenCell(usage: ProgressUsage): string {
	if (usage.label === "missing") {
		return "Not reported";
	}
	const input = usage.inputTokens == null ? "—" : String(usage.inputTokens);
	const output = usage.outputTokens == null ? "—" : String(usage.outputTokens);
	if (usage.label === "estimated") {
		return `${input} in / ${output} out`;
	}
	const cached =
		usage.cachedTokens == null
			? "cached not reported"
			: `${usage.cachedTokens} cached`;
	return `${input} in / ${output} out / ${cached}`;
}

function filterTasks(
	tasks: ProgressTask[],
	filter: SourceFilter
): ProgressTask[] {
	if (filter === "all") {
		return tasks;
	}
	return tasks.filter((task) => task.origin === filter);
}

function compareTasks(
	left: ProgressTask,
	right: ProgressTask,
	sort: SortKey
): number {
	switch (sort) {
		case "date":
			return right.occurredAt.localeCompare(left.occurredAt);
		case "source":
			return originLabel(left.origin).localeCompare(originLabel(right.origin));
		case "prompts":
			return right.prompts.length - left.prompts.length;
		case "tokens": {
			const leftScore =
				left.usage.label === "missing"
					? -1
					: (left.usage.inputTokens ?? 0) + (left.usage.outputTokens ?? 0);
			const rightScore =
				right.usage.label === "missing"
					? -1
					: (right.usage.inputTokens ?? 0) + (right.usage.outputTokens ?? 0);
			return rightScore - leftScore;
		}
		case "outcome":
			return (left.outcome?.observed ?? left.status).localeCompare(
				right.outcome?.observed ?? right.status
			);
		default: {
			const exhaustive: never = sort;
			throw new Error(`Unhandled sort: ${String(exhaustive)}`);
		}
	}
}

function SummaryCard({
	badge,
	detail,
	split,
	title,
	value,
}: {
	badge: string;
	detail: string;
	split?: Array<{ label: string; value: string }>;
	title: string;
	value: string;
}) {
	return (
		<Card>
			<CardHeader className="gap-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="font-medium text-sm">{title}</CardTitle>
					<Badge variant="outline">{badge}</Badge>
				</div>
				{split && split.length > 0 ? (
					<div className="grid grid-cols-3 gap-2">
						{split.map((part) => (
							<div key={part.label}>
								<p className="text-muted-foreground text-xs">{part.label}</p>
								<p className="font-semibold text-xl tracking-tight">
									{part.value}
								</p>
							</div>
						))}
					</div>
				) : (
					<p className="font-semibold text-2xl tracking-tight">{value}</p>
				)}
				<CardDescription>{detail}</CardDescription>
			</CardHeader>
		</Card>
	);
}

function summaryCards(summary: ProgressSummary) {
	let tokenValue = "Not reported";
	let tokenDetail = "No tasks yet, so there is no token total to show.";
	let tokenSplit: Array<{ label: string; value: string }> | undefined;
	if (summary.measured) {
		tokenValue = `${summary.measured.inputTokens} / ${summary.measured.outputTokens} / ${summary.measured.cachedTokens}`;
		tokenDetail = `Input / output / cached on ${summary.measured.taskCount} measured tasks. Estimated stays out of this total.`;
		tokenSplit = [
			{ label: "Input", value: String(summary.measured.inputTokens) },
			{ label: "Output", value: String(summary.measured.outputTokens) },
			{ label: "Cached", value: String(summary.measured.cachedTokens) },
		];
	} else if (summary.estimated) {
		tokenValue = `${summary.estimated.inputTokens} / ${summary.estimated.outputTokens}`;
		tokenDetail = `Estimated only, from ${summary.estimated.taskCount} tasks. Not mixed into measured.`;
		tokenSplit = [
			{ label: "Input", value: String(summary.estimated.inputTokens) },
			{ label: "Output", value: String(summary.estimated.outputTokens) },
			{ label: "Cached", value: "—" },
		];
	} else if (summary.missingTaskCount > 0) {
		tokenDetail = `${summary.missingTaskCount} tasks had no vendor token count. Totals are omitted, not guessed.`;
	}
	const testsValue = summary.tests
		? `${summary.tests.passed} / ${summary.tests.total}`
		: "No harness runs";
	const testsDetail = summary.tests
		? `${summary.tests.passed} passed, ${summary.tests.failed} failed across ${summary.tests.taskCount} trainer tasks with a stored harness run.`
		: "Editor capture has no browser harness. Trainer tasks without a run are omitted, not shown as 0%.";
	return [
		{
			title: "Tokens",
			value: tokenValue,
			detail: tokenDetail,
			badge: tokenBadge(summary),
			split: tokenSplit,
		},
		{
			title: "Prompts",
			value: String(summary.promptCount),
			detail: "Stored user prompts across the filtered tasks.",
			badge: "Observed",
		},
		{
			title: "Tasks completed",
			value: `${summary.completedCount} / ${summary.taskCount}`,
			detail: "Completed or closed tasks over all loaded tasks.",
			badge: "Observed",
		},
		{
			title: "Tests",
			value: testsValue,
			detail: testsDetail,
			badge: summary.tests ? "Harness" : "Not reported",
		},
	];
}

function TaskCard({ task }: { task: ProgressTask }) {
	const noneCopy =
		task.source === "editor"
			? "No learning report yet. Close the editor task to assemble one from captured prompts."
			: "No learning report yet. Finish the session to generate one.";
	const top = task.suggestions[0] ?? null;
	return (
		<Card>
			<CardHeader className="gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle className="text-base">
						<a
							className="underline-offset-4 hover:underline"
							href={task.reportHref}
						>
							{task.exerciseId}
						</a>
					</CardTitle>
					<Badge variant="secondary">{originLabel(task.origin)}</Badge>
					<Badge variant="outline">{provenanceLabel(task.usage.label)}</Badge>
				</div>
				<CardDescription>
					{task.prompts.length}{" "}
					{task.prompts.length === 1 ? "prompt" : "prompts"} · {task.status}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 text-sm">
				{task.prompts[0] ? (
					<pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-mono text-xs">
						{task.prompts[0]}
					</pre>
				) : (
					<p className="text-muted-foreground">
						No prompts were stored for this task.
					</p>
				)}
				<p>{usageCopy(task.usage, task.source)}</p>
				<p>
					<strong>Outcome:</strong>{" "}
					{task.outcome?.observed ?? "No outcome stored yet."}
				</p>
				{top ? (
					<p>
						<strong>Try next:</strong> {top.title}. {top.improvedExample}
					</p>
				) : (
					<p className="text-muted-foreground">
						{task.outcome
							? "No prompt improvement stored for this task."
							: noneCopy}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function emptyMessage(filter: SourceFilter): string {
	switch (filter) {
		case "all":
			return "No tasks yet. Finish a trainer exercise or claim an editor device from Settings.";
		case "trainer":
			return "No trainer tasks yet. Finish an exercise to see prompts, tokens, and coaching here.";
		case "cursor":
			return "No claimed Cursor tasks yet. Claim a device from Settings to see editor prompts here.";
		case "copilot":
			return "No claimed Copilot tasks yet. Claim a device from Settings after a Copilot session.";
		default: {
			const exhaustive: never = filter;
			throw new Error(`Unhandled filter: ${String(exhaustive)}`);
		}
	}
}

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
	const cards = summaryCards(summary);
	const originCounts = useMemo(
		() => ({
			all: view.tasks.length,
			copilot: view.tasks.filter((task) => task.origin === "copilot").length,
			cursor: view.tasks.filter((task) => task.origin === "cursor").length,
			trainer: view.tasks.filter((task) => task.origin === "trainer").length,
		}),
		[view.tasks]
	);
	return (
		<main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
			<header className="grid gap-2">
				<h1 className="font-semibold text-3xl tracking-tight">Progress</h1>
				<p className="max-w-3xl text-muted-foreground text-sm">
					How you used AI, and what to try next. Days use {view.timezone}.
					Measured totals never mix in estimates. Missing counts are labeled,
					not shown as zero. This page is not a skill score.
				</p>
			</header>
			<Tabs
				onValueChange={(value: string) => setFilter(parseSourceFilter(value))}
				value={filter}
			>
				<TabsList
					aria-label="Task source"
					className="flex h-auto w-full flex-wrap justify-start sm:w-fit"
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
				<TabsContent className="grid gap-6" value={filter}>
					<section
						aria-label="Summary"
						className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
					>
						{cards.map((card) => (
							<SummaryCard key={card.title} {...card} />
						))}
					</section>
					{summary.missingTaskCount > 0 ? (
						<output className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
							{summary.missingTaskCount}{" "}
							{summary.missingTaskCount === 1 ? "task" : "tasks"} had no vendor
							token count. Those totals are omitted, not shown as 0.
						</output>
					) : null}
					<ProgressCharts points={chart} />
					{tasks.length === 0 ? (
						<p className="rounded-xl border bg-card p-6">
							{emptyMessage(filter)}
						</p>
					) : (
						<>
							<section
								aria-labelledby="progress-task-cards"
								className="grid gap-3"
							>
								<h2 className="font-medium text-sm" id="progress-task-cards">
									Tasks
								</h2>
								<div className="grid gap-3 md:grid-cols-2">
									{tasks.map((task) => (
										<TaskCard key={task.sessionId} task={task} />
									))}
								</div>
							</section>
							<section
								aria-labelledby="progress-task-table"
								className="grid gap-3"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h2 className="font-medium text-sm" id="progress-task-table">
										All tasks
									</h2>
									<label
										className="flex items-center gap-2 text-sm"
										htmlFor="progress-sort"
									>
										Sort
										<select
											className="rounded-md border bg-background px-2 py-1"
											id="progress-sort"
											onChange={(event: { target: { value: string } }) =>
												setSort(parseSortKey(event.target.value))
											}
											value={sort}
										>
											<option value="date">Date</option>
											<option value="source">Source</option>
											<option value="prompts">Prompts</option>
											<option value="tokens">Tokens</option>
											<option value="outcome">Outcome</option>
										</select>
									</label>
								</div>
								<div className="overflow-x-auto rounded-xl border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Source</TableHead>
												<TableHead>Prompts</TableHead>
												<TableHead>Tokens</TableHead>
												<TableHead>Outcome</TableHead>
												<TableHead>Report</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{tasks.map((task) => (
												<TableRow key={`row-${task.sessionId}`}>
													<TableCell className="whitespace-nowrap">
														{task.occurredAt.slice(0, 10)}
													</TableCell>
													<TableCell>{originLabel(task.origin)}</TableCell>
													<TableCell>{task.prompts.length}</TableCell>
													<TableCell>{tokenCell(task.usage)}</TableCell>
													<TableCell>
														{task.outcome?.observed ?? task.status}
													</TableCell>
													<TableCell>
														<a
															className="underline underline-offset-4"
															href={task.reportHref}
														>
															Open
														</a>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</section>
						</>
					)}
				</TabsContent>
			</Tabs>
		</main>
	);
}
