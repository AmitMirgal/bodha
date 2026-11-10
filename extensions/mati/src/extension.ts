import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import {
	commands,
	type ExtensionContext,
	env,
	StatusBarAlignment,
	Uri,
	window,
	workspace,
} from "vscode";
import {
	captureGatePath,
	claimCaptureHolder,
	clearCaptureGate,
	readCaptureGate,
	releaseCaptureHolder,
} from "./capture-gate";
import {
	BOUNDARY_KEY,
	CONSENT_KEY,
	captureStatus,
	idleMinutesFromSetting,
	PAUSED_KEY,
	planAfterCommand,
	shouldAutoStart,
	shouldPromptConsent,
	statusBarLabel,
} from "./capture-state";
import {
	collectCaptureDiagnosis,
	formatDiagnosis,
	writeLastUpload,
} from "./diagnose";
import { readGitBranch } from "./git-branch";
import {
	defaultHooksPath,
	defaultMatiHome,
	ensureCursorHooks,
	hooksFileHasMati,
	installCopilotHooks,
	installCursorHooks,
	readHooksFile,
	uninstallCopilotHooks,
	uninstallCursorHooks,
} from "./install-hooks";
import { describeFetchError, resolveMatiOrigin } from "./origin";
import {
	defaultOtelOutfile,
	installCopilotOtel,
	uninstallCopilotOtel,
} from "./otel";
import {
	type CaptureBatch,
	drainOtelFile,
	drainQueueFile,
	workspaceHashFromFolders,
} from "./queue";
import {
	DEFAULT_BOUNDARY,
	splitCaptureBatch,
	type TaskBoundaryState,
} from "./task-boundary";

const SECRET_ID = "mati.deviceId";
const SECRET_TOKEN = "mati.deviceSecret";
const SECRET_ORIGIN = "mati.appOrigin";
const OTEL_MANAGED = "mati.otel.managed";

let activeHolderId: string | null = null;

const CONSENT_HTML = `<!doctype html>
<html><body style="font-family:sans-serif;padding:1.5rem;max-width:40rem">
<h1>Capture Agent prompts in this workspace</h1>
<p>Mati stores the prompts you send to Cursor Agent or Copilot Chat, the assistant text, edited file names, and a device token on this machine. It does not create a Mati account. Consent is remembered for this workspace only. Cursor hooks have no vendor token counts; any estimate is labelled and undercounts. Copilot Chat can report measured tokens from OpenTelemetry chat spans when Mati is allowed to write a file exporter. captureContent stays off. Known secret patterns are replaced with [redacted:class] on this device before upload. That is not a guarantee.</p>
<p>Sample upload:</p>
<pre>{"kind":"prompt","text":"Fix the flaky test [redacted:aws_access_key]","attachmentNames":["app.ts"]}</pre>
<button id="accept">Accept and start capturing</button>
<script>
const vscode = acquireVsCodeApi();
document.getElementById("accept").addEventListener("click", () => vscode.postMessage({ type: "accept" }));
</script>
</body></html>`;

async function currentOrigin(context: ExtensionContext): Promise<string> {
	const setting = workspace.getConfiguration("mati").get<string>("serverUrl");
	return resolveMatiOrigin({
		envOrigin: process.env.MATI_APP_ORIGIN,
		secretOrigin: await context.secrets.get(SECRET_ORIGIN),
		settingOrigin: typeof setting === "string" ? setting : undefined,
	});
}

async function fetchCapture(
	origin: string,
	pathname: string,
	init: RequestInit,
	action: string,
	fetchImpl: typeof fetch
): Promise<Response> {
	let response: Response;
	try {
		response = await fetchImpl(`${origin}${pathname}`, init);
	} catch (error) {
		throw new Error(
			describeFetchError(action, origin, {
				kind: "network",
				message: error instanceof Error ? error.message : String(error),
			})
		);
	}
	if (!response.ok) {
		throw new Error(
			describeFetchError(action, origin, {
				kind: "http",
				status: response.status,
			})
		);
	}
	return response;
}

async function registerDevice(
	origin: string,
	fetchImpl: typeof fetch
): Promise<{ deviceId: string; secret: string; viewerUrl: string }> {
	const response = await fetchCapture(
		origin,
		"/api/capture/v1/devices",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				version: 1,
				grantedAt: new Date().toISOString(),
				scopes: ["prompt_text", "response_text", "file_edit_paths", "usage"],
			}),
		},
		"register this device",
		fetchImpl
	);
	return (await response.json()) as {
		deviceId: string;
		secret: string;
		viewerUrl: string;
	};
}

function workspaceFolders(): string[] {
	return (
		workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [
			homedir(),
		]
	);
}

function workspaceConsented(context: ExtensionContext): boolean {
	return context.workspaceState.get<boolean>(CONSENT_KEY) === true;
}

function isPaused(context: ExtensionContext): boolean {
	return context.workspaceState.get<boolean>(PAUSED_KEY) === true;
}

function readBoundary(context: ExtensionContext): TaskBoundaryState {
	const stored = context.workspaceState.get<TaskBoundaryState>(BOUNDARY_KEY);
	if (!stored || typeof stored !== "object") {
		return { ...DEFAULT_BOUNDARY };
	}
	return {
		branch: stored.branch ?? null,
		epoch: typeof stored.epoch === "number" ? stored.epoch : 0,
		lastEventAt:
			typeof stored.lastEventAt === "number" ? stored.lastEventAt : null,
		lastEditorTaskId: stored.lastEditorTaskId ?? null,
		workspaceHash:
			typeof stored.workspaceHash === "string" ? stored.workspaceHash : "",
	};
}

function idleMs(): number {
	return (
		idleMinutesFromSetting(
			workspace.getConfiguration("mati").get("idleMinutes")
		) *
		60 *
		1000
	);
}

function uninstallHooks(context: ExtensionContext | null) {
	uninstallCursorHooks();
	uninstallCopilotHooks();
	uninstallCopilotOtel({
		managed: Boolean(context?.globalState.get<boolean>(OTEL_MANAGED)),
	});
}

export async function activate(context: ExtensionContext) {
	activeHolderId = randomUUID();
	let drainTimer: ReturnType<typeof setInterval> | undefined;
	let hookWriteErrorShown = false;
	const status = window.createStatusBarItem(StatusBarAlignment.Right, 80);
	const output = window.createOutputChannel("Mati");
	context.subscriptions.push(status, output);

	const refreshStatus = () => {
		const consented = workspaceConsented(context);
		const paused = isPaused(context);
		const live = shouldAutoStart({
			paused,
			workspaceConsented: consented,
		});
		const gate = readCaptureGate(captureGatePath());
		const { existing } = readHooksFile(defaultHooksPath());
		const label = statusBarLabel(
			captureStatus({
				gateCapturing: gate?.capturing === true,
				hooksInstalled: hooksFileHasMati(existing),
				paused,
				sessionActive: live,
				workspaceConsented: consented,
			})
		);
		status.text = label.text;
		status.tooltip = label.tooltip;
		status.command = label.command;
		status.show();
	};

	const stopDrain = () => {
		if (drainTimer) {
			clearInterval(drainTimer);
			drainTimer = undefined;
		}
	};

	const claimThisWindow = async () => {
		if (!activeHolderId) {
			return;
		}
		const deviceId = await context.secrets.get(SECRET_ID);
		const workspaceHash = workspaceHashFromFolders(workspaceFolders());
		claimCaptureHolder(
			{
				id: activeHolderId,
				updatedAt: Date.now(),
				workspaceHash,
			},
			{ deviceId: deviceId ?? undefined, workspaceHash }
		);
	};

	const releaseThisWindow = () => {
		if (!activeHolderId) {
			return;
		}
		releaseCaptureHolder(activeHolderId);
	};

	let boundary = readBoundary(context);
	const transformBatch = (batch: CaptureBatch): CaptureBatch[] => {
		const folders = workspaceFolders();
		const split = splitCaptureBatch(boundary, batch, {
			branch: readGitBranch(folders[0]),
			idleMs: idleMs(),
			workspaceHash: workspaceHashFromFolders(folders),
		});
		boundary = split.state;
		return split.batches;
	};

	const startDrain = async () => {
		stopDrain();
		const deviceId = await context.secrets.get(SECRET_ID);
		const secret = await context.secrets.get(SECRET_TOKEN);
		if (!(deviceId && secret)) {
			return;
		}
		process.env.MATI_DEVICE_ID = deviceId;
		const matiHome = defaultMatiHome();
		const queuePath = path.join(matiHome, "queue", `${deviceId}.jsonl`);
		const otelPath = defaultOtelOutfile(matiHome);
		const tick = async () => {
			const live = shouldAutoStart({
				paused: isPaused(context),
				workspaceConsented: workspaceConsented(context),
			});
			if (!live) {
				return;
			}
			try {
				ensureCursorHooks({
					hookScriptSource: path.join(
						context.extensionPath,
						"hooks",
						"cursor.mjs"
					),
				});
			} catch (error) {
				refreshStatus();
				if (!hookWriteErrorShown) {
					hookWriteErrorShown = true;
					await window.showErrorMessage(
						error instanceof Error
							? error.message
							: "Mati could not keep Cursor hooks.json installed."
					);
				}
				return;
			}
			await claimThisWindow();
			const origin = await currentOrigin(context);
			const folders = workspaceFolders();
			const workspaceHash = workspaceHashFromFolders(folders);
			return Promise.all([
				drainQueueFile({
					queuePath,
					origin,
					secret,
					transformBatch,
					workspaceHash,
				}),
				drainOtelFile({
					otelPath,
					origin,
					secret,
					transformBatch,
					workspaceHash,
				}),
			]).then(
				([queueResult, otelResult]) => {
					writeLastUpload({
						at: new Date().toISOString(),
						failed: queueResult.failed + otelResult.failed,
						ok: queueResult.failed + otelResult.failed === 0,
						origin,
						posted: queueResult.posted + otelResult.posted,
					});
					refreshStatus();
					return context.workspaceState.update(BOUNDARY_KEY, boundary);
				},
				() => undefined
			);
		};
		drainTimer = setInterval(() => {
			tick();
		}, 4000);
		context.subscriptions.push({ dispose: () => stopDrain() });
		await tick();
	};

	const installHooks = async () => {
		installCursorHooks({
			hookScriptSource: path.join(context.extensionPath, "hooks", "cursor.mjs"),
		});
		installCopilotHooks({
			hookScriptSource: path.join(
				context.extensionPath,
				"hooks",
				"copilot.mjs"
			),
		});
		const otel = installCopilotOtel({ matiHome: defaultMatiHome() });
		await context.globalState.update(OTEL_MANAGED, otel.action === "write");
		return otel;
	};

	const startCapturing = async () => {
		await context.workspaceState.update(PAUSED_KEY, false);
		const otel = await installHooks();
		await claimThisWindow();
		await startDrain();
		refreshStatus();
		return otel;
	};

	const pauseCapturing = async () => {
		await context.workspaceState.update(PAUSED_KEY, true);
		releaseThisWindow();
		stopDrain();
		refreshStatus();
	};

	const showConsent = () => {
		const panel = window.createWebviewPanel("matiConsent", "Mati capture", 1, {
			enableScripts: true,
		});
		panel.webview.html = CONSENT_HTML;
		panel.webview.onDidReceiveMessage(async (message) => {
			if (message.type !== "accept") {
				return;
			}
			try {
				const origin = await currentOrigin(context);
				let deviceId = await context.secrets.get(SECRET_ID);
				let secret = await context.secrets.get(SECRET_TOKEN);
				if (!(deviceId && secret)) {
					const registered = await registerDevice(origin, fetch);
					deviceId = registered.deviceId;
					secret = registered.secret;
					await context.secrets.store(SECRET_ID, registered.deviceId);
					await context.secrets.store(SECRET_TOKEN, registered.secret);
				}
				await context.workspaceState.update(CONSENT_KEY, true);
				process.env.MATI_DEVICE_ID = deviceId;
				const otel = await startCapturing();
				panel.dispose();
				await window.showInformationMessage(
					otel.action === "write"
						? "Mati is capturing Cursor Agent and Copilot Chat prompts in this workspace."
						: `Mati is capturing prompts. ${otel.reason}`
				);
			} catch (error) {
				await window.showErrorMessage(
					error instanceof Error ? error.message : "Consent failed."
				);
			}
		});
	};

	const promptConsentIfNeeded = async () => {
		if (!shouldPromptConsent(workspaceConsented(context))) {
			return;
		}
		const choice = await window.showInformationMessage(
			"Mati can capture Agent prompts in this workspace after you consent. Nothing is captured until you accept.",
			"Start capturing"
		);
		if (choice === "Start capturing") {
			showConsent();
		}
	};

	const applyPlan = async (
		command: "pause" | "resume" | "start" | "stop" | "toggle"
	) => {
		const plan = planAfterCommand(
			{
				paused: isPaused(context),
				workspaceConsented: workspaceConsented(context),
			},
			command
		);
		if (plan.needsConsentUi) {
			showConsent();
			return;
		}
		if (plan.autoStart) {
			try {
				await startCapturing();
				await window.showInformationMessage(
					"Mati is capturing prompts in this workspace."
				);
			} catch (error) {
				refreshStatus();
				await window.showErrorMessage(
					error instanceof Error
						? error.message
						: "Could not start Mati capture."
				);
			}
			return;
		}
		await pauseCapturing();
		await window.showInformationMessage(
			"Paused capturing. Click the Mati status item or run Mati: Start capturing to resume. The device token is kept."
		);
	};

	const postManualBoundary = async (kind: "endTask" | "newTask") => {
		if (
			!shouldAutoStart({
				paused: isPaused(context),
				workspaceConsented: workspaceConsented(context),
			})
		) {
			await window.showErrorMessage(
				"Start capturing in this workspace before changing tasks."
			);
			return;
		}
		const folders = workspaceFolders();
		const workspaceHash = workspaceHashFromFolders(folders);
		const { batches, state } = splitCaptureBatch(
			readBoundary(context),
			{
				editor: "cursor",
				editorTaskId: "manual",
				events: [{ occurredAt: new Date().toISOString() }],
				workspaceHash,
			},
			{
				branch: readGitBranch(folders[0]),
				forceEnd: kind === "endTask",
				forceNew: kind === "newTask",
				idleMs: idleMs(),
				workspaceHash,
			}
		);
		boundary = state;
		await context.workspaceState.update(BOUNDARY_KEY, state);
		const secret = await context.secrets.get(SECRET_TOKEN);
		if (!secret) {
			return;
		}
		const origin = await currentOrigin(context);
		for (const batch of batches) {
			await fetchCapture(
				origin,
				"/api/capture/v1/events",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${secret}`,
						"content-type": "application/json",
					},
					body: JSON.stringify(batch),
				},
				kind === "endTask" ? "end this task" : "start a new task",
				fetch
			).catch(() => undefined);
		}
		await window.showInformationMessage(
			kind === "endTask"
				? "Ended the current Mati task."
				: "Started a new Mati task."
		);
	};

	context.subscriptions.push(
		commands.registerCommand("mati.capture.consent", () => applyPlan("start")),
		commands.registerCommand("mati.capture.statusToggle", () =>
			applyPlan("toggle")
		),
		commands.registerCommand("mati.capture.newTask", () =>
			postManualBoundary("newTask")
		),
		commands.registerCommand("mati.capture.endTask", () =>
			postManualBoundary("endTask")
		),
		commands.registerCommand("mati.capture.openReport", async () => {
			const secret = await context.secrets.get(SECRET_TOKEN);
			if (!secret) {
				await window.showErrorMessage(
					"Accept capture consent before opening a report."
				);
				return;
			}
			try {
				const origin = await currentOrigin(context);
				const response = await fetchCapture(
					origin,
					"/api/capture/v1/devices",
					{ headers: { Authorization: `Bearer ${secret}` } },
					"open the device viewer",
					fetch
				);
				const body = (await response.json()) as { viewerUrl?: string };
				if (body.viewerUrl) {
					await env.openExternal(Uri.parse(body.viewerUrl));
				}
			} catch (error) {
				await window.showErrorMessage(
					error instanceof Error
						? error.message
						: "Could not open the device viewer."
				);
			}
		}),
		commands.registerCommand("mati.capture.stop", () => applyPlan("stop")),
		commands.registerCommand("mati.capture.claim", async () => {
			const secret = await context.secrets.get(SECRET_TOKEN);
			if (!secret) {
				await window.showErrorMessage(
					"Accept capture consent before claiming this device."
				);
				return;
			}
			const code = await window.showInputBox({
				prompt: "Enter the pairing code from Mati Settings",
				placeHolder: "ABCD2345",
				ignoreFocusOut: true,
			});
			if (!code) {
				return;
			}
			try {
				const origin = await currentOrigin(context);
				await fetchCapture(
					origin,
					"/api/capture/v1/pair/claim",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${secret}`,
							"content-type": "application/json",
						},
						body: JSON.stringify({ code }),
					},
					"claim this device",
					fetch
				);
				await window.showInformationMessage(
					"This device is linked to your Mati account."
				);
			} catch (error) {
				await window.showErrorMessage(
					error instanceof Error
						? error.message
						: "Could not claim this device. Check the code and try again."
				);
			}
		}),
		commands.registerCommand("mati.capture.diagnose", async () => {
			if (
				shouldAutoStart({
					paused: isPaused(context),
					workspaceConsented: workspaceConsented(context),
				})
			) {
				try {
					await installHooks();
					await claimThisWindow();
				} catch (error) {
					await window.showErrorMessage(
						error instanceof Error
							? error.message
							: "Could not repair Mati hooks."
					);
				}
			}
			refreshStatus();
			const origin = await currentOrigin(context);
			const text = formatDiagnosis(
				collectCaptureDiagnosis({
					deviceId: await context.secrets.get(SECRET_ID),
					serverUrl: origin,
					workspaceHash: workspaceHashFromFolders(workspaceFolders()),
				})
			);
			output.clear();
			output.appendLine(text);
			output.show(true);
			await window.showInformationMessage(
				text.split("\n").slice(0, 3).join(" · ")
			);
		}),
		commands.registerCommand("mati.capture.deleteData", async () => {
			const secret = await context.secrets.get(SECRET_TOKEN);
			const confirm = await window.showWarningMessage(
				"Delete all captured editor data for this device? Trainer sessions are not touched.",
				{ modal: true },
				"Delete"
			);
			if (confirm !== "Delete") {
				return;
			}
			if (secret) {
				try {
					const origin = await currentOrigin(context);
					await fetchCapture(
						origin,
						"/api/capture/v1/device",
						{
							method: "DELETE",
							headers: { Authorization: `Bearer ${secret}` },
						},
						"delete capture data",
						fetch
					);
				} catch (error) {
					await window.showErrorMessage(
						error instanceof Error
							? error.message
							: "Could not delete capture data on the server."
					);
					return;
				}
			}
			stopDrain();
			uninstallHooks(context);
			clearCaptureGate();
			await context.secrets.delete(SECRET_ID);
			await context.secrets.delete(SECRET_TOKEN);
			await context.workspaceState.update(CONSENT_KEY, false);
			await context.workspaceState.update(PAUSED_KEY, false);
			await context.workspaceState.update(BOUNDARY_KEY, DEFAULT_BOUNDARY);
			refreshStatus();
			await window.showInformationMessage(
				"Deleted capture data for this device."
			);
		}),
		workspace.onDidChangeWorkspaceFolders(() => {
			if (
				shouldAutoStart({
					paused: isPaused(context),
					workspaceConsented: workspaceConsented(context),
				})
			) {
				return claimThisWindow();
			}
			releaseThisWindow();
			return undefined;
		})
	);

	refreshStatus();
	if (
		shouldAutoStart({
			paused: isPaused(context),
			workspaceConsented: workspaceConsented(context),
		})
	) {
		try {
			await startCapturing();
		} catch (error) {
			refreshStatus();
			await window.showErrorMessage(
				error instanceof Error ? error.message : "Could not start Mati capture."
			);
		}
		return;
	}
	releaseThisWindow();
	await promptConsentIfNeeded();
}

export function deactivate() {
	if (activeHolderId) {
		releaseCaptureHolder(activeHolderId);
		activeHolderId = null;
	}
}
