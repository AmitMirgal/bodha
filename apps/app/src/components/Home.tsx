import { Button } from "@repo/design-system/components/ui/button";
import type { ChallengeMeta } from "../lib/types";
import { MarketingHeader } from "./MarketingHeader";

const STEPS = [
	[
		"Read",
		"You get a codebase you have never seen, with a README that says how it should behave.",
	],
	[
		"Break",
		"Some of it is wrong. Find the bugs, then add a feature that fits the existing design.",
	],
	[
		"Speed up",
		"One piece is too slow. Fix it without changing what it returns.",
	],
	[
		"Use the AI, don’t trust it",
		"An assistant can see your files. It is also sometimes wrong, and checking it is part of the job.",
	],
] as const;

export function MarketingHome({
	challenges,
	email,
}: {
	challenges: ChallengeMeta[];
	email?: string | null;
}) {
	const signedIn = Boolean(email);
	return (
		<div className="home">
			<MarketingHeader email={email} />

			<section className="hero">
				<p className="eyebrow">practice reading unfamiliar code</p>
				<h1>
					Reading code is a <mark>skill</mark>.
					<br />
					Train it like one.
				</h1>
				<p className="lede">
					Sixty minutes. A codebase you didn&rsquo;t write. Bugs to find, a
					feature to add, a slow function to fix, and an AI that may or may not
					be right. Then see how you used it.
				</p>
				{signedIn ? (
					<Button asChild className="btn lime big">
						<a href="/exercises">Continue to exercises</a>
					</Button>
				) : (
					<Button asChild className="btn lime big">
						<a href="/login?next=/exercises">Get started</a>
					</Button>
				)}
			</section>

			<section className="how" id="how">
				{STEPS.map(([title, body], index) => (
					<div
						className="step"
						key={title}
						style={{
							["--tilt" as string]: `${String((index % 2 ? 1 : -1) * (0.6 + index * 0.25))}deg`,
						}}
					>
						<span className="step-n">{index + 1}</span>
						<h3>{title}</h3>
						<p>{body}</p>
					</div>
				))}
			</section>

			<section className="rounds" id="rounds">
				<h2>Pick a round</h2>
				<div className="cards">
					{challenges.map((challenge) => (
						<article className="card" key={challenge.id}>
							<div className="card-top">
								<span className="pill">{challenge.difficulty}</span>
								<span className="pill outline">{challenge.minutes} min</span>
							</div>
							<h3>{challenge.title}</h3>
							<p>{challenge.blurb}</p>
							<ul>
								{challenge.tasks.map((task) => (
									<li key={task.id}>{task.title}</li>
								))}
							</ul>
							<div className="card-actions">
								<Button asChild className="btn lime">
									<a href={signedIn ? "/exercises" : "/login?next=/exercises"}>
										Start
									</a>
								</Button>
							</div>
						</article>
					))}
				</div>
			</section>

			<footer>
				<p>
					Mati is an open-source individual learning trainer. It is not a skill
					score, a team dashboard, or a replica of anyone&rsquo;s interview
					loop.
				</p>
			</footer>
		</div>
	);
}
