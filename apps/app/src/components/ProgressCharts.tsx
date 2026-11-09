"use client";

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
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	XAxis,
	YAxis,
} from "recharts";
import { formatChartDay } from "../lib/progress/display";
import type { ProgressChartPoint, ProgressTask } from "../lib/progress/types";

const tokenConfig = {
	input: {
		label: "Input",
		theme: { dark: "#6E56CF", light: "#E67E45" },
	},
	output: {
		label: "Output",
		theme: { dark: "#3ECF8E", light: "#3D9A96" },
	},
	cached: {
		label: "Cached",
		theme: { dark: "#E8A84A", light: "#3A5470" },
	},
} satisfies ChartConfig;

const promptConfig = {
	prompts: {
		label: "Prompts",
		theme: { dark: "#C44DDB", light: "#E8C547" },
	},
} satisfies ChartConfig;

function tokenRows(points: ProgressChartPoint[]) {
	return points.map((point) => ({
		cached: point.measuredCachedTokens,
		date: point.date,
		input: point.measuredInputTokens,
		output: point.measuredOutputTokens,
	}));
}

function promptRows(tasks: ProgressTask[]) {
	return [...tasks]
		.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
		.slice(0, 12)
		.reverse()
		.map((task) => ({
			prompts: task.prompts.length,
			task:
				task.exerciseId.length > 16
					? `${task.exerciseId.slice(0, 14)}…`
					: task.exerciseId,
		}));
}

export function ProgressCharts({
	points,
	tasks,
}: {
	points: ProgressChartPoint[];
	tasks: ProgressTask[];
}) {
	if (points.length === 0 && tasks.length === 0) {
		return null;
	}
	const hasMeasured = points.some(
		(point) =>
			point.measuredCachedTokens != null ||
			point.measuredInputTokens != null ||
			point.measuredOutputTokens != null
	);
	const promptData = promptRows(tasks);
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card className="shadow-sm">
				<CardHeader>
					<CardTitle className="text-base" id="progress-token-chart">
						Measured tokens over time
					</CardTitle>
					<CardDescription>
						Stacked vendor-reported input, output, and cached. Estimated and
						missing days are gaps, not zeros.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{hasMeasured ? (
						<ChartContainer
							className="aspect-auto h-72 min-h-[18rem] w-full"
							config={tokenConfig}
						>
							<AreaChart
								accessibilityLayer
								data={tokenRows(points)}
								margin={{ left: 4, right: 8, top: 8 }}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									axisLine={false}
									dataKey="date"
									tickFormatter={formatChartDay}
									tickLine={false}
									tickMargin={8}
								/>
								<YAxis
									axisLine={false}
									tickLine={false}
									tickMargin={4}
									width={40}
								/>
								<ChartTooltip
									content={<ChartTooltipContent indicator="dot" />}
								/>
								<ChartLegend content={<ChartLegendContent />} />
								<Area
									dataKey="input"
									fill="var(--color-input)"
									fillOpacity={0.35}
									isAnimationActive={false}
									stackId="tokens"
									stroke="var(--color-input)"
									strokeWidth={2}
									type="monotone"
								/>
								<Area
									dataKey="output"
									fill="var(--color-output)"
									fillOpacity={0.35}
									isAnimationActive={false}
									stackId="tokens"
									stroke="var(--color-output)"
									strokeWidth={2}
									type="monotone"
								/>
								<Area
									dataKey="cached"
									fill="var(--color-cached)"
									fillOpacity={0.35}
									isAnimationActive={false}
									stackId="tokens"
									stroke="var(--color-cached)"
									strokeWidth={2}
									type="monotone"
								/>
							</AreaChart>
						</ChartContainer>
					) : (
						<p className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
							No measured token days yet.
						</p>
					)}
				</CardContent>
			</Card>
			<Card className="shadow-sm">
				<CardHeader>
					<CardTitle className="text-base" id="progress-prompt-chart">
						Prompts per task
					</CardTitle>
					<CardDescription>
						Stored user prompts on the latest tasks. This is a count of prompts,
						not tokens.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{promptData.length === 0 ? (
						<p className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
							No prompts stored yet.
						</p>
					) : (
						<ChartContainer
							className="aspect-auto h-72 min-h-[18rem] w-full"
							config={promptConfig}
						>
							<BarChart
								accessibilityLayer
								data={promptData}
								margin={{ left: 4, right: 8, top: 8 }}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									axisLine={false}
									dataKey="task"
									interval={0}
									tickLine={false}
									tickMargin={8}
								/>
								<YAxis
									allowDecimals={false}
									axisLine={false}
									tickLine={false}
									width={28}
								/>
								<ChartTooltip
									content={<ChartTooltipContent indicator="dot" />}
								/>
								<Bar
									dataKey="prompts"
									fill="var(--color-prompts)"
									isAnimationActive={false}
									radius={[6, 6, 0, 0]}
								/>
							</BarChart>
						</ChartContainer>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
