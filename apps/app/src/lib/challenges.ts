// Server only. Challenges are plain folders under /challenges/<id>/. Drop a new folder in
// (meta.json, tests.js, starter/, reference/) and it shows up on the home page.
import fs from "node:fs";
import path from "node:path";
import type { Challenge, ChallengeMeta } from "./types";

const ROOT = path.join(process.cwd(), "challenges");
const EXERCISE_ID = /^[a-z0-9-]+$/;

function readTree(dir: string): Record<string, string> {
	const files: Record<string, string> = {};
	const walk = (d: string) => {
		for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
			const full = path.join(d, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else {
				files[path.relative(dir, full).split(path.sep).join("/")] =
					fs.readFileSync(full, "utf8");
			}
		}
	};
	if (fs.existsSync(dir)) {
		walk(dir);
	}
	return files;
}

const idOk = (id: string) =>
	EXERCISE_ID.test(id) && fs.existsSync(path.join(ROOT, id, "meta.json"));

function meta(id: string): ChallengeMeta {
	const raw = JSON.parse(
		fs.readFileSync(path.join(ROOT, id, "meta.json"), "utf8")
	) as Omit<ChallengeMeta, "id">;
	return { id, ...raw };
}

export function listChallenges(): ChallengeMeta[] {
	return fs
		.readdirSync(ROOT, { withFileTypes: true })
		.filter((e) => e.isDirectory() && idOk(e.name))
		.map((e) => meta(e.name))
		.sort((a, b) => a.order - b.order);
}

export function getMeta(id: string): ChallengeMeta | null {
	return idOk(id) ? meta(id) : null;
}

export function getChallenge(id: string): Challenge | null {
	if (!idOk(id)) {
		return null;
	}
	return {
		...meta(id),
		tests: fs.readFileSync(path.join(ROOT, id, "tests.js"), "utf8"),
		starter: readTree(path.join(ROOT, id, "starter")),
	};
}

export function getReference(id: string): Record<string, string> | null {
	return idOk(id) ? readTree(path.join(ROOT, id, "reference")) : null;
}
