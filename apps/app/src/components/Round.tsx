"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { runBackground } from "../lib/background";
import { fmtClock } from "../lib/format";
import {
	runTests,
	type TaskStatus,
	type TestResult,
	taskStatus,
} from "../lib/runner";
import { loadAiWidth, saveAiWidth } from "../lib/storage";
import { type Challenge, isReadOnly } from "../lib/types";
import AiPanel from "./AiPanel";

interface Props {
	challenge: Challenge;
	files: Record<string, string>;
	onExit: () => void;
	onFiles: (files: Record<string, string>) => void;
	onFinish: () => void;
	saveError: string;
	sessionId: string;
	startedAt: number;
}

const defineTheme: BeforeMount = (monaco) => {
	monaco.editor.defineTheme("code-comprehension", {
		base: "vs-dark",
		inherit: true,
		rules: [
			{ token: "comment", foreground: "6b6b78", fontStyle: "italic" },
			{ token: "keyword", foreground: "ff4d8d" },
			{ token: "string", foreground: "c6ff3d" },
			{ token: "number", foreground: "ffb84d" },
		],
		colors: {
			"editor.background": "#121216",
			"editor.lineHighlightBackground": "#1a1a20",
			"editorLineNumber.foreground": "#4a4a55",
			"editorLineNumber.activeForeground": "#c6ff3d",
			"editor.selectionBackground": "#c6ff3d33",
		},
	});
};

export default function Round({
	challenge,
	sessionId,
	files,
	startedAt,
	saveError,
	onFiles,
	onFinish,
	onExit,
}: Props) {
	const paths = Object.keys(files);
	const [active, setActive] = useState(
		paths.find((path) => path === "README.md") ?? paths[0],
	);
	const [running, setRunning] = useState(false);
	const [fatal, setFatal] = useState("");
	const [results, setResults] = useState<TestResult[] | undefined>();
	const [aiOpen, setAiOpen] = useState(true);
	const [aiWidth, setAiWidth] = useState(loadAiWidth);
	const dragging = useRef(false);
	const [confirming, setConfirming] = useState(false);
	const [now, setNow] = useState(Date.now());
	const [finishError, setFinishError] = useState("");
	const filesRef = useRef(files);
	filesRef.current = files;
	const finished = useRef(false);

	const deadline = startedAt + challenge.minutes * 60_000;
	const left = deadline - now;

	const run = useCallback(async (): Promise<TestResult[]> => {
		setRunning(true);
		setFatal("");
		const out = await runTests(filesRef.current, challenge.tests);
		setRunning(false);
		setFatal(out.fatal ?? "");
		setResults(out.results);
		await fetch(`/api/sessions/${sessionId}/tests`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				files: filesRef.current,
				results: out.results,
				fatal: out.fatal,
			}),
		});
		return out.results;
	}, [challenge.tests, sessionId]);

	const finish = useCallback(async () => {
		if (finished.current) {
			return;
		}
		finished.current = true;
		await run();
		const response = await fetch(`/api/sessions/${sessionId}/finish`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ clientRequestId: crypto.randomUUID() }),
		});
		const body = await response.json().catch(() => ({}));
		if (!(response.ok || body.evidencePreserved)) {
			finished.current = false;
			setFinishError(body.error ?? "Could not finish.");
			return;
		}
		onFinish();
	}, [onFinish, run, sessionId]);

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		if (left <= 0) {
			runBackground(finish());
		}
	}, [left, finish]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
				event.preventDefault();
				runBackground(run());
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [run]);

	const urgent = left < 5 * 60_000;
	const clampWidth = (width: number) =>
		Math.round(
			Math.min(
				Math.max(width, 280),
				Math.max(280, window.innerWidth - 290 - 300),
			),
		);
	const onDrag = (event: React.PointerEvent) => {
		if (dragging.current) {
			setAiWidth(clampWidth(window.innerWidth - event.clientX));
		}
	};
	const endDrag = (event: React.PointerEvent) => {
		if (!dragging.current) {
			return;
		}
		dragging.current = false;
		event.currentTarget.releasePointerCapture(event.pointerId);
		document.body.classList.remove("resizing");
		saveAiWidth(aiWidth);
	};

	return (
		<div
			className={`round ${aiOpen ? "" : "no-ai"}`}
			style={{ ["--ai-w" as string]: `${aiWidth}px` }}
		>
			<header className="bar">
				<button
					className="logo"
					onClick={onExit}
					title="Back to exercises (progress is saved)"
					type="button"
				>
					<span>{"//"}</span> BODHA
				</button>
				<div className="bar-title">{challenge.title}</div>
				<div className={`clock ${urgent ? "urgent" : ""}`}>
					{fmtClock(left)}
				</div>
				<button
					className="btn ghost"
					onClick={() => setAiOpen((value) => !value)}
					type="button"
				>
					{aiOpen ? "Hide AI" : "Show AI"}
				</button>
				<button
					className="btn lime"
					disabled={running}
					onClick={() => runBackground(run())}
					type="button"
				>
					{running ? "Running…" : "Run tests"} <kbd>Ctrl ↵</kbd>
				</button>
				<button
					className={`btn ${confirming ? "pink" : "ghost"}`}
					onBlur={() => setConfirming(false)}
					onClick={() =>
						confirming ? runBackground(finish()) : setConfirming(true)
					}
					type="button"
				>
					{confirming ? "Sure? Submit" : "Submit"}
				</button>
			</header>
			{saveError ? <div className="fatal">{saveError}</div> : null}
			{finishError ? <div className="fatal">{finishError}</div> : null}

			<aside className="side">
				<section>
					<h4>Tasks</h4>
					<ol className="tasks">
						{challenge.tasks.map((task, index) => {
							const status = taskStatus(task.id, results);
							return (
								<li className={status.status} key={task.id}>
									<div className="task-top">
										<span className="task-n">{index + 1}</span>
										<strong>{task.title}</strong>
										<span className="task-state">{taskStateLabel(status)}</span>
									</div>
									<p>{task.brief}</p>
								</li>
							);
						})}
					</ol>
				</section>
				<section>
					<h4>Files</h4>
					<ul className="files">
						{paths.map((path) => (
							<li key={path}>
								<button
									className={path === active ? "on" : ""}
									onClick={() => setActive(path)}
									type="button"
								>
									{path}
									{isReadOnly(path) ? <em>read-only</em> : null}
								</button>
							</li>
						))}
					</ul>
				</section>
			</aside>

			<main className="work">
				<div className="editor">
					<Editor
						beforeMount={defineTheme}
						language={active.endsWith(".md") ? "markdown" : "javascript"}
						onChange={(value) =>
							onFiles({ ...filesRef.current, [active]: value ?? "" })
						}
						options={{
							readOnly: isReadOnly(active),
							fontFamily: "JetBrains Mono, monospace",
							fontSize: 14,
							automaticLayout: true,
							minimap: { enabled: false },
							scrollBeyondLastLine: false,
							padding: { top: 14 },
							wordWrap: active.endsWith(".md") ? "on" : "off",
							renderLineHighlight: "line",
						}}
						path={active}
						theme="code-comprehension"
						value={files[active]}
					/>
				</div>
				<Console
					challenge={challenge}
					fatal={fatal}
					results={results}
					running={running}
				/>
			</main>

			{aiOpen ? (
				<>
					<button
						aria-label="Resize AI panel"
						className="resizer"
						onDoubleClick={() => setAiWidth(380)}
						onPointerCancel={endDrag}
						onPointerDown={(event) => {
							dragging.current = true;
							event.currentTarget.setPointerCapture(event.pointerId);
							document.body.classList.add("resizing");
						}}
						onPointerMove={onDrag}
						onPointerUp={endDrag}
						style={{ right: aiWidth - 4 }}
						type="button"
					/>
					<AiPanel sessionId={sessionId} />
				</>
			) : null}
		</div>
	);
}

function taskStateLabel(status: {
	passed: number;
	status: TaskStatus;
	total: number;
}): string {
	switch (status.status) {
		case "solved":
			return "done";
		case "failing":
			return `${status.passed}/${status.total}`;
		case "untested":
			return "";
		default: {
			const exhaustive: never = status.status;
			return exhaustive;
		}
	}
}

function Console({
	results,
	fatal,
	challenge,
	running,
}: {
	results?: TestResult[];
	fatal: string;
	challenge: Challenge;
	running: boolean;
}) {
	return (
		<div className="console">
			<div className="console-head">
				<h4>Tests</h4>
				{results && results.length > 0 ? (
					<span className="muted">
						{results.filter((result) => result.pass).length}/{results.length}{" "}
						passing
					</span>
				) : null}
				{running ? <span className="muted">running…</span> : null}
			</div>
			<div className="console-body">
				{fatal ? <div className="fatal">{fatal}</div> : null}
				{results || fatal ? null : (
					<p className="muted">
						Browser harness only. Results are observations, not a certificate.
					</p>
				)}
				{results
					? challenge.tasks.map((task) => {
							const mine = results.filter((result) => result.task === task.id);
							if (!mine.length) {
								return null;
							}
							return (
								<div className="group" key={task.id}>
									<h5>{task.title}</h5>
									{mine.map((result) => (
										<div
											className={`t ${result.pass ? "ok" : "bad"}`}
											key={`${result.task}-${result.name}`}
										>
											<span className="dot" />
											<div>
												<div>{result.name}</div>
												{result.error ? <code>{result.error}</code> : null}
											</div>
										</div>
									))}
								</div>
							);
						})
					: null}
			</div>
		</div>
	);
}
