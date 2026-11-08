"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { runBackground } from "../lib/background";

interface ChatMessage {
	content: string;
	id: string;
	role: "user" | "assistant";
}

function Reply({ text }: { text: string }) {
	return (
		<div className="md">
			<Markdown
				components={{
					a: ({ children, href }) => (
						<a href={href} rel="noreferrer" target="_blank">
							{children}
						</a>
					),
				}}
				remarkPlugins={[remarkGfm]}
			>
				{text}
			</Markdown>
		</div>
	);
}

export default function AiPanel({ sessionId }: { sessionId: string }) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [source, setSource] = useState("");
	const endRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		runBackground(
			fetch(`/api/sessions/${sessionId}/messages`)
				.then((response) => response.json())
				.then((body) => {
					const loaded = (body.messages ?? [])
						.filter(
							(row: { id: string; role: string }) =>
								row.role === "user" || row.role === "assistant",
						)
						.map(
							(row: {
								id: string;
								role: "user" | "assistant";
								content: string;
							}) => ({
								id: row.id,
								role: row.role,
								content: row.content,
							}),
						);
					setMessages(loaded);
				})
				.catch(() => undefined),
		);
	}, [sessionId]);

	useEffect(() => {
		const transcriptLength = messages.length;
		const waiting = busy;
		if (transcriptLength === 0 && !waiting) {
			return;
		}
		endRef.current?.scrollIntoView({ block: "end" });
	}, [messages, busy]);

	async function send() {
		const text = input.trim();
		if (!text || busy) {
			return;
		}
		setBusy(true);
		setError("");
		setInput("");
		setMessages((current) => [
			...current,
			{ id: crypto.randomUUID(), role: "user", content: text },
		]);
		try {
			const response = await fetch(`/api/sessions/${sessionId}/chat`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					message: text,
					clientRequestId: crypto.randomUUID(),
				}),
			});
			const body = await response.json();
			if (!response.ok) {
				setError(body.error ?? "Trainer failed.");
				return;
			}
			setSource(`${body.source}: ${body.provider}/${body.model}`);
			setMessages((current) => [
				...current,
				{ id: crypto.randomUUID(), role: "assistant", content: body.reply },
			]);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Trainer failed.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="ai">
			<div className="ai-head">
				<h3>Trainer</h3>
				<a className="link" href="/settings">
					LLM settings
				</a>
			</div>
			<p className="muted">
				Server-side Mastra agent with read-only session tools. Keys stay on the
				server.
				{source ? ` Using ${source}.` : ""}
			</p>
			<div className="ai-log">
				{messages.length === 0 && (
					<p className="muted">
						Ask about the current exercise. Check claims against the code.
					</p>
				)}
				{messages.map((message) => (
					<div className={`bubble ${message.role}`} key={message.id}>
						{message.role === "user" ? (
							<p>{message.content}</p>
						) : (
							<Reply text={message.content} />
						)}
					</div>
				))}
				{busy ? (
					<div className="bubble assistant thinking">working…</div>
				) : null}
				{error ? <div className="ai-error">{error}</div> : null}
				<div ref={endRef} />
			</div>
			<form
				className="ai-input"
				onSubmit={(event) => {
					event.preventDefault();
					runBackground(send());
				}}
			>
				<textarea
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							runBackground(send());
						}
					}}
					placeholder="Ask about the code…"
					rows={2}
					value={input}
				/>
				<button
					className="btn lime"
					disabled={busy || !input.trim()}
					type="submit"
				>
					Send
				</button>
			</form>
		</div>
	);
}
