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
	type ChartConfig,
	ChartContainer,
} from "@repo/design-system/components/ui/chart";
import {
	Activity,
	FlaskConical,
	ListChecks,
	MessageSquare,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { Area, AreaChart } from "recharts";
import {
	deltaLabel,
	knownMeasuredTotal,
	measuredDelta,
	promptDelta,
	tokenAmount,
} from "../lib/progress/display";
import type {
	ProgressChartPoint,
	ProgressSummary,
} from "../lib/progress/types";

const sparkConfig = {
	value: {
		label: "Value",
		theme: { dark: "#6E56CF", light: "#E67E45" },
	},
} satisfies ChartConfig;

function Sparkline({ values }: { values: Array<number | null> }) {
	if (values.every((value) => value == null)) {
		return null;
	}
	return (
		<ChartContainer className="h-12 w-full" config={sparkConfig}>
			<AreaChart
				data={values.map((value, index) => ({
					i: index,
					value,
				}))}
				margin={{ bottom: 0, left: 0, right: 0, top: 4 }}
			>
				<Area
					connectNulls={false}
					dataKey="value"
					fill="var(--color-value)"
					fillOpacity={0.2}
					isAnimationActive={false}
					stroke="var(--color-value)"
					strokeWidth={2}
					type="monotone"
				/>
			</AreaChart>
		</ChartContainer>
	);
}

function Delta({ text }: { text: string }) {
	const rising = text.startsWith("+");
	const falling = text.startsWith("-");
	return (
		<p className="flex items-center gap-1 text-muted-foreground text-xs">
			{rising ? (
				<TrendingUp aria-hidden className="size-3.5 text-[var(--chart-2)]" />
			) : null}
			{falling ? (
				<TrendingDown aria-hidden className="size-3.5 text-[var(--chart-5)]" />
			) : null}
			{text}
		</p>
	);
}

function KpiCard({
	badge,
	color,
	delta,
	detail,
	icon,
	spark,
	split,
	title,
	value,
}: {
	badge: string;
	color: string;
	delta?: string | null;
	detail: string;
	icon: ReactNode;
	spark?: Array<number | null>;
	split?: Array<{ label: string; value: string }>;
	title: string;
	value: string;
}) {
	return (
		<Card className="overflow-hidden py-0 shadow-sm">
			<CardHeader className="gap-4 pt-6">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-2.5">
						<span
							className="flex size-9 items-center justify-center rounded-lg"
							style={{
								background: `color-mix(in oklch, ${color} 16%, transparent)`,
								color,
							}}
						>
							{icon}
						</span>
						<CardTitle className="font-medium text-sm">{title}</CardTitle>
					</div>
					<Badge variant="outline">{badge}</Badge>
				</div>
				{split && split.length > 0 ? (
					<div className="grid grid-cols-3 gap-2">
						{split.map((part) => (
							<div key={part.label}>
								<p className="text-muted-foreground text-xs">{part.label}</p>
								<p className="font-semibold text-2xl tabular-nums tracking-tight">
									{part.value}
								</p>
							</div>
						))}
					</div>
				) : (
					<p className="font-semibold text-3xl tabular-nums tracking-tight">
						{value}
					</p>
				)}
				{delta ? <Delta text={delta} /> : null}
				<CardDescription>{detail}</CardDescription>
			</CardHeader>
			{spark ? (
				<CardContent className="px-0 pb-0">
					<Sparkline values={spark} />
				</CardContent>
			) : (
				<div className="h-4" />
			)}
		</Card>
	);
}

export function ProgressKpis({
	chart,
	summary,
}: {
	chart: ProgressChartPoint[];
	summary: ProgressSummary;
}) {
	const tokenDelta = measuredDelta(chart);
	const promptsDelta = promptDelta(chart);
	let tokenValue = "Not reported";
	let tokenDetail = "No tasks yet, so there is no token total to show.";
	let tokenSplit: Array<{ label: string; value: string }> | undefined;
	let tokenBadge = "Not reported";
	if (summary.measured) {
		tokenBadge = "Measured";
		tokenValue = `${tokenAmount(summary.measured.inputTokens)} / ${tokenAmount(summary.measured.outputTokens)} / ${tokenAmount(summary.measured.cachedTokens)}`;
		tokenDetail = `Known measured tokens on ${summary.measured.taskCount} tasks. Estimated stays out. A dash was not reported.`;
		tokenSplit = [
			{ label: "Input", value: tokenAmount(summary.measured.inputTokens) },
			{ label: "Output", value: tokenAmount(summary.measured.outputTokens) },
			{ label: "Cached", value: tokenAmount(summary.measured.cachedTokens) },
		];
	} else if (summary.estimated) {
		tokenBadge = "Estimated";
		tokenValue = `${tokenAmount(summary.estimated.inputTokens)} / ${tokenAmount(summary.estimated.outputTokens)}`;
		tokenDetail = `Estimated only, from ${summary.estimated.taskCount} tasks. Not mixed into measured.`;
		tokenSplit = [
			{ label: "Input", value: tokenAmount(summary.estimated.inputTokens) },
			{ label: "Output", value: tokenAmount(summary.estimated.outputTokens) },
			{ label: "Cached", value: tokenAmount(summary.estimated.cachedTokens) },
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
	return (
		<section
			aria-label="Summary"
			className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
		>
			<KpiCard
				badge={tokenBadge}
				color="var(--chart-1)"
				delta={
					summary.measured && tokenDelta
						? deltaLabel(tokenDelta.delta, "measured day")
						: null
				}
				detail={tokenDetail}
				icon={<Activity aria-hidden className="size-4" />}
				spark={summary.measured ? chart.map(knownMeasuredTotal) : undefined}
				split={tokenSplit}
				title="Tokens"
				value={tokenValue}
			/>
			<KpiCard
				badge="Observed"
				color="var(--chart-4)"
				delta={promptsDelta ? deltaLabel(promptsDelta.delta, "day") : null}
				detail="Stored user prompts across the filtered tasks."
				icon={<MessageSquare aria-hidden className="size-4" />}
				spark={chart.map((point) => point.promptCount)}
				title="Prompts"
				value={String(summary.promptCount)}
			/>
			<KpiCard
				badge="Observed"
				color="var(--chart-2)"
				detail="Completed or closed tasks over all loaded tasks."
				icon={<ListChecks aria-hidden className="size-4" />}
				title="Tasks completed"
				value={`${summary.completedCount} / ${summary.taskCount}`}
			/>
			<KpiCard
				badge={summary.tests ? "Harness" : "Not reported"}
				color="var(--chart-5)"
				detail={testsDetail}
				icon={<FlaskConical aria-hidden className="size-4" />}
				title="Tests"
				value={testsValue}
			/>
		</section>
	);
}
