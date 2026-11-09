"use client";

import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ProgressChartPoint } from "../lib/progress/types";

const tokenConfig = {
	input: { label: "Input", color: "var(--color-chart-1)" },
	output: { label: "Output", color: "var(--color-chart-2)" },
	cached: { label: "Cached", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

const promptConfig = {
	prompts: { label: "Prompts", color: "var(--color-chart-4)" },
} satisfies ChartConfig;

function tokenRows(points: ProgressChartPoint[]) {
	return points.map((point) => ({
		date: point.date,
		input: point.measuredInputTokens,
		output: point.measuredOutputTokens,
		cached: point.measuredCachedTokens,
	}));
}

export function ProgressCharts({ points }: { points: ProgressChartPoint[] }) {
	if (points.length === 0) {
		return null;
	}
	const measuredDays = points.filter(
		(point) => point.measuredInputTokens != null
	);
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<section aria-labelledby="progress-token-chart">
				<h2 className="mb-2 font-medium text-sm" id="progress-token-chart">
					Measured tokens over time
				</h2>
				<p className="mb-3 text-muted-foreground text-sm">
					Stacked input, output, and cached from vendor reports. Estimated and
					missing days are omitted, not drawn as zero.
				</p>
				{measuredDays.length === 0 ? (
					<p className="rounded-xl border bg-card p-4 text-muted-foreground text-sm">
						No measured token days yet.
					</p>
				) : (
					<ChartContainer
						className="aspect-auto h-56 w-full"
						config={tokenConfig}
					>
						<BarChart accessibilityLayer data={tokenRows(measuredDays)}>
							<CartesianGrid vertical={false} />
							<XAxis axisLine={false} dataKey="date" tickLine={false} />
							<YAxis hide />
							<ChartTooltip content={<ChartTooltipContent />} />
							<ChartLegend content={<ChartLegendContent />} />
							<Bar
								dataKey="input"
								fill="var(--color-input)"
								radius={4}
								stackId="tokens"
							/>
							<Bar
								dataKey="output"
								fill="var(--color-output)"
								radius={4}
								stackId="tokens"
							/>
							<Bar
								dataKey="cached"
								fill="var(--color-cached)"
								radius={4}
								stackId="tokens"
							/>
						</BarChart>
					</ChartContainer>
				)}
			</section>
			<section aria-labelledby="progress-prompt-chart">
				<h2 className="mb-2 font-medium text-sm" id="progress-prompt-chart">
					Prompts per day
				</h2>
				<p className="mb-3 text-muted-foreground text-sm">
					Stored user prompts on days that had a task. This is a count of
					prompts, not tokens.
				</p>
				<ChartContainer
					className="aspect-auto h-56 w-full"
					config={promptConfig}
				>
					<BarChart
						accessibilityLayer
						data={points.map((point) => ({
							date: point.date,
							prompts: point.promptCount,
						}))}
					>
						<CartesianGrid vertical={false} />
						<XAxis axisLine={false} dataKey="date" tickLine={false} />
						<YAxis hide />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Bar dataKey="prompts" fill="var(--color-prompts)" radius={4} />
					</BarChart>
				</ChartContainer>
			</section>
		</div>
	);
}
