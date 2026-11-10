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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { provenanceLabel, tokenSourceLabel } from "../lib/progress/display";
import type { ProgressTask } from "../lib/progress/types";

const tokenConfig = {
	input: {
		label: "Input",
		theme: { dark: "#6E56CF", light: "#E67E45" },
	},
	output: {
		label: "Output",
		theme: { dark: "#3ECF8E", light: "#3D9A96" },
	},
} satisfies ChartConfig;

function perPromptRows(task: ProgressTask) {
	return task.promptTurns
		.map((turn, index) => ({
			input: turn.usage.inputTokens,
			label: `P${String(index + 1)}`,
			output: turn.usage.outputTokens,
		}))
		.filter((row) => row.input != null || row.output != null);
}

export function ProgressTaskChart({ task }: { task: ProgressTask }) {
	const perPrompt = perPromptRows(task);
	const taskLevel =
		task.usage.label === "missing"
			? []
			: [
					{
						input: task.usage.inputTokens,
						label: "Task",
						output: task.usage.outputTokens,
					},
				];
	const data = perPrompt.length > 0 ? perPrompt : taskLevel;
	const grain = perPrompt.length > 0 ? "per prompt" : "task total";
	return (
		<Card className="shadow-sm">
			<CardHeader>
				<CardTitle className="text-base" id="task-token-chart">
					Tokens {grain}
				</CardTitle>
				<CardDescription>
					{provenanceLabel(task.usage.label)}. {tokenSourceLabel(task)}. This
					chart never splits a task total across prompts.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<p className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
						Token counts were not reported for this task. Totals are omitted,
						not shown as 0.
					</p>
				) : (
					<ChartContainer
						className="aspect-auto h-72 min-h-[18rem] w-full"
						config={tokenConfig}
					>
						<BarChart
							accessibilityLayer
							data={data}
							margin={{ left: 4, right: 8, top: 8 }}
						>
							<CartesianGrid vertical={false} />
							<XAxis
								axisLine={false}
								dataKey="label"
								tickLine={false}
								tickMargin={8}
							/>
							<YAxis
								allowDecimals={false}
								axisLine={false}
								tickLine={false}
								width={40}
							/>
							<ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
							<ChartLegend content={<ChartLegendContent />} />
							<Bar
								dataKey="input"
								fill="var(--color-input)"
								isAnimationActive={false}
								radius={[6, 6, 0, 0]}
								stackId="tokens"
							/>
							<Bar
								dataKey="output"
								fill="var(--color-output)"
								isAnimationActive={false}
								radius={[6, 6, 0, 0]}
								stackId="tokens"
							/>
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
